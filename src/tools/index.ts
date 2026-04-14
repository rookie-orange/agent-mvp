import type { ChatCompletionMessageToolCall, ChatCompletionToolMessageParam } from 'openai/resources/chat/completions'
import type { AgentToolExecutionRecord, ToolExecutionContext } from '@/types'
import { isObject } from '@/shared/general'
import {
  applyFileEditsTool,
  buildMutationValidation,
  deleteFileTool,
  getLatestBackupTool,
  isMutationToolName,
  listBackupsTool,
  listFilesTool,
  moveFileTool,
  readLocalFileTool,
  readMultipleFilesTool,
  replaceInFileTool,
  restoreBackupTool,
  rollbackLatestTool,
  searchInFilesTool,
  writeFileTool,
} from './files'
import { getCurrentTimeTool } from './get-current-time'
import { buildGitChangeSummaryFromInspection, buildGitInspection, gitDiffTool, gitStatusTool } from './git'
import { updatePlanTool } from './planner'
import {
  runCommandTool,
  runDefaultMutationValidation,
  validateWorkspaceTool,
} from './shell'

export { toolPromptLines } from './prompt'

const tools = [
  getCurrentTimeTool,
  updatePlanTool,
  listFilesTool,
  readLocalFileTool,
  readMultipleFilesTool,
  searchInFilesTool,
  gitStatusTool,
  gitDiffTool,
  runCommandTool,
  validateWorkspaceTool,
  listBackupsTool,
  getLatestBackupTool,
  rollbackLatestTool,
  writeFileTool,
  replaceInFileTool,
  applyFileEditsTool,
  moveFileTool,
  deleteFileTool,
  restoreBackupTool,
]

const toolRegistry = new Map(
  tools.map(tool => [tool.definition.function.name, tool]),
)

function parseToolArguments(rawArguments: string) {
  if (!rawArguments.trim()) {
    return {}
  }

  const parsed = JSON.parse(rawArguments) as unknown

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('工具参数必须是一个 JSON 对象。')
  }

  return parsed as Record<string, unknown>
}

function serializeToolResult(result: unknown) {
  return JSON.stringify(result, null, 2)
}

interface ToolMessagePayload {
  ok: boolean
  result?: unknown
  error?: string
}

interface PendingToolMessage {
  toolCallId: string
  payload: ToolMessagePayload
}

interface ExecuteToolCallsResult {
  messages: ChatCompletionToolMessageParam[]
  records: AgentToolExecutionRecord[]
}

function getResultPath(result: Record<string, unknown>, fieldName: string) {
  const value = result[fieldName]

  return typeof value === 'string' ? value : undefined
}

function getAffectedPaths(toolName: string, result: unknown) {
  if (!isObject(result)) {
    return [] as string[]
  }

  if (toolName === 'writeFile' || toolName === 'replaceInFile' || toolName === 'applyFileEdits' || toolName === 'deleteFile') {
    const path = getResultPath(result, 'path')
    return path ? [path] : []
  }

  if (toolName === 'moveFile') {
    const fromPath = getResultPath(result, 'fromPath')
    const toPath = getResultPath(result, 'toPath')
    return [fromPath, toPath].filter((value): value is string => Boolean(value))
  }

  if (toolName === 'restoreBackup' || toolName === 'rollbackLatest') {
    const affectedPaths = result.affectedPaths

    if (Array.isArray(affectedPaths)) {
      return affectedPaths.filter((value): value is string => typeof value === 'string')
    }
  }

  return []
}

function mergeResultPayload(result: unknown, extraPayload: Record<string, unknown>) {
  if (Object.keys(extraPayload).length === 0) {
    return result
  }

  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return {
      ...result,
      ...extraPayload,
    }
  }

  return {
    value: result,
    ...extraPayload,
  }
}

export const toolDefinitions = tools.map(tool => tool.definition)

export async function executeToolCalls(
  toolCalls: ChatCompletionMessageToolCall[],
  context: ToolExecutionContext = {},
  step = 1,
): Promise<ExecuteToolCallsResult> {
  const pendingMessages: PendingToolMessage[] = []
  const records: AgentToolExecutionRecord[] = []
  const mutationResultIndices: number[] = []
  const mutationAffectedPaths = new Set<string>()

  for (const toolCall of toolCalls) {
    if (toolCall.type !== 'function') {
      const error = `暂不支持的工具调用类型: ${toolCall.type}`

      pendingMessages.push({
        toolCallId: toolCall.id,
        payload: {
          ok: false,
          error,
        },
      })
      records.push({
        step,
        toolCallId: toolCall.id,
        toolName: toolCall.type,
        ok: false,
        args: null,
        error,
      })
      continue
    }

    const toolName = toolCall.function.name
    const tool = toolRegistry.get(toolName)

    if (!tool) {
      const error = `未知工具: ${toolName}`

      pendingMessages.push({
        toolCallId: toolCall.id,
        payload: {
          ok: false,
          error,
        },
      })
      records.push({
        step,
        toolCallId: toolCall.id,
        toolName,
        ok: false,
        args: null,
        error,
      })
      continue
    }

    let args: Record<string, unknown> | null = null

    try {
      args = parseToolArguments(toolCall.function.arguments)
      const rawResult = await tool.execute(args, context)
      const validation = await buildMutationValidation(toolName, rawResult)
      const extraPayload: Record<string, unknown> = {}

      if (validation) {
        extraPayload.validation = validation
      }

      const mergedResult = mergeResultPayload(rawResult, extraPayload)

      pendingMessages.push({
        toolCallId: toolCall.id,
        payload: {
          ok: true,
          result: mergedResult,
        },
      })
      records.push({
        step,
        toolCallId: toolCall.id,
        toolName,
        ok: true,
        args,
        result: mergedResult,
      })

      if (isMutationToolName(toolName)) {
        const recordIndex = records.length - 1
        mutationResultIndices.push(recordIndex)

        for (const path of getAffectedPaths(toolName, rawResult)) {
          mutationAffectedPaths.add(path)
        }
      }
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : '工具执行失败'

      pendingMessages.push({
        toolCallId: toolCall.id,
        payload: {
          ok: false,
          error: message,
        },
      })
      records.push({
        step,
        toolCallId: toolCall.id,
        toolName,
        ok: false,
        args,
        error: message,
      })
    }
  }

  if (mutationResultIndices.length > 0) {
    let workspaceValidation: unknown

    try {
      workspaceValidation = await runDefaultMutationValidation(context)
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : '自动验证失败'
      workspaceValidation = {
        passed: false,
        error: message,
        steps: [],
        requestedCommands: ['pnpm typecheck', 'pnpm build'],
        executedCommands: [],
      }
    }

    let changeSummary: unknown

    if (mutationAffectedPaths.size > 0) {
      const batchInspection = await buildGitInspection([...mutationAffectedPaths])
      changeSummary = buildGitChangeSummaryFromInspection(batchInspection)
    }

    const lastMutationIndex = mutationResultIndices.at(-1)

    if (lastMutationIndex !== undefined) {
      const lastMutationMessage = pendingMessages[lastMutationIndex]
      const lastMutationRecord = records[lastMutationIndex]

      if (lastMutationMessage?.payload.ok && lastMutationRecord?.ok) {
        const extraPayload: Record<string, unknown> = {}

        if (changeSummary) {
          extraPayload.changeSummary = changeSummary
        }

        if (workspaceValidation) {
          extraPayload.workspaceValidation = workspaceValidation
        }

        const mergedResult = mergeResultPayload(
          lastMutationMessage.payload.result,
          extraPayload,
        )

        lastMutationMessage.payload.result = mergedResult
        lastMutationRecord.result = mergedResult
      }
    }
  }

  return {
    messages: pendingMessages.map((message) => {
      return {
        role: 'tool',
        tool_call_id: message.toolCallId,
        content: serializeToolResult(message.payload),
      } satisfies ChatCompletionToolMessageParam
    }),
    records,
  }
}

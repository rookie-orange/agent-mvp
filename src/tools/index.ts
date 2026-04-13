import type { ToolExecutionContext } from '@/types'
import type { ChatCompletionMessageToolCall, ChatCompletionToolMessageParam } from 'openai/resources/chat/completions'
import { isObject } from '@/shared/general'
import type { GitDiffSnapshot, GitStatusSnapshot } from './git/shared'
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
import { buildGitChangeSummaryFromInspection, gitDiffTool, gitStatusTool } from './git'
import {
  runCommandTool,
  runDefaultMutationValidation,
  validateWorkspaceTool,
} from './shell'

export { toolPromptLines } from './prompt'

const tools = [
  getCurrentTimeTool,
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

function getGitInspectionFromValidation(validation: unknown) {
  if (!isObject(validation)) {
    return undefined
  }

  const git = validation.git

  if (!isObject(git) || !isObject(git.status) || !isObject(git.diff)) {
    return undefined
  }

  return {
    status: git.status as unknown as GitStatusSnapshot,
    diff: git.diff as unknown as GitDiffSnapshot,
  }
}

export const toolDefinitions = tools.map(tool => tool.definition)

export async function executeToolCalls(
  toolCalls: ChatCompletionMessageToolCall[],
  context: ToolExecutionContext = {},
) {
  const toolMessages: ChatCompletionToolMessageParam[] = []

  for (const toolCall of toolCalls) {
    if (toolCall.type !== 'function') {
      toolMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: serializeToolResult({
          ok: false,
          error: `暂不支持的工具调用类型: ${toolCall.type}`,
        }),
      })
      continue
    }

    const tool = toolRegistry.get(toolCall.function.name)

    if (!tool) {
      toolMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: serializeToolResult({
          ok: false,
          error: `未知工具: ${toolCall.function.name}`,
        }),
      })
      continue
    }

    try {
      const args = parseToolArguments(toolCall.function.arguments)
      const rawResult = await tool.execute(args, context)
      const validation = await buildMutationValidation(toolCall.function.name, rawResult)
      const gitInspection = getGitInspectionFromValidation(validation)
      const changeSummary = gitInspection
        ? buildGitChangeSummaryFromInspection(gitInspection)
        : undefined
      let workspaceValidation: unknown

      if (isMutationToolName(toolCall.function.name)) {
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
      }

      const extraPayload: Record<string, unknown> = {}

      if (validation) {
        extraPayload.validation = validation
      }

      if (changeSummary) {
        extraPayload.changeSummary = changeSummary
      }

      if (workspaceValidation) {
        extraPayload.workspaceValidation = workspaceValidation
      }

      const result = rawResult && typeof rawResult === 'object' && !Array.isArray(rawResult) && Object.keys(extraPayload).length > 0
        ? {
            ...rawResult,
            ...extraPayload,
          }
        : rawResult

      toolMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: serializeToolResult({
          ok: true,
          result,
        }),
      })
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : '工具执行失败'

      toolMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: serializeToolResult({
          ok: false,
          error: message,
        }),
      })
    }
  }

  return toolMessages
}

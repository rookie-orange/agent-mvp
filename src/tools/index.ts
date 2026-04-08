import type {
  ChatCompletionMessageToolCall,
  ChatCompletionToolMessageParam,
} from 'openai/resources/chat/completions'
import { stat } from 'node:fs/promises'
import { applyFileEditsTool } from './apply-file-edits'
import { deleteFileTool } from './delete-file'
import { getCurrentTimeTool } from './get-current-time'
import { listFilesTool } from './list-files'
import { moveFileTool } from './move-file'
import { readWorkspaceFile } from './read-local-file'
import { readLocalFileTool } from './read-local-file'
import { readMultipleFilesTool } from './read-multiple-files'
import { replaceInFileTool } from './replace-in-file'
import { searchInFilesTool } from './search-in-files'
import { writeFileTool } from './write-file'

const tools = [
  getCurrentTimeTool,
  listFilesTool,
  readLocalFileTool,
  readMultipleFilesTool,
  searchInFilesTool,
  writeFileTool,
  replaceInFileTool,
  applyFileEditsTool,
  moveFileTool,
  deleteFileTool,
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

async function pathExists(filePath: string) {
  try {
    await stat(filePath)
    return true
  }
  catch {
    return false
  }
}

async function buildMutationValidation(toolName: string, result: unknown) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return undefined
  }

  if (toolName === 'writeFile' || toolName === 'replaceInFile' || toolName === 'applyFileEdits') {
    const path = 'path' in result && typeof result.path === 'string'
      ? result.path
      : undefined

    if (!path) {
      return undefined
    }

    return {
      kind: 'readback',
      file: await readWorkspaceFile({ path }),
    }
  }

  if (toolName === 'moveFile') {
    const fromPath = 'fromPath' in result && typeof result.fromPath === 'string'
      ? result.fromPath
      : undefined
    const toPath = 'toPath' in result && typeof result.toPath === 'string'
      ? result.toPath
      : undefined

    if (!fromPath || !toPath) {
      return undefined
    }

    return {
      kind: 'move-check',
      sourceExists: await pathExists(fromPath),
      destination: await readWorkspaceFile({ path: toPath }),
    }
  }

  if (toolName === 'deleteFile') {
    const path = 'path' in result && typeof result.path === 'string'
      ? result.path
      : undefined

    if (!path) {
      return undefined
    }

    return {
      kind: 'delete-check',
      existsAfterDelete: await pathExists(path),
    }
  }

  return undefined
}

export const toolDefinitions = tools.map(tool => tool.definition)

export async function executeToolCalls(toolCalls: ChatCompletionMessageToolCall[]) {
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
      const rawResult = await tool.execute(args)
      const validation = await buildMutationValidation(toolCall.function.name, rawResult)
      const result = validation && rawResult && typeof rawResult === 'object' && !Array.isArray(rawResult)
        ? {
            ...rawResult,
            validation,
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

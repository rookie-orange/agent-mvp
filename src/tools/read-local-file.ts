import type { AgentTool } from '@/types'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isNumber, isString } from '@/shared/general'

const WORKSPACE_ROOT = process.cwd()
const MAX_OUTPUT_CHARS = 12000

function getLineNumber(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined
  }

  if (!isNumber(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} 必须是大于等于 1 的整数。`)
  }

  return value
}

function getRequestedPath(value: unknown) {
  if (!isString(value) || !value.trim()) {
    throw new Error('path 必须是非空字符串。')
  }

  return value.trim()
}

function resolveWorkspacePath(requestedPath: string) {
  const resolvedPath = path.resolve(WORKSPACE_ROOT, requestedPath)
  const relativePath = path.relative(WORKSPACE_ROOT, resolvedPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('只允许读取当前工作区内的文件。')
  }

  return {
    resolvedPath,
    relativePath: relativePath || '.',
  }
}

const REGEX_LINE_SPLIT = /\r?\n/

function selectContentByLines(content: string, startLine?: number, endLine?: number) {
  const lines = content.split(REGEX_LINE_SPLIT)
  const totalLines = lines.length
  const safeStartLine = startLine ?? 1
  const safeEndLine = endLine ?? totalLines

  if (safeStartLine > safeEndLine) {
    throw new Error('startLine 不能大于 endLine。')
  }

  if (safeStartLine > totalLines) {
    throw new Error(`startLine 超出文件总行数，当前文件共有 ${totalLines} 行。`)
  }

  const slicedLines = lines.slice(safeStartLine - 1, safeEndLine)

  return {
    totalLines,
    selectedStartLine: safeStartLine,
    selectedEndLine: Math.min(safeEndLine, totalLines),
    content: slicedLines.join('\n'),
  }
}

function trimLargeContent(content: string) {
  if (content.length <= MAX_OUTPUT_CHARS) {
    return {
      content,
      truncated: false,
    }
  }

  return {
    content: `${content.slice(0, MAX_OUTPUT_CHARS)}\n\n[内容已截断，请使用更精确的 startLine / endLine 继续读取]`,
    truncated: true,
  }
}

export const readLocalFileTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'readLocalFile',
      description: '读取当前工作区内的本地文本文件内容。需要查看代码、配置或文档时使用。path 传相对工作区根目录的路径，可选 startLine 和 endLine 指定读取范围。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要读取的文件路径，相对当前工作区根目录，例如 src/index.ts 或 package.json。',
          },
          startLine: {
            type: 'integer',
            description: '可选，起始行号，从 1 开始。',
            minimum: 1,
          },
          endLine: {
            type: 'integer',
            description: '可选，结束行号，从 1 开始。',
            minimum: 1,
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const requestedPath = getRequestedPath(args.path)
    const startLine = getLineNumber(args.startLine, 'startLine')
    const endLine = getLineNumber(args.endLine, 'endLine')
    const { resolvedPath, relativePath } = resolveWorkspacePath(requestedPath)

    const fileStat = await stat(resolvedPath)

    if (!fileStat.isFile()) {
      throw new Error(`目标不是文件: ${relativePath}`)
    }

    const rawContent = await readFile(resolvedPath, 'utf8')
    const selected = selectContentByLines(rawContent, startLine, endLine)
    const trimmed = trimLargeContent(selected.content)

    return {
      path: relativePath,
      totalLines: selected.totalLines,
      startLine: selected.selectedStartLine,
      endLine: selected.selectedEndLine,
      truncated: trimmed.truncated,
      content: trimmed.content,
    }
  },
}

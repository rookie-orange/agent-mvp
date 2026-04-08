import { readFile, stat } from 'node:fs/promises'
import { getLineNumber, getRequiredPath } from './args'
import { resolveWorkspacePath } from './workspace'

const MAX_OUTPUT_CHARS = 12000
const REGEX_LINE_SPLIT = /\r?\n/

export interface ReadWorkspaceFileInput {
  path: string
  startLine?: number
  endLine?: number
}

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

export async function readWorkspaceFile({
  path: requestedPath,
  startLine,
  endLine,
}: ReadWorkspaceFileInput) {
  const normalizedPath = getRequiredPath(requestedPath)
  const normalizedStartLine = getLineNumber(startLine, 'startLine')
  const normalizedEndLine = getLineNumber(endLine, 'endLine')
  const { resolvedPath, relativePath } = resolveWorkspacePath(
    normalizedPath,
    '只允许读取当前工作区内的文件。',
  )

  const fileStat = await stat(resolvedPath)

  if (!fileStat.isFile()) {
    throw new Error(`目标不是文件: ${relativePath}`)
  }

  const rawContent = await readFile(resolvedPath, 'utf8')
  const selected = selectContentByLines(rawContent, normalizedStartLine, normalizedEndLine)
  const trimmed = trimLargeContent(selected.content)

  return {
    path: relativePath,
    totalLines: selected.totalLines,
    startLine: selected.selectedStartLine,
    endLine: selected.selectedEndLine,
    truncated: trimmed.truncated,
    content: trimmed.content,
  }
}

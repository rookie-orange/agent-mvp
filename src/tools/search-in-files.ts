import type { AgentTool } from '@/types'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isNumber, isString } from '@/shared/general'

const WORKSPACE_ROOT = process.cwd()
const DEFAULT_MAX_RESULTS = 30
const MAX_ALLOWED_RESULTS = 200
const MAX_FILE_SIZE_BYTES = 256 * 1024
const IGNORED_DIRECTORIES = new Set(['.git', 'dist', 'node_modules'])
const REGEX_LINE_SPLIT = /\r?\n/

function getQuery(value: unknown) {
  if (!isString(value) || !value.trim()) {
    throw new Error('query 必须是非空字符串。')
  }

  return value.trim()
}

function getRequestedPath(value: unknown) {
  if (value === undefined) {
    return '.'
  }

  if (!isString(value) || !value.trim()) {
    throw new Error('path 必须是非空字符串。')
  }

  return value.trim()
}

function getCaseSensitive(value: unknown) {
  if (value === undefined) {
    return false
  }

  if (typeof value !== 'boolean') {
    throw new TypeError('caseSensitive 必须是布尔值。')
  }

  return value
}

function getMaxResults(value: unknown) {
  if (value === undefined) {
    return DEFAULT_MAX_RESULTS
  }

  if (!isNumber(value) || !Number.isInteger(value)) {
    throw new Error('maxResults 必须是整数。')
  }

  if (value < 1 || value > MAX_ALLOWED_RESULTS) {
    throw new Error(`maxResults 必须在 1 到 ${MAX_ALLOWED_RESULTS} 之间。`)
  }

  return value
}

function resolveWorkspacePath(requestedPath: string) {
  const resolvedPath = path.resolve(WORKSPACE_ROOT, requestedPath)
  const relativePath = path.relative(WORKSPACE_ROOT, resolvedPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('只允许搜索当前工作区内的路径。')
  }

  return {
    resolvedPath,
    relativePath: relativePath || '.',
  }
}

function shouldIgnoreDirectory(name: string) {
  return IGNORED_DIRECTORIES.has(name)
}

function createComparableText(text: string, caseSensitive: boolean) {
  return caseSensitive ? text : text.toLowerCase()
}

function buildLinePreview(line: string, maxLength = 240) {
  const normalized = line.trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength)}...`
}

interface FileMatch {
  path: string
  line: number
  column: number
  preview: string
}

async function collectMatchesFromFile(
  resolvedPath: string,
  relativePath: string,
  comparableQuery: string,
  caseSensitive: boolean,
  maxResults: number,
) {
  const matches: FileMatch[] = []
  const fileStat = await stat(resolvedPath)

  if (!fileStat.isFile() || fileStat.size > MAX_FILE_SIZE_BYTES) {
    return matches
  }

  let content = ''

  try {
    content = await readFile(resolvedPath, 'utf8')
  }
  catch {
    return matches
  }

  const lines = content.split(REGEX_LINE_SPLIT)

  for (let index = 0; index < lines.length; index += 1) {
    if (matches.length >= maxResults) {
      return matches
    }

    const line = lines[index] ?? ''
    const comparableLine = createComparableText(line, caseSensitive)
    const columnIndex = comparableLine.indexOf(comparableQuery)

    if (columnIndex === -1) {
      continue
    }

    matches.push({
      path: relativePath,
      line: index + 1,
      column: columnIndex + 1,
      preview: buildLinePreview(line),
    })
  }

  return matches
}

async function searchDirectory(
  resolvedPath: string,
  relativePath: string,
  comparableQuery: string,
  caseSensitive: boolean,
  maxResults: number,
) {
  const matches: FileMatch[] = []
  let truncated = false

  async function _visit(currentResolvedPath: string, currentRelativePath: string): Promise<void> {
    if (matches.length >= maxResults) {
      truncated = true
      return
    }

    const currentStat = await stat(currentResolvedPath)

    if (currentStat.isFile()) {
      const fileMatches = await collectMatchesFromFile(
        currentResolvedPath,
        currentRelativePath,
        comparableQuery,
        caseSensitive,
        maxResults - matches.length,
      )

      matches.push(...fileMatches)

      if (matches.length >= maxResults) {
        truncated = true
      }

      return
    }

    if (!currentStat.isDirectory()) {
      return
    }

    const directoryEntries = await readdir(currentResolvedPath, { withFileTypes: true })
    const sortedEntries = directoryEntries.toSorted((a, b) => a.name.localeCompare(b.name))

    for (const entry of sortedEntries) {
      if (matches.length >= maxResults) {
        truncated = true
        return
      }

      if (entry.isDirectory() && shouldIgnoreDirectory(entry.name)) {
        continue
      }

      const nextResolvedPath = path.join(currentResolvedPath, entry.name)
      const nextRelativePath = currentRelativePath === '.'
        ? entry.name
        : path.join(currentRelativePath, entry.name)

      await _visit(nextResolvedPath, nextRelativePath)
    }
  }

  await _visit(resolvedPath, relativePath)

  return {
    matches,
    truncated,
  }
}

export const searchInFilesTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'searchInFiles',
      description: '在当前工作区的文件内容中按关键词搜索。需要定位某个变量、函数、文案或配置出现在哪里时使用。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '要搜索的关键词，例如 MAX_TOOL_STEPS、readLocalFile 或 OPENAI_MODEL。',
          },
          path: {
            type: 'string',
            description: '可选，限制搜索范围，相对当前工作区根目录，默认是 .',
          },
          caseSensitive: {
            type: 'boolean',
            description: '可选，是否大小写敏感，默认 false。',
          },
          maxResults: {
            type: 'integer',
            description: `可选，最多返回多少条匹配结果，默认 ${DEFAULT_MAX_RESULTS}。`,
            minimum: 1,
            maximum: MAX_ALLOWED_RESULTS,
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const query = getQuery(args.query)
    const requestedPath = getRequestedPath(args.path)
    const caseSensitive = getCaseSensitive(args.caseSensitive)
    const maxResults = getMaxResults(args.maxResults)
    const comparableQuery = createComparableText(query, caseSensitive)
    const { resolvedPath, relativePath } = resolveWorkspacePath(requestedPath)
    const { matches, truncated } = await searchDirectory(
      resolvedPath,
      relativePath,
      comparableQuery,
      caseSensitive,
      maxResults,
    )

    return {
      query,
      basePath: relativePath,
      caseSensitive,
      maxResults,
      totalMatches: matches.length,
      truncated,
      matches,
    }
  },
}

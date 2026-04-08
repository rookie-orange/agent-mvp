import type { AgentTool } from '@/types'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { getBooleanOption, getIntegerOption, getNonEmptyString, getPathWithDefault } from './args'
import { resolveWorkspacePath } from './workspace'

const DEFAULT_MAX_RESULTS = 30
const MAX_ALLOWED_RESULTS = 200
const MAX_FILE_SIZE_BYTES = 256 * 1024
const IGNORED_DIRECTORIES = new Set(['.git', 'dist', 'node_modules'])
const REGEX_LINE_SPLIT = /\r?\n/

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

  async function visit(currentResolvedPath: string, currentRelativePath: string): Promise<void> {
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

      await visit(nextResolvedPath, nextRelativePath)
    }
  }

  await visit(resolvedPath, relativePath)

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
    const query = getNonEmptyString(args.query, 'query')
    const requestedPath = getPathWithDefault(args.path)
    const caseSensitive = getBooleanOption(args.caseSensitive, 'caseSensitive', false)
    const maxResults = getIntegerOption(args.maxResults, 'maxResults', {
      fallback: DEFAULT_MAX_RESULTS,
      min: 1,
      max: MAX_ALLOWED_RESULTS,
    })!
    const comparableQuery = createComparableText(query, caseSensitive)
    const { resolvedPath, relativePath } = resolveWorkspacePath(
      requestedPath,
      '只允许搜索当前工作区内的路径。',
    )
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

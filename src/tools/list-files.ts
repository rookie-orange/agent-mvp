import type { AgentTool } from '@/types'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isNumber, isString } from '@/shared/general'

const WORKSPACE_ROOT = process.cwd()
const DEFAULT_MAX_ENTRIES = 200
const MAX_ALLOWED_ENTRIES = 1000
const IGNORED_DIRECTORIES = new Set(['.git', 'dist', 'node_modules'])

function getRequestedPath(value: unknown) {
  if (value === undefined) {
    return '.'
  }

  if (!isString(value) || !value.trim()) {
    throw new Error('path 必须是非空字符串。')
  }

  return value.trim()
}

function getRecursive(value: unknown) {
  if (value === undefined) {
    return true
  }

  if (typeof value !== 'boolean') {
    throw new TypeError('recursive 必须是布尔值。')
  }

  return value
}

function getMaxEntries(value: unknown) {
  if (value === undefined) {
    return DEFAULT_MAX_ENTRIES
  }

  if (!isNumber(value) || !Number.isInteger(value)) {
    throw new Error('maxEntries 必须是整数。')
  }

  if (value < 1 || value > MAX_ALLOWED_ENTRIES) {
    throw new Error(`maxEntries 必须在 1 到 ${MAX_ALLOWED_ENTRIES} 之间。`)
  }

  return value
}

function resolveWorkspacePath(requestedPath: string) {
  const resolvedPath = path.resolve(WORKSPACE_ROOT, requestedPath)
  const relativePath = path.relative(WORKSPACE_ROOT, resolvedPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('只允许读取当前工作区内的路径。')
  }

  return {
    resolvedPath,
    relativePath: relativePath || '.',
  }
}

function shouldIgnoreDirectory(name: string) {
  return IGNORED_DIRECTORIES.has(name)
}

async function walkDirectory(
  resolvedPath: string,
  relativePath: string,
  recursive: boolean,
  maxEntries: number,
) {
  const results: string[] = []
  let truncated = false

  async function visitDirectory(currentResolvedPath: string, currentRelativePath: string): Promise<void> {
    if (results.length >= maxEntries) {
      truncated = true
      return
    }

    const directoryEntries = await readdir(currentResolvedPath, { withFileTypes: true })
    const sortedEntries = directoryEntries.toSorted((a, b) => a.name.localeCompare(b.name))

    for (const entry of sortedEntries) {
      if (results.length >= maxEntries) {
        truncated = true
        return
      }

      const nextResolvedPath = path.join(currentResolvedPath, entry.name)
      const nextRelativePath = currentRelativePath === '.'
        ? entry.name
        : path.join(currentRelativePath, entry.name)

      if (entry.isDirectory()) {
        if (shouldIgnoreDirectory(entry.name)) {
          continue
        }

        results.push(`${nextRelativePath}/`)

        if (results.length >= maxEntries) {
          truncated = true
          return
        }

        if (recursive) {
          await visitDirectory(nextResolvedPath, nextRelativePath)
        }

        continue
      }

      if (entry.isFile()) {
        results.push(nextRelativePath)
      }
    }
  }

  await visitDirectory(resolvedPath, relativePath)

  return {
    entries: results,
    truncated,
  }
}

export const listFilesTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'listFiles',
      description: '列出当前工作区中的文件或目录。需要先查找有哪些文件、定位某个目录下有什么内容时使用。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '可选，起始目录路径，相对当前工作区根目录，默认是 .',
          },
          recursive: {
            type: 'boolean',
            description: '可选，是否递归列出子目录，默认 true。',
          },
          maxEntries: {
            type: 'integer',
            description: `可选，最多返回多少条结果，默认 ${DEFAULT_MAX_ENTRIES}。`,
            minimum: 1,
            maximum: MAX_ALLOWED_ENTRIES,
          },
        },
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const requestedPath = getRequestedPath(args.path)
    const recursive = getRecursive(args.recursive)
    const maxEntries = getMaxEntries(args.maxEntries)
    const { resolvedPath, relativePath } = resolveWorkspacePath(requestedPath)
    const targetStat = await stat(resolvedPath)

    if (targetStat.isFile()) {
      return {
        basePath: relativePath,
        recursive: false,
        maxEntries,
        totalEntries: 1,
        truncated: false,
        entries: [relativePath],
      }
    }

    if (!targetStat.isDirectory()) {
      throw new Error(`目标不是文件或目录: ${relativePath}`)
    }

    const { entries, truncated } = await walkDirectory(
      resolvedPath,
      relativePath,
      recursive,
      maxEntries,
    )

    return {
      basePath: relativePath,
      recursive,
      maxEntries,
      totalEntries: entries.length,
      truncated,
      entries,
    }
  },
}

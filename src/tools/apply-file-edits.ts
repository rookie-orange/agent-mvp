import type { AgentTool } from '@/types'
import { Buffer } from 'node:buffer'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isArray, isNumber, isObject, isString } from '@/shared/general'

const WORKSPACE_ROOT = process.cwd()

interface FileEdit {
  find: string
  replace: string
  replaceAll?: boolean
  expectedOccurrences?: number
}

function getRequestedPath(value: unknown) {
  if (!isString(value) || !value.trim()) {
    throw new Error('path 必须是非空字符串。')
  }

  return value.trim()
}

function getBooleanOption(value: unknown, fieldName: string, fallback: boolean) {
  if (value === undefined) {
    return fallback
  }

  if (typeof value !== 'boolean') {
    throw new TypeError(`${fieldName} 必须是布尔值。`)
  }

  return value
}

function getExpectedOccurrences(value: unknown, fallback?: number) {
  if (value === undefined) {
    return fallback
  }

  if (!isNumber(value) || !Number.isInteger(value) || value < 0) {
    throw new Error('expectedOccurrences 必须是大于等于 0 的整数。')
  }

  return value
}

function resolveWorkspacePath(requestedPath: string) {
  const resolvedPath = path.resolve(WORKSPACE_ROOT, requestedPath)
  const relativePath = path.relative(WORKSPACE_ROOT, resolvedPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('只允许修改当前工作区内的文件。')
  }

  return {
    resolvedPath,
    relativePath: relativePath || '.',
  }
}

function countOccurrences(content: string, target: string) {
  if (!target) {
    return 0
  }

  let count = 0
  let startIndex = 0

  while (true) {
    const index = content.indexOf(target, startIndex)

    if (index === -1) {
      return count
    }

    count += 1
    startIndex = index + target.length
  }
}

function replaceFirstOccurrence(content: string, find: string, replace: string) {
  const index = content.indexOf(find)

  if (index === -1) {
    return content
  }

  return `${content.slice(0, index)}${replace}${content.slice(index + find.length)}`
}

function parseEdits(value: unknown): FileEdit[] {
  if (!isArray(value) || value.length === 0) {
    throw new Error('edits 必须是非空数组。')
  }

  return value.map((item, index) => {
    if (!isObject(item)) {
      throw new Error(`edits[${index}] 必须是对象。`)
    }

    if (!isString(item.find)) {
      throw new Error(`edits[${index}].find 必须是字符串。`)
    }

    if (!isString(item.replace)) {
      throw new Error(`edits[${index}].replace 必须是字符串。`)
    }

    const edit: FileEdit = {
      find: item.find,
      replace: item.replace,
    }

    if (item.replaceAll !== undefined) {
      edit.replaceAll = getBooleanOption(item.replaceAll, `edits[${index}].replaceAll`, false)
    }

    const expectedOccurrences = getExpectedOccurrences(item.expectedOccurrences)

    if (expectedOccurrences !== undefined) {
      edit.expectedOccurrences = expectedOccurrences
    }

    return edit
  })
}

export const applyFileEditsTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'applyFileEdits',
      description: '对单个文件按顺序应用多个精确字符串替换，适合一次提交多个小补丁式修改。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '目标文件路径，相对当前工作区根目录。',
          },
          edits: {
            type: 'array',
            description: '要顺序应用的编辑列表。',
            items: {
              type: 'object',
              properties: {
                find: {
                  type: 'string',
                  description: '要查找的原始文本。',
                },
                replace: {
                  type: 'string',
                  description: '替换后的文本。',
                },
                replaceAll: {
                  type: 'boolean',
                  description: '可选，是否替换所有匹配项，默认 false。',
                },
                expectedOccurrences: {
                  type: 'integer',
                  description: '可选，期望匹配次数。',
                  minimum: 0,
                },
              },
              required: ['find', 'replace'],
              additionalProperties: false,
            },
          },
        },
        required: ['path', 'edits'],
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const requestedPath = getRequestedPath(args.path)
    const edits = parseEdits(args.edits)
    const { resolvedPath, relativePath } = resolveWorkspacePath(requestedPath)
    const fileStat = await stat(resolvedPath)

    if (!fileStat.isFile()) {
      throw new Error(`目标不是文件: ${relativePath}`)
    }

    const originalContent = await readFile(resolvedPath, 'utf8')
    let nextContent = originalContent
    let totalReplacements = 0
    const appliedEdits: Array<{ index: number, replacedOccurrences: number }> = []

    for (let index = 0; index < edits.length; index += 1) {
      const edit = edits[index]

      if (!edit) {
        continue
      }

      if (!edit.find) {
        throw new Error(`edits[${index}].find 不能为空字符串。`)
      }

      const replaceAll = edit.replaceAll ?? false
      const actualOccurrences = countOccurrences(nextContent, edit.find)
      const expectedOccurrences = edit.expectedOccurrences ?? (replaceAll ? undefined : 1)

      if (actualOccurrences === 0) {
        throw new Error(`edits[${index}] 未在文件中找到要替换的内容。`)
      }

      if (expectedOccurrences !== undefined && actualOccurrences !== expectedOccurrences) {
        throw new Error(`edits[${index}] 匹配次数不符合预期。期望 ${expectedOccurrences} 次，实际 ${actualOccurrences} 次。`)
      }

      nextContent = replaceAll
        ? nextContent.split(edit.find).join(edit.replace)
        : replaceFirstOccurrence(nextContent, edit.find, edit.replace)

      const replacedOccurrences = replaceAll ? actualOccurrences : 1
      totalReplacements += replacedOccurrences
      appliedEdits.push({
        index,
        replacedOccurrences,
      })
    }

    if (nextContent === originalContent) {
      throw new Error('应用编辑后文件内容没有变化。')
    }

    await writeFile(resolvedPath, nextContent, 'utf8')

    return {
      path: relativePath,
      editsApplied: appliedEdits.length,
      totalReplacements,
      appliedEdits,
      bytesDelta: Buffer.byteLength(nextContent, 'utf8') - Buffer.byteLength(originalContent, 'utf8'),
    }
  },
}

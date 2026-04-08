import type { AgentTool } from '@/types'
import { isArray, isNumber, isObject, isString } from '@/shared/general'
import { readWorkspaceFile } from './read-local-file'

const DEFAULT_MAX_FILES = 5
const MAX_ALLOWED_FILES = 10

interface ReadMultipleFilesItem {
  path: string
  startLine?: number
  endLine?: number
}

function getMaxFiles(value: unknown) {
  if (value === undefined) {
    return DEFAULT_MAX_FILES
  }

  if (!isNumber(value) || !Number.isInteger(value)) {
    throw new Error('maxFiles 必须是整数。')
  }

  if (value < 1 || value > MAX_ALLOWED_FILES) {
    throw new Error(`maxFiles 必须在 1 到 ${MAX_ALLOWED_FILES} 之间。`)
  }

  return value
}

function getOptionalLineNumber(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined
  }

  if (!isNumber(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} 必须是大于等于 1 的整数。`)
  }

  return value
}

function parseFiles(value: unknown, maxFiles: number): ReadMultipleFilesItem[] {
  if (!isArray(value) || value.length === 0) {
    throw new Error('files 必须是非空数组。')
  }

  if (value.length > maxFiles) {
    throw new Error(`本次最多只能读取 ${maxFiles} 个文件。`)
  }

  return value.map((item, index) => {
    if (!isObject(item)) {
      throw new Error(`files[${index}] 必须是对象。`)
    }

    if (!isString(item.path) || !item.path.trim()) {
      throw new Error(`files[${index}].path 必须是非空字符串。`)
    }

    const normalizedItem: ReadMultipleFilesItem = {
      path: item.path.trim(),
    }

    const startLine = getOptionalLineNumber(item.startLine, `files[${index}].startLine`)
    const endLine = getOptionalLineNumber(item.endLine, `files[${index}].endLine`)

    if (startLine !== undefined) {
      normalizedItem.startLine = startLine
    }

    if (endLine !== undefined) {
      normalizedItem.endLine = endLine
    }

    return normalizedItem
  })
}

export const readMultipleFilesTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'readMultipleFiles',
      description: '一次读取多个当前工作区内的文本文件。需要对比多个文件、汇总几个实现或同时查看多个配置时使用。',
      parameters: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            description: '要读取的文件列表。',
            items: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: '文件路径，相对当前工作区根目录。',
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
          maxFiles: {
            type: 'integer',
            description: `可选，最多允许读取多少个文件，默认 ${DEFAULT_MAX_FILES}。`,
            minimum: 1,
            maximum: MAX_ALLOWED_FILES,
          },
        },
        required: ['files'],
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const maxFiles = getMaxFiles(args.maxFiles)
    const files = parseFiles(args.files, maxFiles)
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const result = await readWorkspaceFile(file)

          return {
            ok: true,
            ...result,
          }
        }
        catch (error: unknown) {
          const message = error instanceof Error ? error.message : '文件读取失败'

          return {
            ok: false,
            path: file.path,
            error: message,
          }
        }
      }),
    )

    return {
      totalFiles: files.length,
      successCount: results.filter(result => result.ok).length,
      failureCount: results.filter(result => !result.ok).length,
      results,
    }
  },
}

import type { AgentTool } from '@/types'
import { getIntegerOption, getNonEmptyString } from './args'
import { listBackups } from './backup-store'

const DEFAULT_MAX_ENTRIES = 10
const MAX_ALLOWED_ENTRIES = 50

export const listBackupsTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'listBackups',
      description: '列出当前工作区最近创建的文件备份。适合查看有哪些可回滚的历史修改。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '可选，只列出某个文件或目录范围相关的备份，相对当前工作区根目录。',
          },
          operation: {
            type: 'string',
            description: '可选，只列出某种操作生成的备份，例如 writeFile、replaceInFile、moveFile。',
          },
          maxEntries: {
            type: 'integer',
            description: `可选，最多返回多少条备份，默认 ${DEFAULT_MAX_ENTRIES}。`,
            minimum: 1,
            maximum: MAX_ALLOWED_ENTRIES,
          },
        },
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const path = args.path === undefined ? undefined : getNonEmptyString(args.path, 'path')
    const operation = args.operation === undefined ? undefined : getNonEmptyString(args.operation, 'operation')
    const maxEntries = getIntegerOption(args.maxEntries, 'maxEntries', {
      fallback: DEFAULT_MAX_ENTRIES,
      min: 1,
      max: MAX_ALLOWED_ENTRIES,
    })!

    const input: {
      path?: string
      operation?: string
      maxEntries: number
    } = {
      maxEntries,
    }

    if (path !== undefined) {
      input.path = path
    }

    if (operation !== undefined) {
      input.operation = operation
    }

    return await listBackups(input)
  },
}

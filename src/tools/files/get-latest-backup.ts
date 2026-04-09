import type { AgentTool } from '@/types'
import { getNonEmptyString } from './args'
import { getLatestBackup } from './backup-store'

export const getLatestBackupTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'getLatestBackup',
      description: '获取当前工作区最近一次创建的备份。适合在用户要求“撤销上一步”时先定位最新 backupId。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '可选，只在某个文件或目录范围内查找最新备份，相对当前工作区根目录。',
          },
          operation: {
            type: 'string',
            description: '可选，只在某种操作类型中查找最新备份，例如 writeFile、replaceInFile、moveFile。',
          },
        },
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const path = args.path === undefined ? undefined : getNonEmptyString(args.path, 'path')
    const operation = args.operation === undefined ? undefined : getNonEmptyString(args.operation, 'operation')

    const query: {
      path?: string
      operation?: string
    } = {}

    if (path !== undefined) {
      query.path = path
    }

    if (operation !== undefined) {
      query.operation = operation
    }

    return await getLatestBackup(query)
  },
}

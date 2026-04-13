import type { AgentTool } from '@/types'
import { getNonEmptyString } from './args'
import { requestFileMutationApproval } from './approval'
import { rollbackLatestBackup } from './backup-store'

export const rollbackLatestTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'rollbackLatest',
      description: '回滚最近一次匹配条件的文件修改。适合用户要求“撤销上一步”或“回滚最近一次修改”时直接使用。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '可选，只在某个文件或目录范围内查找最近一次备份并回滚，相对当前工作区根目录。',
          },
          operation: {
            type: 'string',
            description: '可选，只在某种操作类型中查找最近一次备份并回滚，例如 writeFile、replaceInFile、moveFile。',
          },
        },
        additionalProperties: false,
      },
    },
  },
  execute: async (args, context) => {
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

    const scopeSummary = [
      path ? `路径 ${path}` : '',
      operation ? `操作 ${operation}` : '',
    ].filter(Boolean).join('，')

    await requestFileMutationApproval(context, {
      toolName: 'rollbackLatest',
      summary: scopeSummary ? `回滚最近一次备份（${scopeSummary}）` : '回滚最近一次备份',
      paths: path ? [path] : [],
    })

    return await rollbackLatestBackup(query)
  },
}

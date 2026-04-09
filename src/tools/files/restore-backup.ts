import type { AgentTool } from '@/types'
import { getNonEmptyString } from './args'
import { restoreBackup } from './backup-store'

export const restoreBackupTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'restoreBackup',
      description: '按 backupId 恢复之前自动创建的文件备份。适合撤销刚刚执行的写入、替换、移动或删除操作。',
      parameters: {
        type: 'object',
        properties: {
          backupId: {
            type: 'string',
            description: '之前某个写操作返回的 backupId。',
          },
        },
        required: ['backupId'],
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const backupId = getNonEmptyString(args.backupId, 'backupId')

    return await restoreBackup({ backupId })
  },
}

import type { AgentTool } from '@/types'
import { getIntegerOption, getNonEmptyString } from '../files/args'
import { getAllowedCommandNames, runAllowedCommand } from './shared'

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 120_000

export const runCommandTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'runCommand',
      description: '运行白名单内的项目命令。当前只支持 pnpm typecheck、pnpm build、pnpm test。',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: '要执行的白名单命令。',
            enum: getAllowedCommandNames(),
          },
          timeoutMs: {
            type: 'integer',
            description: `可选，命令超时毫秒数，默认 ${DEFAULT_TIMEOUT_MS}。`,
            minimum: 1_000,
            maximum: MAX_TIMEOUT_MS,
          },
        },
        required: ['command'],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, context) => {
    const command = getNonEmptyString(args.command, 'command')
    const timeoutMs = getIntegerOption(args.timeoutMs, 'timeoutMs', {
      fallback: DEFAULT_TIMEOUT_MS,
      min: 1_000,
      max: MAX_TIMEOUT_MS,
    })

    return await runAllowedCommand(command, {
      context,
      requireApproval: true,
      approvalToolName: 'runCommand',
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    })
  },
}

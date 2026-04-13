import type { AgentTool } from '@/types'
import { getBooleanOption, getIntegerOption } from '../files/args'
import { runWorkspaceValidation } from './shared'

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 120_000

export const validateWorkspaceTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'validateWorkspace',
      description: '运行工作区验证。默认执行 pnpm typecheck 和 pnpm build，可选加上 pnpm test。',
      parameters: {
        type: 'object',
        properties: {
          typecheck: {
            type: 'boolean',
            description: '可选，是否运行 pnpm typecheck，默认 true。',
          },
          build: {
            type: 'boolean',
            description: '可选，是否运行 pnpm build，默认 true。',
          },
          test: {
            type: 'boolean',
            description: '可选，是否运行 pnpm test，默认 false。',
          },
          timeoutMsPerCommand: {
            type: 'integer',
            description: `可选，每条验证命令的超时毫秒数，默认 ${DEFAULT_TIMEOUT_MS}。`,
            minimum: 1_000,
            maximum: MAX_TIMEOUT_MS,
          },
        },
        additionalProperties: false,
      },
    },
  },
  execute: async (args, context) => {
    const typecheck = getBooleanOption(args.typecheck, 'typecheck', true)
    const build = getBooleanOption(args.build, 'build', true)
    const test = getBooleanOption(args.test, 'test', false)
    const timeoutMsPerCommand = getIntegerOption(args.timeoutMsPerCommand, 'timeoutMsPerCommand', {
      fallback: DEFAULT_TIMEOUT_MS,
      min: 1_000,
      max: MAX_TIMEOUT_MS,
    })

    return await runWorkspaceValidation({
      context,
      requireApproval: true,
      typecheck,
      build,
      test,
      ...(timeoutMsPerCommand === undefined ? {} : { timeoutMsPerCommand }),
    })
  },
}

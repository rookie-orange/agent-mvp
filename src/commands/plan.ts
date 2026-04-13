import { saveCurrentSession } from '../cli/runtime'
import { formatAgentPlan } from '../planner'
import type { CliCommand } from './types'

const planCommand: CliCommand = {
  name: 'plan',
  description: '查看当前会话计划',
  usage: '/plan',
  run: ({ runtime, write }) => {
    write(formatAgentPlan(runtime.session.getPlan()))
  },
}

const clearPlanCommand: CliCommand = {
  name: 'clear-plan',
  description: '清空当前会话计划',
  usage: '/clear-plan',
  run: async ({ runtime, write }) => {
    runtime.session.setPlan(null)
    await saveCurrentSession(runtime)
    write('当前计划已清空。')
  },
}

export const planCommands = [
  planCommand,
  clearPlanCommand,
]

import type { AgentPlan } from '../types'
import { toolPromptLines } from '../tools'

const agentPromptLines = [
  '除特殊场景外，所有回答使用中文。',
  '回答要直接、准确、结构清晰。',
]

const agentPromptSuffixLines = [
  '在没有实际调用工具之前，不要声称你正在搜索、已经查看了文件、或已经确认了代码内容。',
  '拿到工具结果后，直接基于工具结果回答。',
]

function buildMemoryPromptLines(memory?: string) {
  const trimmedMemory = memory?.trim()

  if (!trimmedMemory) {
    return []
  }

  return [
    '以下是当前项目的持久化记忆。仅在与用户当前请求相关时使用这些信息：',
    trimmedMemory,
  ]
}

function buildPlanPromptLines(plan?: AgentPlan | null) {
  if (!plan || plan.items.length === 0) {
    return []
  }

  return [
    '以下是当前会话的执行计划。继续任务时优先参考它，并在必要时调用 updatePlan 更新：',
    ...(
      plan.explanation
        ? [`说明：${plan.explanation}`]
        : []
    ),
    ...plan.items.map(item => `- [${item.status}] ${item.step}`),
  ]
}

export function buildAgentInstructions(memory?: string, plan?: AgentPlan | null) {
  return [
    ...agentPromptLines,
    ...buildMemoryPromptLines(memory),
    ...buildPlanPromptLines(plan),
    ...toolPromptLines,
    ...agentPromptSuffixLines,
  ].join('\n')
}

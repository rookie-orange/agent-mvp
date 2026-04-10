import { toolPromptLines } from '../tools'

const agentPromptLines = [
  '你是一个正在帮助用户学习 AI Agent 开发的简洁助手。',
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

export function buildAgentInstructions(memory?: string) {
  return [
    ...agentPromptLines,
    ...buildMemoryPromptLines(memory),
    ...toolPromptLines,
    ...agentPromptSuffixLines,
  ].join('\n')
}

import type { AgentRunInput } from '../types/agent.js'
import { createResponse } from '../llm/openai.js'

function buildInstructions() {
  return [
    '你是一个正在帮助用户学习 AI Agent 开发的简洁助手。',
    '回答要直接、准确、结构清晰。',
    '当前阶段是最小可运行版本，不要假装自己具备工具调用能力。',
  ].join('\n')
}

export async function runAgent(input: AgentRunInput) {
  const response = await createResponse({
    instructions: buildInstructions(),
    input,
  })

  return response.choices[0]!.message.content
}

import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import type {
  AgentRunInput,
} from '../types/agent.js'
import { createResponse } from '../llm/openai.js'
import { executeToolCalls, toolDefinitions } from '../tools/index.js'

const MAX_TOOL_STEPS = 3

function buildInstructions() {
  return [
    '你是一个正在帮助用户学习 AI Agent 开发的简洁助手。',
    '回答要直接、准确、结构清晰。',
    '当用户的问题需要获取当前时间、日期或星期时，调用可用工具，不要猜测。',
    '拿到工具结果后，直接基于工具结果回答。',
  ].join('\n')
}

function createInitialMessages(input: AgentRunInput): ChatCompletionMessageParam[] {
  return [
    { role: 'system', content: buildInstructions() },
    { role: 'user', content: input },
  ]
}

function getTextContent(message: ChatCompletionMessage) {
  return message.content?.trim() || ''
}

function toAssistantMessage(message: ChatCompletionMessage): ChatCompletionAssistantMessageParam {
  const assistantMessage: ChatCompletionAssistantMessageParam = {
    role: 'assistant',
    content: message.content,
  }

  if (message.tool_calls) {
    assistantMessage.tool_calls = message.tool_calls
  }

  return assistantMessage
}

function trace(message: string) {
  console.error(`[agent] ${message}`)
}

export async function runAgent(input: AgentRunInput) {
  const messages = createInitialMessages(input)

  trace(`收到用户输入: ${input}`)

  for (let step = 1; step <= MAX_TOOL_STEPS; step += 1) {
    trace(`第 ${step} 步：请求模型`)

    const response = await createResponse({
      messages,
      tools: toolDefinitions,
    })

    const choice = response.choices[0]

    if (!choice) {
      throw new Error('模型没有返回任何候选结果。')
    }

    const assistantMessage = choice.message
    messages.push(toAssistantMessage(assistantMessage))

    const toolCalls = assistantMessage.tool_calls ?? []

    if (toolCalls.length === 0) {
      const finalAnswer = getTextContent(assistantMessage)

      if (!finalAnswer) {
        throw new Error('模型没有返回可展示的文本结果。')
      }

      trace(`最终回答: ${finalAnswer}`)
      return finalAnswer
    }

    trace(`模型请求调用 ${toolCalls.length} 个工具`)

    for (const toolCall of toolCalls) {
      if (toolCall.type === 'function') {
        trace(`调用工具 ${toolCall.function.name}，参数: ${toolCall.function.arguments || '{}'}`)
      }
    }

    const toolMessages = await executeToolCalls(toolCalls)

    for (const toolMessage of toolMessages) {
      trace(`工具返回: ${toolMessage.content}`)
      messages.push(toolMessage)
    }
  }

  throw new Error(`超过最大工具调用步数 ${MAX_TOOL_STEPS}，Agent 已停止。`)
}

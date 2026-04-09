import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import type {
  AgentRunInput,
  AgentRunOptions,
  AgentSession,
} from '../types'
import { createResponse } from '../llm'
import { executeToolCalls, toolDefinitions, toolPromptLines } from '../tools'

/**
 * Agent max tool calling steps
 */
const MAX_TOOL_STEPS = 10

function buildInstructions() {
  return [
    '你是一个正在帮助用户学习 AI Agent 开发的简洁助手。',
    '回答要直接、准确、结构清晰。',
    ...toolPromptLines,
    '在没有实际调用工具之前，不要声称你正在搜索、已经查看了文件、或已经确认了代码内容。',
    '拿到工具结果后，直接基于工具结果回答。',
  ].join('\n')
}

function createBaseMessages(): ChatCompletionMessageParam[] {
  return [{ role: 'system', content: buildInstructions() }]
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

function createTracer(onTrace?: AgentRunOptions['onTrace']) {
  if (!onTrace) {
    return () => {}
  }

  return (message: string) => {
    onTrace(`[agent] ${message}`)
  }
}

function previewText(text: string, maxLength = 400) {
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength)}... [已省略剩余内容]`
}

function previewToolMessageContent(content: ChatCompletionAssistantMessageParam['content'] | string) {
  if (typeof content === 'string') {
    return previewText(content)
  }

  return previewText(JSON.stringify(content))
}

async function runTurn(
  messages: ChatCompletionMessageParam[],
  input: AgentRunInput,
  trace: ReturnType<typeof createTracer>,
) {
  messages.push({ role: 'user', content: input })

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
      trace(`工具返回: ${previewToolMessageContent(toolMessage.content)}`)
      messages.push(toolMessage)
    }
  }

  throw new Error(`超过最大工具调用步数 ${MAX_TOOL_STEPS}，Agent 已停止。`)
}

export function createAgentSession(options: AgentRunOptions = {}): AgentSession {
  const trace = createTracer(options.onTrace)
  let messages = createBaseMessages()

  return {
    runTurn: async input => await runTurn(messages, input, trace),
    reset: () => {
      messages = createBaseMessages()
    },
  }
}

export async function runAgent(input: AgentRunInput, options: AgentRunOptions = {}) {
  const session = createAgentSession(options)

  return await session.runTurn(input)
}

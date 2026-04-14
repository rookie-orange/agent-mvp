import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import type {
  AgentPlan,
  AgentRunInput,
  AgentRunOptions,
  AgentSession,
  ToolExecutionContext,
  ToolExecutionTurnState,
} from '../types'
import { createResponse } from '../llm'
import { executeToolCalls, toolDefinitions } from '../tools'
import { buildAgentInstructions } from './prompt'

const MAX_TOOL_STEPS = 30

function createBaseMessages(memory?: string, plan?: AgentPlan | null): ChatCompletionMessageParam[] {
  return [{ role: 'system', content: buildAgentInstructions(memory, plan) }]
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

function createTurnToolContext(toolContext: ToolExecutionContext): ToolExecutionContext {
  const turnState: ToolExecutionTurnState = {
    approvedMutationKeys: new Set(),
  }

  return {
    ...toolContext,
    turnState,
  }
}

async function runTurn(
  conversationMessages: ChatCompletionMessageParam[],
  input: AgentRunInput,
  trace: ReturnType<typeof createTracer>,
  toolContext: ToolExecutionContext,
  plan: AgentPlan | null,
  memory?: string,
) {
  const turnToolContext = createTurnToolContext(toolContext)
  const messages = [
    ...createBaseMessages(memory, plan),
    ...conversationMessages,
    { role: 'user', content: input } satisfies ChatCompletionMessageParam,
  ]

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
      return {
        finalAnswer,
        conversationMessages: messages.slice(1),
      }
    }

    trace(`模型请求调用 ${toolCalls.length} 个工具`)

    for (const toolCall of toolCalls) {
      if (toolCall.type === 'function') {
        trace(`调用工具 ${toolCall.function.name}，参数: ${toolCall.function.arguments || '{}'}`)
      }
    }

    const toolMessages = await executeToolCalls(toolCalls, turnToolContext)

    for (const toolMessage of toolMessages) {
      trace(`工具返回: ${previewToolMessageContent(toolMessage.content)}`)
      messages.push(toolMessage)
    }
  }

  throw new Error(`超过最大工具调用步数 ${MAX_TOOL_STEPS}，Agent 已停止。`)
}

export function createAgentSession(options: AgentRunOptions = {}): AgentSession {
  const trace = createTracer(options.onTrace)
  let conversationMessages = options.conversationMessages?.slice() || []
  let memory = options.memory?.trim() || ''
  let plan = options.plan ?? null
  const externalToolContext = options.toolContext || {}
  const toolContext: ToolExecutionContext = {
    ...externalToolContext,
    getPlan: () => plan,
    setPlan: (nextPlan) => {
      plan = nextPlan
      externalToolContext.onPlanUpdated?.(nextPlan)
    },
  }

  return {
    runTurn: async (input) => {
      const result = await runTurn(conversationMessages, input, trace, toolContext, plan, memory)
      conversationMessages = result.conversationMessages
      return result.finalAnswer
    },
    reset: () => {
      conversationMessages = []
      plan = null
      externalToolContext.onPlanUpdated?.(null)
    },
    setMemory: (nextMemory) => {
      memory = nextMemory.trim()
    },
    getMemory: () => memory,
    setPlan: (nextPlan) => {
      plan = nextPlan
      externalToolContext.onPlanUpdated?.(nextPlan)
    },
    getPlan: () => plan,
    getConversationMessages: () => conversationMessages.slice(),
  }
}

import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import type {
  AgentRunInput,
} from '../types'
import { createResponse } from '../llm'
import { executeToolCalls, toolDefinitions } from '../tools'


/**
 * Agent max tool calling steps
 */
const MAX_TOOL_STEPS = 10

function buildInstructions() {
  return [
    '你是一个正在帮助用户学习 AI Agent 开发的简洁助手。',
    '回答要直接、准确、结构清晰。',
    '当用户的问题需要获取当前时间、日期或星期时，调用可用工具，不要猜测。',
    '当用户需要知道某个目录下有哪些文件、先定位项目结构或先找文件时，先调用 listFiles。',
    '当用户需要按关键词搜索、查找、定位某个变量、函数、配置或文案出现在哪里时，必须调用 searchInFiles。',
    '当用户要求查看、总结、解释当前工作区中的代码、配置或文档时，调用 readLocalFile 读取真实文件内容，不要臆测。',
    '当用户明确要求同时查看、比较、汇总多个文件时，优先调用 readMultipleFiles。',
    '当用户要求查看当前工作区有哪些 Git 改动时，调用 gitStatus。',
    '当用户要求查看具体改动 diff、补丁内容，或需要确认“刚才改了什么”时，调用 gitDiff。',
    '当用户要求创建新文件或在已知完整内容时重写文件，使用 writeFile。',
    '当用户要求对现有文件做小范围精确修改时，优先先读取文件，再使用 replaceInFile。',
    '当用户要求删除文件时，使用 deleteFile。',
    '当用户要求移动或重命名文件时，使用 moveFile。',
    '当用户要求对单个文件一次做多处精确修改时，优先使用 applyFileEdits。',
    '在没有实际调用工具之前，不要声称你正在搜索、已经查看了文件、或已经确认了代码内容。',
    '在修改文件之前，优先先读取相关文件内容，避免盲改。',
    '文件修改完成后，要基于工具返回的 validation 字段确认结果是否符合预期；validation 里的 Git 状态和 diff 也属于自检依据。',
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
      trace(`工具返回: ${previewToolMessageContent(toolMessage.content)}`)
      messages.push(toolMessage)
    }
  }

  throw new Error(`超过最大工具调用步数 ${MAX_TOOL_STEPS}，Agent 已停止。`)
}

import type {
  ChatCompletionFunctionTool,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions'

export type AgentRunInput = string

export interface CreateResponseParams {
  messages: ChatCompletionMessageParam[]
  tools: ChatCompletionTool[]
}

export interface AgentTool {
  definition: ChatCompletionFunctionTool
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown
}

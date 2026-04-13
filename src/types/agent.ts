import type {
  ChatCompletionFunctionTool,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions'

export type AgentRunInput = string

export interface ToolApprovalRequest {
  kind: 'file-mutation' | 'command-execution'
  toolName: string
  summary: string
  details?: string[]
}

export interface ToolExecutionContext {
  requestApproval?: (request: ToolApprovalRequest) => Promise<boolean>
}

export interface AgentRunOptions {
  onTrace?: (message: string) => void
  conversationMessages?: ChatCompletionMessageParam[]
  memory?: string
  toolContext?: ToolExecutionContext
}

export interface AgentSession {
  runTurn: (input: AgentRunInput) => Promise<string>
  reset: () => void
  setMemory: (memory: string) => void
  getMemory: () => string
  getConversationMessages: () => ChatCompletionMessageParam[]
}

export interface CreateResponseParams {
  messages: ChatCompletionMessageParam[]
  tools: ChatCompletionTool[]
}

export interface AgentTool {
  definition: ChatCompletionFunctionTool
  execute: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<unknown> | unknown
}

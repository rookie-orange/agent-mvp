import type {
  ChatCompletionFunctionTool,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions'

export type AgentRunInput = string

export type AgentPlanStepStatus = 'pending' | 'in_progress' | 'completed'

export interface AgentPlanStep {
  step: string
  status: AgentPlanStepStatus
}

export interface AgentPlan {
  explanation?: string
  items: AgentPlanStep[]
  updatedAt: string
}

export interface ToolApprovalRequest {
  kind: 'file-mutation' | 'command-execution'
  toolName: string
  summary: string
  details?: string[]
}

export interface ToolExecutionTurnState {
  approvedMutationKeys: Set<string>
}

export interface ToolExecutionContext {
  requestApproval?: (request: ToolApprovalRequest) => Promise<boolean>
  getPlan?: () => AgentPlan | null
  setPlan?: (plan: AgentPlan | null) => void
  onPlanUpdated?: (plan: AgentPlan | null) => void
  turnState?: ToolExecutionTurnState
}

export interface AgentRunOptions {
  onTrace?: (message: string) => void
  conversationMessages?: ChatCompletionMessageParam[]
  memory?: string
  plan?: AgentPlan | null
  toolContext?: ToolExecutionContext
}

export interface AgentToolExecutionRecord {
  step: number
  toolCallId: string
  toolName: string
  ok: boolean
  args: Record<string, unknown> | null
  result?: unknown
  error?: string
}

export interface AgentExecutionReportToolCall {
  step: number
  toolName: string
  status: 'success' | 'failed'
  note?: string
}

export interface AgentExecutionReportValidation {
  passed: boolean
  requestedCommands: string[]
  executedCommands: string[]
  failedCommands: string[]
  skippedCommands: string[]
}

export interface AgentExecutionReport {
  startedAt: string
  finishedAt: string
  durationMs: number
  totalToolCalls: number
  successfulToolCalls: number
  failedToolCalls: number
  toolCalls: AgentExecutionReportToolCall[]
  affectedPaths: string[]
  backupIds: string[]
  changeSummaryHeadline?: string
  changeSummaryNotes: string[]
  workspaceValidation?: AgentExecutionReportValidation
}

export interface AgentSession {
  runTurn: (input: AgentRunInput) => Promise<string>
  reset: () => void
  setMemory: (memory: string) => void
  getMemory: () => string
  setPlan: (plan: AgentPlan | null) => void
  getPlan: () => AgentPlan | null
  getConversationMessages: () => ChatCompletionMessageParam[]
  getLastExecutionReport: () => AgentExecutionReport | null
}

export interface CreateResponseParams {
  messages: ChatCompletionMessageParam[]
  tools: ChatCompletionTool[]
}

export interface AgentTool {
  definition: ChatCompletionFunctionTool
  execute: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<unknown> | unknown
}

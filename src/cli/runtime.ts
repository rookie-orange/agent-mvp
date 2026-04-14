import type { PersistedSessionData } from '../persistence/session-store'
import type { AgentPlan, AgentRunOptions, AgentSession, ToolExecutionContext } from '../types'
import { createAgentSession } from '../agent'
import {
  clearPersistedSession,
  createSessionId,
  createSessionTitle,
  savePersistedSession,
} from '../persistence'

export interface CliRuntime {
  session: AgentSession
  currentSessionId: string | null
  currentSessionTitle: string | null
  pendingSessionTitle: string | null
  requestApproval?: ToolExecutionContext['requestApproval']
  onPlanUpdated?: ToolExecutionContext['onPlanUpdated']
}

interface CreateCliRuntimeOptions {
  requestApproval?: ToolExecutionContext['requestApproval']
  onPlanUpdated?: ToolExecutionContext['onPlanUpdated']
}

function createRuntimeAgentSession(options: {
  memory: string
  conversationMessages?: AgentRunOptions['conversationMessages']
  plan?: AgentPlan | null
  requestApproval?: ToolExecutionContext['requestApproval']
  onPlanUpdated?: ToolExecutionContext['onPlanUpdated']
}) {
  const sessionOptions: AgentRunOptions = {
    memory: options.memory,
    onTrace: message => console.log(message),
  }

  if (options.conversationMessages) {
    sessionOptions.conversationMessages = options.conversationMessages
  }

  if (options.plan !== undefined) {
    sessionOptions.plan = options.plan
  }

  if (options.requestApproval || options.onPlanUpdated) {
    sessionOptions.toolContext = {}
  }

  if (options.requestApproval) {
    sessionOptions.toolContext!.requestApproval = options.requestApproval
  }

  if (options.onPlanUpdated) {
    sessionOptions.toolContext!.onPlanUpdated = options.onPlanUpdated
  }

  return createAgentSession(sessionOptions)
}

export function createCliRuntime(memory: string, options: CreateCliRuntimeOptions = {}): CliRuntime {
  return {
    session: createRuntimeAgentSession({
      memory,
      requestApproval: options.requestApproval,
      onPlanUpdated: options.onPlanUpdated,
    }),
    currentSessionId: null,
    currentSessionTitle: null,
    pendingSessionTitle: null,
    requestApproval: options.requestApproval,
    onPlanUpdated: options.onPlanUpdated,
  }
}

export function resetRuntimeSession(runtime: CliRuntime) {
  const memory = runtime.session.getMemory()
  runtime.session = createRuntimeAgentSession({
    memory,
    requestApproval: runtime.requestApproval,
    onPlanUpdated: runtime.onPlanUpdated,
  })
  runtime.currentSessionId = null
  runtime.currentSessionTitle = null
  runtime.pendingSessionTitle = null
}

export function startDraftSession(runtime: CliRuntime, title?: string) {
  resetRuntimeSession(runtime)
  runtime.pendingSessionTitle = title ? createSessionTitle(title) : null
}

export function loadSessionIntoRuntime(runtime: CliRuntime, session: PersistedSessionData) {
  runtime.session = createRuntimeAgentSession({
    memory: runtime.session.getMemory(),
    conversationMessages: session.conversationMessages,
    requestApproval: runtime.requestApproval,
    onPlanUpdated: runtime.onPlanUpdated,
    plan: session.plan ?? null,
  })
  runtime.currentSessionId = session.id
  runtime.currentSessionTitle = session.title
  runtime.pendingSessionTitle = null
}

export async function saveCurrentSession(runtime: CliRuntime) {
  if (!runtime.currentSessionId || !runtime.currentSessionTitle) {
    return
  }

  await savePersistedSession({
    id: runtime.currentSessionId,
    title: runtime.currentSessionTitle,
    conversationMessages: runtime.session.getConversationMessages(),
    plan: runtime.session.getPlan(),
  })
}

export async function runRuntimeTurn(runtime: CliRuntime, input: string) {
  const output = await runtime.session.runTurn(input)

  if (!runtime.currentSessionId) {
    runtime.currentSessionId = createSessionId()
    runtime.currentSessionTitle = runtime.pendingSessionTitle || createSessionTitle(input)
    runtime.pendingSessionTitle = null
  }

  await saveCurrentSession(runtime)

  return output
}

export async function renameRuntimeSession(runtime: CliRuntime, title: string) {
  const nextTitle = createSessionTitle(title)

  if (runtime.currentSessionId) {
    runtime.currentSessionTitle = nextTitle
    await saveCurrentSession(runtime)

    return {
      title: nextTitle,
      persisted: true,
    }
  }

  runtime.pendingSessionTitle = nextTitle

  return {
    title: nextTitle,
    persisted: false,
  }
}

export async function clearRuntimeSession(runtime: CliRuntime) {
  if (runtime.currentSessionId) {
    await clearPersistedSession(runtime.currentSessionId)
  }

  resetRuntimeSession(runtime)
}

export async function deleteRuntimeSession(runtime: CliRuntime, sessionId: string) {
  await clearPersistedSession(sessionId)

  if (runtime.currentSessionId === sessionId) {
    resetRuntimeSession(runtime)
  }
}

import type { PersistedSessionData } from '../persistence/session-store'
import type { AgentSession } from '../types'
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
}

export function createCliRuntime(memory: string): CliRuntime {
  return {
    session: createAgentSession({ memory }),
    currentSessionId: null,
    currentSessionTitle: null,
    pendingSessionTitle: null,
  }
}

export function resetRuntimeSession(runtime: CliRuntime) {
  const memory = runtime.session.getMemory()
  runtime.session = createAgentSession({ memory })
  runtime.currentSessionId = null
  runtime.currentSessionTitle = null
  runtime.pendingSessionTitle = null
}

export function startDraftSession(runtime: CliRuntime, title?: string) {
  resetRuntimeSession(runtime)
  runtime.pendingSessionTitle = title ? createSessionTitle(title) : null
}

export function loadSessionIntoRuntime(runtime: CliRuntime, session: PersistedSessionData) {
  runtime.session = createAgentSession({
    conversationMessages: session.conversationMessages,
    memory: runtime.session.getMemory(),
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
  })
}

export async function runAgentTurn(runtime: CliRuntime, input: string) {
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

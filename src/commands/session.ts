import type { PersistedSessionSummary } from '../persistence/session-store'
import type { CliCommand } from './types'
import {
  clearRuntimeSession,
  deleteRuntimeSession,
  loadSessionIntoRuntime,
  renameRuntimeSession,
  startDraftSession,
} from '../cli/runtime'
import {
  listPersistedSessions,
  loadPersistedSession,
} from '../persistence'

function formatSessionUpdatedAt(updatedAt: string) {
  const date = new Date(updatedAt)
  return Number.isNaN(date.getTime())
    ? updatedAt
    : date.toLocaleString('zh-CN', { hour12: false })
}

function printSessionList(
  sessions: PersistedSessionSummary[],
  currentSessionId: string | null,
  write: (message: string) => void,
) {
  if (sessions.length === 0) {
    write('当前没有已保存会话。')
    return
  }

  write('已保存会话：')

  for (const session of sessions) {
    const currentMark = session.id === currentSessionId ? '*' : ' '
    write(`${currentMark} ${session.id}  ${session.title}  ${session.messageCount} 条消息  ${formatSessionUpdatedAt(session.updatedAt)}`)
  }
}

const sessionsCommand: CliCommand = {
  name: 'sessions',
  description: '查看已保存会话',
  usage: '/sessions',
  run: async ({ runtime, write }) => {
    const sessions = await listPersistedSessions()
    printSessionList(sessions, runtime.currentSessionId, write)
  },
}

const loadCommand: CliCommand = {
  name: 'load',
  description: '加载指定会话',
  usage: '/load <session-id>',
  run: async ({ runtime, argsText, write }) => {
    const sessionId = argsText.trim()

    if (!sessionId) {
      write('请提供要加载的会话 ID。')
      return
    }

    const persistedSession = await loadPersistedSession(sessionId)

    if (!persistedSession) {
      write(`未找到会话：${sessionId}`)
      return
    }

    loadSessionIntoRuntime(runtime, persistedSession)
    write(`已加载会话：${persistedSession.id} (${persistedSession.title})，共 ${persistedSession.conversationMessages.length} 条消息。`)
  },
}

const newCommand: CliCommand = {
  name: 'new',
  description: '开始一个新会话草稿',
  usage: '/new [title]',
  run: ({ runtime, argsText, write }) => {
    const title = argsText.trim()
    startDraftSession(runtime, title || undefined)
    write(title ? `已开始新会话草稿：${title}` : '已开始新会话。')
  },
}

const renameCommand: CliCommand = {
  name: 'rename',
  description: '重命名当前会话或草稿标题',
  usage: '/rename <title>',
  run: async ({ runtime, argsText, write }) => {
    const title = argsText.trim()

    if (!title) {
      write('请提供新的会话标题。')
      return
    }

    const result = await renameRuntimeSession(runtime, title)

    write(result.persisted
      ? `已重命名当前会话：${result.title}`
      : `已设置新会话草稿标题：${result.title}`)
  },
}

const deleteCommand: CliCommand = {
  name: 'delete',
  description: '删除指定已保存会话',
  usage: '/delete <session-id>',
  run: async ({ runtime, argsText, write }) => {
    const sessionId = argsText.trim()

    if (!sessionId) {
      write('请提供要删除的会话 ID。')
      return
    }

    const session = await loadPersistedSession(sessionId)

    if (!session) {
      write(`未找到会话：${sessionId}`)
      return
    }

    await deleteRuntimeSession(runtime, sessionId)
    write(`已删除会话：${sessionId} (${session.title})`)
  },
}

const clearCommand: CliCommand = {
  name: 'clear',
  description: '清空当前会话并删除其持久化记录',
  usage: '/clear',
  run: async ({ runtime, write }) => {
    await clearRuntimeSession(runtime)
    write('会话已清空。')
  },
}

export const sessionCommands = [
  sessionsCommand,
  loadCommand,
  newCommand,
  renameCommand,
  deleteCommand,
  clearCommand,
]

import type { PersistedSessionSummary } from '../persistence/session-store'
import type { AgentSession } from '../types'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { createAgentSession } from '../agent'
import {
  appendPersistedMemory,
  clearPersistedMemory,
  clearPersistedSession,
  createSessionId,
  createSessionTitle,
  getMemoryFilePath,
  listPersistedSessions,
  loadPersistedMemory,
  loadPersistedSession,
  savePersistedSession,
} from '../persistence'

const HELP_TEXT = [
  '可用命令：',
  '  /help                  显示帮助',
  '  /sessions              查看已保存会话',
  '  /load <sessionId>      加载指定会话',
  '  /new [title]           开始一个新会话草稿',
  '  /clear                 清空当前会话历史',
  '  /memory                查看当前项目记忆',
  '  /remember <内容>       追加一条项目记忆',
  '  /forget                清空项目记忆',
  '  /exit                  退出交互模式',
  '  /quit                  退出交互模式',
].join('\n')

interface CliRuntime {
  session: AgentSession
  currentSessionId: string | null
  currentSessionTitle: string | null
  pendingSessionTitle: string | null
}

function isExitCommand(input: string) {
  return input === '/exit' || input === '/quit'
}

function formatSessionUpdatedAt(updatedAt: string) {
  const date = new Date(updatedAt)
  return Number.isNaN(date.getTime())
    ? updatedAt
    : date.toLocaleString('zh-CN', { hour12: false })
}

function printSessionList(sessions: PersistedSessionSummary[], currentSessionId: string | null) {
  if (sessions.length === 0) {
    console.log('当前没有已保存会话。')
    return
  }

  console.log('已保存会话：')

  for (const session of sessions) {
    const currentMark = session.id === currentSessionId ? '*' : ' '
    console.log(`${currentMark} ${session.id}  ${session.title}  ${session.messageCount} 条消息  ${formatSessionUpdatedAt(session.updatedAt)}`)
  }
}

function createEmptyRuntime(memory: string): CliRuntime {
  return {
    session: createAgentSession({ memory }),
    currentSessionId: null,
    currentSessionTitle: null,
    pendingSessionTitle: null,
  }
}

async function saveCurrentSession(runtime: CliRuntime) {
  if (!runtime.currentSessionId || !runtime.currentSessionTitle) {
    return
  }

  await savePersistedSession({
    id: runtime.currentSessionId,
    title: runtime.currentSessionTitle,
    conversationMessages: runtime.session.getConversationMessages(),
  })
}

async function runUserInput(runtime: CliRuntime, input: string) {
  const output = await runtime.session.runTurn(input)

  if (!runtime.currentSessionId) {
    runtime.currentSessionId = createSessionId()
    runtime.currentSessionTitle = runtime.pendingSessionTitle || createSessionTitle(input)
    runtime.pendingSessionTitle = null
    console.log(`已创建会话：${runtime.currentSessionId} (${runtime.currentSessionTitle})`)
  }

  await saveCurrentSession(runtime)
  console.log(`\n${output}\n`)
}

async function handleCliInput(runtime: CliRuntime, input: string) {
  if (input === '/help') {
    console.log(HELP_TEXT)
    return true
  }

  if (input === '/sessions') {
    const sessions = await listPersistedSessions()
    printSessionList(sessions, runtime.currentSessionId)
    return true
  }

  if (input.startsWith('/load ')) {
    const sessionId = input.slice('/load '.length).trim()
    const persistedSession = await loadPersistedSession(sessionId)

    if (!persistedSession) {
      console.log(`未找到会话：${sessionId}`)
      return true
    }

    runtime.session = createAgentSession({
      conversationMessages: persistedSession.conversationMessages,
      memory: runtime.session.getMemory(),
    })
    runtime.currentSessionId = persistedSession.id
    runtime.currentSessionTitle = persistedSession.title
    runtime.pendingSessionTitle = null

    console.log(`已加载会话：${persistedSession.id} (${persistedSession.title})，共 ${persistedSession.conversationMessages.length} 条消息。`)
    return true
  }

  if (input === '/new' || input.startsWith('/new ')) {
    const title = input === '/new' ? '' : input.slice('/new '.length).trim()
    const memory = runtime.session.getMemory()
    runtime.session = createAgentSession({ memory })
    runtime.currentSessionId = null
    runtime.currentSessionTitle = null
    runtime.pendingSessionTitle = title || null

    console.log(title ? `已开始新会话草稿：${title}` : '已开始新会话。')
    return true
  }

  if (input === '/clear') {
    runtime.session.reset()

    if (runtime.currentSessionId) {
      await clearPersistedSession(runtime.currentSessionId)
    }

    runtime.currentSessionId = null
    runtime.currentSessionTitle = null
    runtime.pendingSessionTitle = null
    console.log('会话已清空。')
    return true
  }

  if (input === '/memory') {
    const memory = runtime.session.getMemory()

    if (!memory) {
      console.log(`当前没有项目记忆。可使用 /remember 添加，文件位置：${getMemoryFilePath()}`)
      return true
    }

    console.log(`当前项目记忆（${getMemoryFilePath()}）：\n${memory}`)
    return true
  }

  if (input.startsWith('/remember ')) {
    const note = input.slice('/remember '.length).trim()
    const memory = await appendPersistedMemory(note)
    runtime.session.setMemory(memory)
    console.log(`已写入项目记忆：${getMemoryFilePath()}`)
    return true
  }

  if (input === '/forget') {
    await clearPersistedMemory()
    runtime.session.setMemory('')
    console.log('项目记忆已清空。')
    return true
  }

  if (isExitCommand(input)) {
    return false
  }

  try {
    await runUserInput(runtime, input)
  }
  catch (error: unknown) {
    const message = error instanceof Error ? error.message : '未知错误'
    console.error(`\n运行失败：${message}\n`)
  }

  return true
}

export async function startCli(initialInput?: string) {
  const [memory, sessions] = await Promise.all([
    loadPersistedMemory(),
    listPersistedSessions(),
  ])
  const runtime = createEmptyRuntime(memory)
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })

  if (memory) {
    console.log(`已加载项目记忆：${getMemoryFilePath()}`)
  }

  if (sessions.length > 0) {
    console.log(`已发现 ${sessions.length} 个历史会话。使用 /sessions 查看，/load <sessionId> 加载。`)
  }

  console.log('进入交互模式。输入 /help 查看命令，/exit 退出。')

  try {
    if (initialInput) {
      console.log(`agent> ${initialInput}`)
      const shouldContinue = await handleCliInput(runtime, initialInput)

      if (!shouldContinue) {
        return
      }
    }

    while (true) {
      let rawInput = ''

      try {
        rawInput = await readline.question('agent> ')
      }
      catch {
        break
      }

      const input = rawInput.trim()

      if (!input) {
        continue
      }

      const shouldContinue = await handleCliInput(runtime, input)

      if (!shouldContinue) {
        break
      }
    }
  }
  finally {
    readline.close()
  }
}

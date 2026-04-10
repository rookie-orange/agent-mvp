import type { AgentSession } from '../types'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { createAgentSession } from '../agent'
import {
  appendPersistedMemory,
  clearPersistedMemory,
  clearPersistedSession,
  getMemoryFilePath,
  loadPersistedMemory,
  loadPersistedSession,
  savePersistedSession,
} from '../persistence'

const HELP_TEXT = [
  'Available commands:',
  '  /help                  Show help and available commands',
  '  /clear                 Clear current session history',
  '  /memory                View current project memory',
  '  /remember <content>    Append a project memory',
  '  /forget                Clear project memory',
  '  /exit                  Exit',
  '  /quit                  Exit',
].join('\n')

function isExitCommand(input: string) {
  return input === '/exit' || input === '/quit'
}

async function runUserInput(session: AgentSession, input: string) {
  const output = await session.runTurn(input)
  await savePersistedSession(session.getConversationMessages())
  console.log(`\n${output}\n`)
}

async function handleCliInput(session: AgentSession, input: string) {
  if (input === '/help') {
    console.log(HELP_TEXT)
    return true
  }

  if (input === '/clear') {
    session.reset()
    await clearPersistedSession()
    console.log('会话已清空。')
    return true
  }

  if (input === '/memory') {
    const memory = session.getMemory()

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
    session.setMemory(memory)
    console.log(`已写入项目记忆：${getMemoryFilePath()}`)
    return true
  }

  if (input === '/forget') {
    await clearPersistedMemory()
    session.setMemory('')
    console.log('项目记忆已清空。')
    return true
  }

  if (isExitCommand(input)) {
    return false
  }

  try {
    await runUserInput(session, input)
  }
  catch (error: unknown) {
    const message = error instanceof Error ? error.message : '未知错误'
    console.error(`\n运行失败：${message}\n`)
  }

  return true
}

export async function startCli(initialInput?: string) {
  const [conversationMessages, memory] = await Promise.all([
    loadPersistedSession(),
    loadPersistedMemory(),
  ])
  const session = createAgentSession({
    conversationMessages,
    memory,
  })
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })

  if (conversationMessages.length > 0) {
    console.log(`已恢复上次会话，共 ${conversationMessages.length} 条消息。`)
  }

  if (memory) {
    console.log(`已加载项目记忆：${getMemoryFilePath()}`)
  }

  console.log('Enter /help to view commands, /exit to exit.')

  try {
    if (initialInput) {
      console.log(`agent> ${initialInput}`)
      const shouldContinue = await handleCliInput(session, initialInput)

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

      const shouldContinue = await handleCliInput(session, input)

      if (!shouldContinue) {
        break
      }
    }
  }
  finally {
    readline.close()
  }
}

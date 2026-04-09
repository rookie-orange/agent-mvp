import type { AgentSession } from '../types'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { createAgentSession } from '../agent'

const HELP_TEXT = [
  'commands:',
  '  /help   Show help and available commands',
  '  /clear  Clear current session context',
  '  /exit   Exit',
  '  /quit   Exit',
].join('\n')

function isExitCommand(input: string) {
  return input === '/exit' || input === '/quit'
}

async function runUserInput(session: AgentSession, input: string) {
  const output = await session.runTurn(input)
  console.log(`\n${output}\n`)
}

async function handleCliInput(session: AgentSession, input: string) {
  if (input === '/help') {
    console.log(HELP_TEXT)
    return true
  }

  if (input === '/clear') {
    session.reset()
    console.log('会话已清空。')
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
  const session = createAgentSession()
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })

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

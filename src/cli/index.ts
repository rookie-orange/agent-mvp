import type { AgentPlan, ToolApprovalRequest } from '../types'
import type { CliRuntime } from './runtime'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { executeCommand } from '../commands'
import { formatAgentPlan } from '../planner'
import {
  getMemoryFilePath,
  listPersistedSessions,
  loadPersistedMemory,
} from '../persistence'
import { createCliRuntime, runRuntimeTurn } from './runtime'

async function confirmApproval(
  readline: ReturnType<typeof createInterface>,
  request: ToolApprovalRequest,
) {
  console.log(`\n[审批] ${request.toolName}`)
  console.log(request.summary)

  for (const detail of request.details || []) {
    console.log(`- ${detail}`)
  }

  while (true) {
    let answer = ''

    try {
      answer = (await readline.question('允许继续吗？ [y/N] ')).trim().toLowerCase()
    }
    catch {
      return false
    }

    if (!answer || answer === 'n' || answer === 'no') {
      return false
    }

    if (answer === 'y' || answer === 'yes') {
      return true
    }

    console.log('请输入 y 或 n。')
  }
}

function printPlanUpdate(plan: AgentPlan | null) {
  if (!plan) {
    console.log('\n[计划] 当前计划已清空。\n')
    return
  }

  console.log(`\n[计划已更新]\n${formatAgentPlan(plan)}\n`)
}

async function runUserInput(runtime: CliRuntime, input: string) {
  const isNewSession = !runtime.currentSessionId
  const output = await runRuntimeTurn(runtime, input)

  if (isNewSession && runtime.currentSessionId && runtime.currentSessionTitle) {
    console.log(`已创建会话：${runtime.currentSessionId} (${runtime.currentSessionTitle})`)
  }

  console.log(`\n${output}\n`)
}

async function handleCliInput(runtime: CliRuntime, input: string) {
  const commandResult = await executeCommand(input, {
    runtime,
    write: message => console.log(message),
  })

  if (commandResult) {
    return commandResult.shouldContinue
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
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })
  const runtime = createCliRuntime(memory, {
    requestApproval: async request => await confirmApproval(readline, request),
    onPlanUpdated: (plan) => {
      printPlanUpdate(plan)
    },
  })

  if (memory) {
    console.log(`已加载项目记忆：${getMemoryFilePath()}`)
  }

  if (sessions.length > 0) {
    console.log(`已发现 ${sessions.length} 个历史会话。使用 /sessions 查看，/load <sessionId> 加载。`)
  }

  console.log('输入 /help 查看命令，/exit 退出。')

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

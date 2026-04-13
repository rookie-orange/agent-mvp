import type { ToolExecutionContext } from '@/types'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ensureToolApproval } from '../approval'
import { WORKSPACE_ROOT } from '../files/workspace'

const MAX_TIMEOUT_MS = 120_000
const DEFAULT_OUTPUT_MAX_CHARS = 8_000
const MAX_OUTPUT_MAX_CHARS = 20_000

interface AllowedCommandConfig {
  name: string
  executable: string
  args: string[]
  description: string
  timeoutMs: number
  scriptName?: string
}

const allowedCommands = [
  {
    name: 'pnpm typecheck',
    executable: 'pnpm',
    args: ['typecheck'],
    description: '运行 TypeScript 类型检查。',
    timeoutMs: 30_000,
    scriptName: 'typecheck',
  },
  {
    name: 'pnpm build',
    executable: 'pnpm',
    args: ['build'],
    description: '运行项目构建，确认代码可以产出可执行结果。',
    timeoutMs: 45_000,
    scriptName: 'build',
  },
  {
    name: 'pnpm test',
    executable: 'pnpm',
    args: ['test'],
    description: '运行项目测试。',
    timeoutMs: 45_000,
    scriptName: 'test',
  },
] satisfies AllowedCommandConfig[]

const allowedCommandRegistry = new Map(
  allowedCommands.map(command => [command.name, command]),
)

export interface CommandExecutionResult {
  command: string
  description: string
  status: 'passed' | 'failed'
  exitCode: number | null
  stdout: string
  stderr: string
  durationMs: number
  timedOut: boolean
}

export type WorkspaceValidationStep = Omit<CommandExecutionResult, 'status'> & {
  status: 'passed' | 'failed' | 'skipped'
  reason?: string
}

export interface WorkspaceValidationResult {
  requestedCommands: string[]
  executedCommands: string[]
  passed: boolean
  steps: WorkspaceValidationStep[]
}

interface RunAllowedCommandOptions {
  context?: ToolExecutionContext
  requireApproval?: boolean
  approvalToolName?: string
  timeoutMs?: number
  outputMaxChars?: number
}

interface RunWorkspaceValidationOptions {
  context?: ToolExecutionContext
  requireApproval?: boolean
  typecheck?: boolean
  build?: boolean
  test?: boolean
  timeoutMsPerCommand?: number
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function trimOutput(content: string, maxChars: number) {
  if (content.length <= maxChars) {
    return content
  }

  return `${content.slice(0, maxChars)}\n\n[输出已截断]`
}

async function readPackageScripts() {
  try {
    const packageJsonPath = path.join(WORKSPACE_ROOT, 'package.json')
    const rawContent = await readFile(packageJsonPath, 'utf8')
    const parsed = JSON.parse(rawContent) as {
      scripts?: Record<string, unknown>
    }

    return parsed.scripts || {}
  }
  catch {
    return {}
  }
}

async function hasPackageScript(scriptName: string) {
  const scripts = await readPackageScripts()
  return typeof scripts[scriptName] === 'string' && Boolean(scripts[scriptName].trim())
}

function getAllowedCommand(command: string) {
  const matchedCommand = allowedCommandRegistry.get(command)

  if (!matchedCommand) {
    const availableCommands = allowedCommands.map(item => item.name).join(', ')
    throw new Error(`不支持的命令: ${command}。当前只允许: ${availableCommands}`)
  }

  return matchedCommand
}

async function ensureCommandIsAvailable(command: AllowedCommandConfig) {
  if (!command.scriptName) {
    return
  }

  if (!await hasPackageScript(command.scriptName)) {
    throw new Error(`当前项目未定义 ${command.scriptName} script，无法运行 ${command.name}。`)
  }
}

async function executeAllowedCommand(
  command: AllowedCommandConfig,
  {
    timeoutMs,
    outputMaxChars,
  }: {
    timeoutMs?: number
    outputMaxChars?: number
  } = {},
): Promise<CommandExecutionResult> {
  const safeTimeoutMs = clampInteger(timeoutMs ?? command.timeoutMs, 1_000, MAX_TIMEOUT_MS)
  const safeOutputMaxChars = clampInteger(outputMaxChars ?? DEFAULT_OUTPUT_MAX_CHARS, 200, MAX_OUTPUT_MAX_CHARS)
  const startedAt = Date.now()

  return await new Promise<CommandExecutionResult>((resolve, reject) => {
    execFile(
      command.executable,
      command.args,
      {
        cwd: WORKSPACE_ROOT,
        encoding: 'utf8',
        timeout: safeTimeoutMs,
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - startedAt
        const trimmedStdout = trimOutput(stdout || '', safeOutputMaxChars)
        const trimmedStderr = trimOutput(stderr || '', safeOutputMaxChars)

        if (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            reject(new Error(`当前环境无法执行命令 ${command.name}，请先确认已安装 ${command.executable}。`))
            return
          }

          const exitCode = typeof error.code === 'number' ? error.code : null
          const timedOut = error.message.includes('timed out')

          resolve({
            command: command.name,
            description: command.description,
            status: 'failed',
            exitCode,
            stdout: trimmedStdout,
            stderr: trimmedStderr || error.message,
            durationMs,
            timedOut,
          })
          return
        }

        resolve({
          command: command.name,
          description: command.description,
          status: 'passed',
          exitCode: 0,
          stdout: trimmedStdout,
          stderr: trimmedStderr,
          durationMs,
          timedOut: false,
        })
      },
    )
  })
}

function createSkippedStep(command: AllowedCommandConfig, reason: string): WorkspaceValidationStep {
  return {
    command: command.name,
    description: command.description,
    status: 'skipped',
    reason,
    exitCode: null,
    stdout: '',
    stderr: '',
    durationMs: 0,
    timedOut: false,
  }
}

function getValidationCommandList({
  typecheck = true,
  build = true,
  test = false,
}: Pick<RunWorkspaceValidationOptions, 'typecheck' | 'build' | 'test'>) {
  const commands: AllowedCommandConfig[] = []

  if (typecheck) {
    commands.push(getAllowedCommand('pnpm typecheck'))
  }

  if (build) {
    commands.push(getAllowedCommand('pnpm build'))
  }

  if (test) {
    commands.push(getAllowedCommand('pnpm test'))
  }

  return commands
}

export function getAllowedCommandNames() {
  return allowedCommands.map(command => command.name)
}

export async function runAllowedCommand(
  commandName: string,
  options: RunAllowedCommandOptions = {},
) {
  const command = getAllowedCommand(commandName)

  await ensureCommandIsAvailable(command)

  if (options.requireApproval) {
    await ensureToolApproval(options.context, {
      kind: 'command-execution',
      toolName: options.approvalToolName || 'runCommand',
      summary: `执行命令: ${command.name}`,
      details: [
        `用途: ${command.description}`,
        `超时限制: ${clampInteger(options.timeoutMs ?? command.timeoutMs, 1_000, MAX_TIMEOUT_MS)}ms`,
      ],
    })
  }

  return await executeAllowedCommand(command, {
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.outputMaxChars === undefined ? {} : { outputMaxChars: options.outputMaxChars }),
  })
}

export async function runWorkspaceValidation(
  options: RunWorkspaceValidationOptions = {},
): Promise<WorkspaceValidationResult> {
  const requestedCommands = getValidationCommandList(options)

  if (requestedCommands.length === 0) {
    throw new Error('至少要选择一个验证步骤。')
  }

  const steps: WorkspaceValidationStep[] = []
  const executableCommands: AllowedCommandConfig[] = []

  for (const command of requestedCommands) {
    if (command.scriptName && !await hasPackageScript(command.scriptName)) {
      steps.push(createSkippedStep(command, `当前项目未定义 ${command.scriptName} script。`))
      continue
    }

    executableCommands.push(command)
  }

  if (options.requireApproval && executableCommands.length > 0) {
    await ensureToolApproval(options.context, {
      kind: 'command-execution',
      toolName: 'validateWorkspace',
      summary: '运行工作区验证命令',
      details: [
        `命令列表: ${executableCommands.map(command => command.name).join(', ')}`,
      ],
    })
  }

  for (const command of executableCommands) {
    steps.push(await executeAllowedCommand(command, {
      ...(options.timeoutMsPerCommand === undefined ? {} : { timeoutMs: options.timeoutMsPerCommand }),
    }))
  }

  return {
    requestedCommands: requestedCommands.map(command => command.name),
    executedCommands: executableCommands.map(command => command.name),
    passed: steps.every(step => step.status === 'passed' || step.status === 'skipped'),
    steps,
  }
}

export async function runDefaultMutationValidation(context: ToolExecutionContext) {
  return await runWorkspaceValidation({
    context,
    requireApproval: false,
    typecheck: true,
    build: true,
    test: false,
  })
}

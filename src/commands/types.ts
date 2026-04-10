import type { CliRuntime } from '../cli/runtime'

export interface CommandContext {
  runtime: CliRuntime
  argsText: string
  write: (message: string) => void
}

export interface CommandResult {
  shouldContinue?: boolean
}

export interface CliCommand {
  name: string
  description: string
  usage?: string
  aliases?: string[]
  run: (context: CommandContext) => Promise<CommandResult | void> | CommandResult | void
}

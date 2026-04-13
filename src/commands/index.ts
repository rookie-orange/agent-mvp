import type { CliCommand, CommandContext, CommandResult } from './types'
import { exitCommand } from './exit'
import { createHelpCommand } from './help'
import { memoryCommands } from './memory'
import { planCommands } from './plan'
import { sessionCommands } from './session'

const commandsWithoutHelp = [
  ...sessionCommands,
  ...memoryCommands,
  ...planCommands,
  exitCommand,
]

const helpCommand = createHelpCommand(commandsWithoutHelp)

const commands = [
  helpCommand,
  ...commandsWithoutHelp,
]

const commandRegistry = new Map<string, CliCommand>()

for (const command of commands) {
  commandRegistry.set(command.name, command)

  for (const alias of command.aliases || []) {
    commandRegistry.set(alias, command)
  }
}

const REGEX_WHITESPACE = /\s+/

function parseCommandLine(input: string) {
  if (!input.startsWith('/')) {
    return null
  }

  const trimmed = input.slice(1).trim()

  if (!trimmed) {
    return null
  }

  const [name, ...rest] = trimmed.split(REGEX_WHITESPACE)

  if (!name) {
    return null
  }

  return {
    name,
    argsText: rest.join(' ').trim(),
  }
}

export async function executeCommand(
  input: string,
  context: Omit<CommandContext, 'argsText'>,
) {
  const parsed = parseCommandLine(input)

  if (!parsed) {
    return null
  }

  const command = commandRegistry.get(parsed.name)

  if (!command) {
    return null
  }

  const result = await command.run({
    ...context,
    argsText: parsed.argsText,
  })

  return {
    shouldContinue: result?.shouldContinue ?? true,
  } satisfies CommandResult
}

export { commands }

import type { CliCommand } from './types'

type HelpCommandMeta = Pick<CliCommand, 'name' | 'description' | 'usage' | 'aliases'>

function buildHelpText(commands: HelpCommandMeta[]) {
  const commandLines = commands.flatMap((command) => {
    const baseUsage = command.usage || `/${command.name}`
    const lines = [{ usage: baseUsage, description: command.description }]

    for (const alias of command.aliases || []) {
      lines.push({
        usage: `/${alias}`,
        description: `${command.description}（别名）`,
      })
    }

    return lines
  })
  const maxUsageLength = Math.max(...commandLines.map(item => item.usage.length))

  return [
    '可用命令：',
    ...commandLines.map(item => `  ${item.usage.padEnd(maxUsageLength)}  ${item.description}`),
  ].join('\n')
}

export function createHelpCommand(commands: CliCommand[]): CliCommand {
  return {
    name: 'help',
    description: '显示帮助',
    usage: '/help',
    run: ({ write }) => {
      write(buildHelpText([{ name: 'help', description: '显示帮助', usage: '/help' }, ...commands]))
    },
  }
}

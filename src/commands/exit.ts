import type { CliCommand } from './types'

export const exitCommand: CliCommand = {
  name: 'exit',
  aliases: ['quit'],
  description: '退出模式',
  usage: '/exit',
  run: () => ({
    shouldContinue: false,
  }),
}

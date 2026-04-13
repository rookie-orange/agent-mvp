import process from 'node:process'
import { startCli } from './cli'

function printUsage() {
  console.log([
    'Usage:',
    '  pnpm dev [message]       Start [and send the first message]',
  ].join('\n'))
}

const HELP_FLAGS = new Set(['help', '--help', '-h'])

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] ?? ''

  if (HELP_FLAGS.has(command)) {
    printUsage()
    return
  }

  await startCli(command)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(`Failed to run: ${message}`)
  process.exitCode = 1
})

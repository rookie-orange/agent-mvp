import process from 'node:process'
import { startCli } from './cli'

function printUsage() {
  console.log([
    'Usage:',
    '  pnpm dev                  Start',
    '  pnpm dev "hello"          Start the first message',
  ].join('\n'))
}

async function main() {
  const args = process.argv.slice(2)

  if (args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printUsage()
    return
  }

  const initialInput = args[0] === 'chat'
    ? args.slice(1).join(' ').trim()
    : args.join(' ').trim()

  await startCli(initialInput || undefined)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '未知错误'
  console.error(`运行失败：${message}`)
  process.exitCode = 1
})

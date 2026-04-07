import process from 'node:process'
import { runAgent } from './agent/run-agent.js'

async function main() {
  const userInput = process.argv.slice(2).join(' ').trim()

  if (!userInput) {
    console.error('usage: pnpm dev \"Hello, Agent!\"')
    process.exitCode = 1
    return
  }

  const output = await runAgent(userInput)

  console.log(output)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error occurred'
  console.error(`Run failed: ${message}`)
  process.exitCode = 1
})

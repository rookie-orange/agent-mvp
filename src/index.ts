import dotenv from 'dotenv'

import { runAgent } from './agent/run-agent.js'

dotenv.config()

async function main() {
  const userInput = process.argv.slice(2).join(' ').trim()

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('缺少 OPENAI_API_KEY，请先在 .env 中配置。')
  }

  if (!userInput) {
    console.error('用法: pnpm dev 你好，请用一句话介绍 AI Agent')
    process.exitCode = 1
    return
  }

  const output = await runAgent(userInput)
  console.log(output)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '发生未知错误'
  console.error(`运行失败: ${message}`)
  process.exitCode = 1
})

import type { CreateResponseParams } from '../types/agent.js'
import process from 'node:process'
import OpenAI from 'openai'

const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini'

function createClient() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('缺少 OPENAI_API_KEY，请先在 .env 中配置。')
  }

  return new OpenAI({ apiKey })
}

export async function createResponse(params: CreateResponseParams) {
  const client = createClient()

  return client.responses.create({
    model,
    instructions: params.instructions,
    input: params.userInput,
  })
}

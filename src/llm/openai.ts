import type { CreateResponseParams } from '@/types'
import OpenAI from 'openai'
import { env } from '@/config'

function createClient() {
  const { apiKey, baseURL } = env
  return new OpenAI({ apiKey, baseURL })
}

export async function createResponse({ messages, tools }: CreateResponseParams) {
  const model = env.model

  const client = createClient()

  return await client.chat.completions.create({
    model,
    messages,
    tools,
  })
}

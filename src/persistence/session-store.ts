import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { resolve } from 'node:path'
import {
  getAgentDataDir,
  readJsonFileIfExists,
  removeFileIfExists,
  writeJsonFile,
} from './shared'

interface PersistedSessionData {
  version: 1
  updatedAt: string
  conversationMessages: ChatCompletionMessageParam[]
}

function getSessionFilePath() {
  return resolve(getAgentDataDir(), 'session.json')
}

export async function loadPersistedSession() {
  const data = await readJsonFileIfExists<PersistedSessionData>(getSessionFilePath())

  if (!data || !Array.isArray(data.conversationMessages)) {
    return []
  }

  return data.conversationMessages
}

export async function savePersistedSession(conversationMessages: ChatCompletionMessageParam[]) {
  const data: PersistedSessionData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    conversationMessages,
  }

  await writeJsonFile(getSessionFilePath(), data)
}

export async function clearPersistedSession() {
  await removeFileIfExists(getSessionFilePath())
}

export { getSessionFilePath }

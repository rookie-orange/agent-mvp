import { resolve } from 'node:path'
import {
  getAgentDataDir,
  readTextFileIfExists,
  removeFileIfExists,
  writeTextFile,
} from './shared'

function normalizeMemory(memory: string) {
  return memory.trim()
}

function getMemoryFilePath() {
  return resolve(getAgentDataDir(), 'memory.md')
}

export async function loadPersistedMemory() {
  const content = await readTextFileIfExists(getMemoryFilePath())
  return content?.trim() || ''
}

export async function savePersistedMemory(memory: string) {
  const normalized = normalizeMemory(memory)

  if (!normalized) {
    await removeFileIfExists(getMemoryFilePath())
    return
  }

  await writeTextFile(getMemoryFilePath(), `${normalized}\n`)
}

export async function appendPersistedMemory(note: string) {
  const normalizedNote = note.trim()

  if (!normalizedNote) {
    throw new Error('记忆内容不能为空。')
  }

  const currentMemory = await loadPersistedMemory()
  const nextMemory = currentMemory
    ? `${currentMemory}\n- ${normalizedNote}`
    : `- ${normalizedNote}`

  await savePersistedMemory(nextMemory)

  return nextMemory
}

export async function clearPersistedMemory() {
  await removeFileIfExists(getMemoryFilePath())
}

export { getMemoryFilePath }

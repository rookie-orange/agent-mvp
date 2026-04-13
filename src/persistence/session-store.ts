import type { AgentPlan } from '@/types'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { normalizeAgentPlan } from '../planner'
import {
  ensureDir,
  getAgentDataDir,
  listDirNamesIfExists,
  readJsonFileIfExists,
  removeFileIfExists,
  writeJsonFile,
} from './shared'

export interface PersistedSessionData {
  version: 1 | 2
  id: string
  title: string
  updatedAt: string
  conversationMessages: ChatCompletionMessageParam[]
  plan: AgentPlan | null
}

export interface PersistedSessionSummary {
  id: string
  title: string
  updatedAt: string
  messageCount: number
}

interface SavePersistedSessionParams {
  id: string
  title: string
  conversationMessages: ChatCompletionMessageParam[]
  plan?: AgentPlan | null
}

const REGEX_SESSION_ID = /^[a-z0-9-]+$/

function getSessionsDirPath() {
  return resolve(getAgentDataDir(), 'sessions')
}

function normalizeSessionId(sessionId: string) {
  const normalized = sessionId.trim()

  if (!normalized) {
    throw new Error('会话 ID 不能为空。')
  }

  if (!REGEX_SESSION_ID.test(normalized)) {
    throw new Error('会话 ID 格式非法。')
  }

  return normalized
}

function getSessionFilePath(sessionId: string) {
  return resolve(getSessionsDirPath(), `${normalizeSessionId(sessionId)}.json`)
}

function toSessionSummary(data: PersistedSessionData): PersistedSessionSummary {
  return {
    id: data.id,
    title: data.title,
    updatedAt: data.updatedAt,
    messageCount: data.conversationMessages.length,
  }
}

export function createSessionId() {
  const now = new Date()
  const parts = [
    now.getFullYear().toString(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ]

  return `session-${parts.join('')}-${randomUUID().slice(0, 6)}`
}

export function createSessionTitle(input?: string) {
  const normalized = input?.replace(/\s+/g, ' ').trim()

  if (!normalized) {
    return '新会话'
  }

  return normalized.length > 24
    ? `${normalized.slice(0, 24)}...`
    : normalized
}

export async function listPersistedSessions() {
  const fileNames = await listDirNamesIfExists(getSessionsDirPath())
  const sessions = await Promise.all(
    fileNames
      .filter(fileName => fileName.endsWith('.json'))
      .map(async (fileName) => {
        const sessionId = fileName.slice(0, -'.json'.length)
        return await loadPersistedSession(sessionId)
      }),
  )

  return sessions
    .flatMap(session => session ? [session] : [])
    .map(toSessionSummary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function loadPersistedSession(sessionId: string) {
  const data = await readJsonFileIfExists<PersistedSessionData>(getSessionFilePath(sessionId))

  if (!data || !Array.isArray(data.conversationMessages)) {
    return null
  }

  return {
    version: data.version === 2 ? 2 : 1,
    id: normalizeSessionId(data.id || sessionId),
    title: data.title?.trim() || createSessionTitle(),
    updatedAt: data.updatedAt,
    conversationMessages: data.conversationMessages,
    plan: normalizeAgentPlan(data.plan),
  } satisfies PersistedSessionData
}

export async function savePersistedSession({
  id,
  title,
  conversationMessages,
  plan,
}: SavePersistedSessionParams) {
  await ensureDir(getSessionsDirPath())

  const data: PersistedSessionData = {
    version: 2,
    id: normalizeSessionId(id),
    title: title.trim() || createSessionTitle(),
    updatedAt: new Date().toISOString(),
    conversationMessages,
    plan: plan ?? null,
  }

  await writeJsonFile(getSessionFilePath(data.id), data)
}

export async function clearPersistedSession(sessionId: string) {
  await removeFileIfExists(getSessionFilePath(sessionId))
}

export { getSessionFilePath, getSessionsDirPath }

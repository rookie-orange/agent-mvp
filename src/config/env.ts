import process from 'node:process'
import dotenv from 'dotenv'

dotenv.config({ quiet: true })

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`The environment variable is missing: ${name}`)
  }
  return value
}

function optional(name: string, fallback?: string) {
  return process.env[name]?.trim() || fallback
}

export const env = {
  apiKey: required('OPENAI_API_KEY'),
  baseURL: optional('OPENAI_BASE_URL'),
  model: required('OPENAI_MODEL'),
}


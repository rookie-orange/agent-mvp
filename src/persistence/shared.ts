import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

const AGENT_DATA_DIRNAME = '.agent'

function getAgentDataDir() {
  return resolve(process.cwd(), AGENT_DATA_DIRNAME)
}

async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true })
}

async function readTextFileIfExists(filePath: string) {
  try {
    return await readFile(filePath, 'utf8')
  }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null
    }

    throw error
  }
}

async function writeTextFile(filePath: string, content: string) {
  await ensureDir(dirname(filePath))
  await writeFile(filePath, content, 'utf8')
}

async function listDirNamesIfExists(dirPath: string) {
  try {
    return await readdir(dirPath)
  }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

async function readJsonFileIfExists<T>(filePath: string) {
  const content = await readTextFileIfExists(filePath)

  if (!content) {
    return null
  }

  return JSON.parse(content) as T
}

async function writeJsonFile(filePath: string, data: unknown) {
  await writeTextFile(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

async function removeFileIfExists(filePath: string) {
  try {
    await rm(filePath)
  }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return
    }

    throw error
  }
}

export {
  ensureDir,
  getAgentDataDir,
  listDirNamesIfExists,
  readJsonFileIfExists,
  readTextFileIfExists,
  removeFileIfExists,
  writeJsonFile,
  writeTextFile,
}

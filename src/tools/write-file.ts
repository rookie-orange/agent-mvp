import type { AgentTool } from '@/types'
import { Buffer } from 'node:buffer'
import { writeFile as fsWriteFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isString } from '@/shared/general'

const WORKSPACE_ROOT = process.cwd()

function getRequestedPath(value: unknown) {
  if (!isString(value) || !value.trim()) {
    throw new Error('path 必须是非空字符串。')
  }

  return value.trim()
}

function getContent(value: unknown) {
  if (!isString(value)) {
    throw new Error('content 必须是字符串。')
  }

  return value
}

function getBooleanOption(value: unknown, fieldName: string, fallback: boolean) {
  if (value === undefined) {
    return fallback
  }

  if (typeof value !== 'boolean') {
    throw new TypeError(`${fieldName} 必须是布尔值。`)
  }

  return value
}

function resolveWorkspacePath(requestedPath: string) {
  const resolvedPath = path.resolve(WORKSPACE_ROOT, requestedPath)
  const relativePath = path.relative(WORKSPACE_ROOT, resolvedPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('只允许写入当前工作区内的文件。')
  }

  return {
    resolvedPath,
    relativePath: relativePath || '.',
  }
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath)
    return true
  }
  catch {
    return false
  }
}

export const writeFileTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'writeFile',
      description: '在当前工作区内创建文件，或在明确允许时覆盖现有文件。适合新建文件或在已知完整内容时重写文件。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '目标文件路径，相对当前工作区根目录。',
          },
          content: {
            type: 'string',
            description: '要写入文件的完整内容。',
          },
          overwrite: {
            type: 'boolean',
            description: '可选，是否允许覆盖已存在文件，默认 false。',
          },
          createDirectories: {
            type: 'boolean',
            description: '可选，是否自动创建父目录，默认 true。',
          },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const requestedPath = getRequestedPath(args.path)
    const content = getContent(args.content)
    const overwrite = getBooleanOption(args.overwrite, 'overwrite', false)
    const createDirectories = getBooleanOption(args.createDirectories, 'createDirectories', true)
    const { resolvedPath, relativePath } = resolveWorkspacePath(requestedPath)
    const existed = await fileExists(resolvedPath)

    if (existed && !overwrite) {
      throw new Error(`文件已存在，若要覆盖请显式传入 overwrite=true: ${relativePath}`)
    }

    if (createDirectories) {
      await mkdir(path.dirname(resolvedPath), { recursive: true })
    }

    await fsWriteFile(resolvedPath, content, 'utf8')

    return {
      path: relativePath,
      created: !existed,
      overwritten: existed,
      bytesWritten: Buffer.byteLength(content, 'utf8'),
    }
  },
}

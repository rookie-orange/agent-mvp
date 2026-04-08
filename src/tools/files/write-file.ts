import type { AgentTool } from '@/types'
import { Buffer } from 'node:buffer'
import { writeFile as fsWriteFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { getBooleanOption, getRequiredPath, getRequiredString } from './args'
import { pathExists, resolveWorkspacePath } from './workspace'

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
    const requestedPath = getRequiredPath(args.path)
    const content = getRequiredString(args.content, 'content')
    const overwrite = getBooleanOption(args.overwrite, 'overwrite', false)
    const createDirectories = getBooleanOption(args.createDirectories, 'createDirectories', true)
    const { resolvedPath, relativePath } = resolveWorkspacePath(
      requestedPath,
      '只允许写入当前工作区内的文件。',
    )
    const existed = await pathExists(resolvedPath)

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

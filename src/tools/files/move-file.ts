import type { AgentTool } from '@/types'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { getBooleanOption, getRequiredPath } from './args'
import { requestFileMutationApproval } from './approval'
import { createBackup } from './backup-store'
import { pathExists, resolveWorkspacePath } from './workspace'

export const moveFileTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'moveFile',
      description: '在当前工作区内移动或重命名单个文件。适合重命名文件或调整文件路径。',
      parameters: {
        type: 'object',
        properties: {
          fromPath: {
            type: 'string',
            description: '源文件路径，相对当前工作区根目录。',
          },
          toPath: {
            type: 'string',
            description: '目标文件路径，相对当前工作区根目录。',
          },
          overwrite: {
            type: 'boolean',
            description: '可选，目标文件已存在时是否覆盖，默认 false。',
          },
          createDirectories: {
            type: 'boolean',
            description: '可选，是否自动创建目标父目录，默认 true。',
          },
        },
        required: ['fromPath', 'toPath'],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, context) => {
    const fromPath = getRequiredPath(args.fromPath, 'fromPath')
    const toPath = getRequiredPath(args.toPath, 'toPath')
    const overwrite = getBooleanOption(args.overwrite, 'overwrite', false)
    const createDirectories = getBooleanOption(args.createDirectories, 'createDirectories', true)
    const from = resolveWorkspacePath(fromPath, '只允许移动当前工作区内的文件。')
    const to = resolveWorkspacePath(toPath, '只允许移动当前工作区内的文件。')

    if (from.resolvedPath === to.resolvedPath) {
      throw new Error('源路径和目标路径不能相同。')
    }

    const sourceStat = await stat(from.resolvedPath)

    if (!sourceStat.isFile()) {
      throw new Error(`源目标不是文件: ${from.relativePath}`)
    }

    const destinationExists = await pathExists(to.resolvedPath)

    if (destinationExists && !overwrite) {
      throw new Error(`目标文件已存在，若要覆盖请显式传入 overwrite=true: ${to.relativePath}`)
    }

    if (destinationExists) {
      const destinationStat = await stat(to.resolvedPath)

      if (!destinationStat.isFile()) {
        throw new Error(`目标不是文件: ${to.relativePath}`)
      }
    }

    await requestFileMutationApproval(context, {
      toolName: 'moveFile',
      summary: `移动文件 ${from.relativePath} -> ${to.relativePath}`,
      paths: [from.relativePath, to.relativePath],
    })

    const backup = await createBackup({
      operation: 'moveFile',
      entries: [
        {
          path: from.relativePath,
          resolvedPath: from.resolvedPath,
          existed: true,
        },
        {
          path: to.relativePath,
          resolvedPath: to.resolvedPath,
          existed: destinationExists,
        },
      ],
    })

    if (destinationExists) {
      await rm(to.resolvedPath)
    }

    if (createDirectories) {
      await mkdir(path.dirname(to.resolvedPath), { recursive: true })
    }

    await rename(from.resolvedPath, to.resolvedPath)

    return {
      fromPath: from.relativePath,
      toPath: to.relativePath,
      overwritten: destinationExists,
      backup,
    }
  },
}

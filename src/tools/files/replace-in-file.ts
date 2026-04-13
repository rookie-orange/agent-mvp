import type { AgentTool } from '@/types'
import { Buffer } from 'node:buffer'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { getBooleanOption, getExpectedOccurrences, getRequiredPath, getRequiredString } from './args'
import { requestFileMutationApproval } from './approval'
import { createBackup } from './backup-store'
import { countOccurrences, replaceFirstOccurrence } from './text-edits'
import { resolveWorkspacePath } from './workspace'

export const replaceInFileTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'replaceInFile',
      description: '对当前工作区内的已有文件做精确字符串替换。适合已知道要替换的原文和新文本时进行小范围修改。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '目标文件路径，相对当前工作区根目录。',
          },
          find: {
            type: 'string',
            description: '要查找的原始文本，必须精确匹配文件中的内容。',
          },
          replace: {
            type: 'string',
            description: '替换后的文本。',
          },
          replaceAll: {
            type: 'boolean',
            description: '可选，是否替换所有匹配项，默认 false。',
          },
          expectedOccurrences: {
            type: 'integer',
            description: '可选，期望匹配次数。默认在 replaceAll=false 时为 1，用于防止误改。',
            minimum: 0,
          },
        },
        required: ['path', 'find', 'replace'],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, context) => {
    const requestedPath = getRequiredPath(args.path)
    const find = getRequiredString(args.find, 'find')
    const replace = getRequiredString(args.replace, 'replace')
    const replaceAll = getBooleanOption(args.replaceAll, 'replaceAll', false)
    const expectedOccurrences = getExpectedOccurrences(args.expectedOccurrences, replaceAll ? undefined : 1)
    const { resolvedPath, relativePath } = resolveWorkspacePath(
      requestedPath,
      '只允许修改当前工作区内的文件。',
    )

    if (!find) {
      throw new Error('find 不能为空字符串。')
    }

    const fileStat = await stat(resolvedPath)

    if (!fileStat.isFile()) {
      throw new Error(`目标不是文件: ${relativePath}`)
    }

    const originalContent = await readFile(resolvedPath, 'utf8')
    const actualOccurrences = countOccurrences(originalContent, find)

    if (actualOccurrences === 0) {
      throw new Error(`未在文件中找到要替换的内容: ${relativePath}`)
    }

    if (expectedOccurrences !== undefined && actualOccurrences !== expectedOccurrences) {
      throw new Error(`匹配次数不符合预期。期望 ${expectedOccurrences} 次，实际 ${actualOccurrences} 次。`)
    }

    const nextContent = replaceAll
      ? originalContent.split(find).join(replace)
      : replaceFirstOccurrence(originalContent, find, replace)

    if (nextContent === originalContent) {
      throw new Error('替换后文件内容没有变化。')
    }

    await requestFileMutationApproval(context, {
      toolName: 'replaceInFile',
      summary: `修改文件 ${relativePath}`,
      paths: [relativePath],
    })

    const backup = await createBackup({
      operation: 'replaceInFile',
      entries: [
        {
          path: relativePath,
          resolvedPath,
          existed: true,
        },
      ],
    })

    await writeFile(resolvedPath, nextContent, 'utf8')

    return {
      path: relativePath,
      replacedOccurrences: replaceAll ? actualOccurrences : 1,
      replaceAll,
      bytesDelta: Buffer.byteLength(nextContent, 'utf8') - Buffer.byteLength(originalContent, 'utf8'),
      backup,
    }
  },
}

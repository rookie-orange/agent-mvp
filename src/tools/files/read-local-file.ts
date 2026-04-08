import type { AgentTool } from '@/types'
import { readWorkspaceFile, type ReadWorkspaceFileInput } from './read'

export const readLocalFileTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'readLocalFile',
      description: '读取当前工作区内的本地文本文件内容。需要查看代码、配置或文档时使用。path 传相对工作区根目录的路径，可选 startLine 和 endLine 指定读取范围。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要读取的文件路径，相对当前工作区根目录，例如 src/index.ts 或 package.json。',
          },
          startLine: {
            type: 'integer',
            description: '可选，起始行号，从 1 开始。',
            minimum: 1,
          },
          endLine: {
            type: 'integer',
            description: '可选，结束行号，从 1 开始。',
            minimum: 1,
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const input: ReadWorkspaceFileInput = {
      path: args.path as string,
    }

    if (args.startLine !== undefined) {
      input.startLine = args.startLine as number
    }

    if (args.endLine !== undefined) {
      input.endLine = args.endLine as number
    }

    return await readWorkspaceFile(input)
  },
}

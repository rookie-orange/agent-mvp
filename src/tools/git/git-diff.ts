import type { AgentTool } from '@/types'
import { getBooleanOption, getIntegerOption, getPathWithDefault } from '../files/args'
import { getGitDiffSnapshot } from './shared'

const DEFAULT_CONTEXT_LINES = 3
const MAX_CONTEXT_LINES = 10
const DEFAULT_MAX_CHARS = 12000
const MAX_ALLOWED_CHARS = 40000

export const gitDiffTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'gitDiff',
      description: '查看当前工作区的 Git diff。适合在修改后自检具体改动内容，或回答用户“改了什么”。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '可选，只查看某个路径范围内的 diff，相对当前工作区根目录，默认是 .',
          },
          staged: {
            type: 'boolean',
            description: '可选，是否查看已暂存的 diff，默认 false。',
          },
          contextLines: {
            type: 'integer',
            description: `可选，diff 上下文行数，默认 ${DEFAULT_CONTEXT_LINES}。`,
            minimum: 0,
            maximum: MAX_CONTEXT_LINES,
          },
          maxChars: {
            type: 'integer',
            description: `可选，最多返回多少字符的 diff，默认 ${DEFAULT_MAX_CHARS}。`,
            minimum: 1,
            maximum: MAX_ALLOWED_CHARS,
          },
        },
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const requestedPath = getPathWithDefault(args.path)
    const staged = getBooleanOption(args.staged, 'staged', false)
    const contextLines = getIntegerOption(args.contextLines, 'contextLines', {
      fallback: DEFAULT_CONTEXT_LINES,
      min: 0,
      max: MAX_CONTEXT_LINES,
    })!
    const maxChars = getIntegerOption(args.maxChars, 'maxChars', {
      fallback: DEFAULT_MAX_CHARS,
      min: 1,
      max: MAX_ALLOWED_CHARS,
    })!

    return await getGitDiffSnapshot({
      paths: [requestedPath],
      staged,
      contextLines,
      maxChars,
    })
  },
}

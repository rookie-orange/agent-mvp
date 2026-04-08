import type { AgentTool } from '@/types'
import { getIntegerOption, getPathWithDefault } from '../files/args'
import { getGitStatusSnapshot } from './shared'

const DEFAULT_MAX_ENTRIES = 50
const MAX_ALLOWED_ENTRIES = 200

export const gitStatusTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'gitStatus',
      description: '查看当前工作区的 Git 变更状态。适合确认有哪些文件被修改、新增、删除或重命名。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '可选，只查看某个路径范围内的 Git 状态，相对当前工作区根目录，默认是 .',
          },
          maxEntries: {
            type: 'integer',
            description: `可选，最多返回多少条状态记录，默认 ${DEFAULT_MAX_ENTRIES}。`,
            minimum: 1,
            maximum: MAX_ALLOWED_ENTRIES,
          },
        },
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const requestedPath = getPathWithDefault(args.path)
    const maxEntries = getIntegerOption(args.maxEntries, 'maxEntries', {
      fallback: DEFAULT_MAX_ENTRIES,
      min: 1,
      max: MAX_ALLOWED_ENTRIES,
    })!

    return await getGitStatusSnapshot({
      paths: [requestedPath],
      maxEntries,
    })
  },
}

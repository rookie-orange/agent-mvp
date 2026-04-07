import type { AgentTool } from '@/types'

function getCurrentTime() {
  const now = new Date()

  return {
    localeTime: now.toLocaleString('zh-CN', { hour12: false }),
    isoTime: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

export const getCurrentTimeTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'getCurrentTime',
      description: '获取当前时间。当用户询问现在几点、当前日期、今天星期几时使用。',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  execute: async () => getCurrentTime(),
}

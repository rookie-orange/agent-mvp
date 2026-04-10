import type { CliCommand } from './types'
import {
  appendPersistedMemory,
  clearPersistedMemory,
  getMemoryFilePath,
} from '../persistence'

const memoryCommand: CliCommand = {
  name: 'memory',
  description: '查看当前项目记忆',
  usage: '/memory',
  run: ({ runtime, write }) => {
    const memory = runtime.session.getMemory()

    if (!memory) {
      write(`当前没有项目记忆。可使用 /remember 添加，文件位置：${getMemoryFilePath()}`)
      return
    }

    write(`当前项目记忆（${getMemoryFilePath()}）：\n${memory}`)
  },
}

const rememberCommand: CliCommand = {
  name: 'remember',
  description: '追加一条项目记忆',
  usage: '/remember <content>',
  run: async ({ runtime, argsText, write }) => {
    const note = argsText.trim()

    if (!note) {
      write('请提供要写入的记忆内容。')
      return
    }

    const memory = await appendPersistedMemory(note)
    runtime.session.setMemory(memory)
    write(`已写入项目记忆：${getMemoryFilePath()}`)
  },
}

const forgetCommand: CliCommand = {
  name: 'forget',
  description: '清空项目记忆',
  usage: '/forget',
  run: async ({ runtime, write }) => {
    await clearPersistedMemory()
    runtime.session.setMemory('')
    write('项目记忆已清空。')
  },
}

export const memoryCommands = [
  memoryCommand,
  rememberCommand,
  forgetCommand,
]

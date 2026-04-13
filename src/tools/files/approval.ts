import type { ToolExecutionContext } from '@/types'
import { ensureToolApproval } from '../approval'

const mutationToolNames = new Set([
  'writeFile',
  'replaceInFile',
  'applyFileEdits',
  'moveFile',
  'deleteFile',
  'restoreBackup',
  'rollbackLatest',
])

function formatPaths(paths: string[]) {
  const uniquePaths = [...new Set(paths)].filter(Boolean)

  if (uniquePaths.length === 0) {
    return '未提供路径信息'
  }

  if (uniquePaths.length <= 3) {
    return uniquePaths.join(', ')
  }

  return `${uniquePaths.slice(0, 3).join(', ')} 等 ${uniquePaths.length} 项`
}

interface FileMutationApprovalInput {
  toolName: string
  summary: string
  paths: string[]
}

export function isMutationToolName(toolName: string) {
  return mutationToolNames.has(toolName)
}

export async function requestFileMutationApproval(
  context: ToolExecutionContext,
  input: FileMutationApprovalInput,
) {
  await ensureToolApproval(context, {
    kind: 'file-mutation',
    toolName: input.toolName,
    summary: input.summary,
    details: [
      `影响路径: ${formatPaths(input.paths)}`,
      '批准后会自动运行验证: pnpm typecheck, pnpm build',
    ],
  })
}

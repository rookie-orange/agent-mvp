import type { ToolApprovalRequest, ToolExecutionContext } from '@/types'

export async function ensureToolApproval(
  context: ToolExecutionContext | undefined,
  request: ToolApprovalRequest,
) {
  const requestApproval = context?.requestApproval

  if (!requestApproval) {
    throw new Error(`当前运行环境不支持交互审批，已拒绝执行 ${request.toolName}。`)
  }

  const approved = await requestApproval(request)

  if (!approved) {
    throw new Error(`用户拒绝了 ${request.toolName}。`)
  }
}

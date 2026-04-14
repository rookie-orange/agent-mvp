import type {
  AgentExecutionReport,
  AgentExecutionReportToolCall,
  AgentExecutionReportValidation,
  AgentToolExecutionRecord,
} from '@/types'
import { isObject } from '@/shared/general'

function getResultPath(result: Record<string, unknown>, fieldName: string) {
  const value = result[fieldName]

  return typeof value === 'string' ? value : undefined
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function previewText(text: string, maxLength = 160) {
  const normalized = text.replace(/\s+/g, ' ').trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength)}...`
}

function formatPathList(paths: string[], maxItems = 5) {
  if (paths.length === 0) {
    return ''
  }

  if (paths.length <= maxItems) {
    return paths.join(', ')
  }

  return `${paths.slice(0, maxItems).join(', ')} 等 ${paths.length} 项`
}

function getAffectedPaths(toolName: string, result: unknown) {
  if (!isObject(result)) {
    return [] as string[]
  }

  if (toolName === 'writeFile' || toolName === 'replaceInFile' || toolName === 'applyFileEdits' || toolName === 'deleteFile') {
    const path = getResultPath(result, 'path')
    return path ? [path] : []
  }

  if (toolName === 'moveFile') {
    const fromPath = getResultPath(result, 'fromPath')
    const toPath = getResultPath(result, 'toPath')
    return [fromPath, toPath].filter((value): value is string => Boolean(value))
  }

  if (toolName === 'restoreBackup' || toolName === 'rollbackLatest') {
    return getStringArray(result.affectedPaths)
  }

  return []
}

function getBackupId(result: unknown) {
  if (!isObject(result) || !isObject(result.backup)) {
    return undefined
  }

  const backupId = result.backup.id
  return typeof backupId === 'string' ? backupId : undefined
}

function getWorkspaceValidation(result: unknown): AgentExecutionReportValidation | undefined {
  if (!isObject(result) || !isObject(result.workspaceValidation)) {
    return undefined
  }

  const validation = result.workspaceValidation

  if (typeof validation.passed !== 'boolean') {
    return undefined
  }

  const requestedCommands = getStringArray(validation.requestedCommands)
  const executedCommands = getStringArray(validation.executedCommands)
  const failedCommands: string[] = []
  const skippedCommands: string[] = []

  if (Array.isArray(validation.steps)) {
    for (const step of validation.steps) {
      if (!isObject(step) || typeof step.command !== 'string' || typeof step.status !== 'string') {
        continue
      }

      if (step.status === 'failed') {
        failedCommands.push(step.command)
      }

      if (step.status === 'skipped') {
        skippedCommands.push(step.command)
      }
    }
  }

  return {
    passed: validation.passed,
    requestedCommands,
    executedCommands,
    failedCommands,
    skippedCommands,
  }
}

function getChangeSummary(result: unknown) {
  if (!isObject(result) || !isObject(result.changeSummary)) {
    return undefined
  }

  const changeSummary = result.changeSummary

  return {
    headline: typeof changeSummary.headline === 'string'
      ? changeSummary.headline
      : undefined,
    notes: getStringArray(changeSummary.notes),
  }
}

function summarizeToolCall(record: AgentToolExecutionRecord): AgentExecutionReportToolCall {
  if (!record.ok) {
    const note = record.error ? previewText(record.error) : undefined

    return {
      step: record.step,
      toolName: record.toolName,
      status: 'failed',
      ...(note ? { note } : {}),
    }
  }

  if (record.toolName === 'updatePlan' && isObject(record.result)) {
    const cleared = record.result.cleared

    return {
      step: record.step,
      toolName: record.toolName,
      status: 'success',
      note: cleared === true ? '已清空计划' : '已更新计划',
    }
  }

  if (record.toolName === 'searchInFiles' && isObject(record.result) && typeof record.result.totalMatches === 'number') {
    return {
      step: record.step,
      toolName: record.toolName,
      status: 'success',
      note: `找到 ${record.result.totalMatches} 条匹配`,
    }
  }

  if (record.toolName === 'runCommand' && isObject(record.result) && typeof record.result.status === 'string') {
    return {
      step: record.step,
      toolName: record.toolName,
      status: 'success',
      note: record.result.status === 'passed' ? '命令执行通过' : '命令执行失败',
    }
  }

  if (record.toolName === 'validateWorkspace') {
    const validation = getWorkspaceValidation({ workspaceValidation: record.result })

    if (validation) {
      return {
        step: record.step,
        toolName: record.toolName,
        status: 'success',
        note: validation.passed ? '工作区验证通过' : '工作区验证失败',
      }
    }
  }

  const affectedPaths = getAffectedPaths(record.toolName, record.result)

  const note = affectedPaths.length > 0
    ? `影响 ${formatPathList(affectedPaths, 3)}`
    : undefined

  return {
    step: record.step,
    toolName: record.toolName,
    status: 'success',
    ...(note ? { note } : {}),
  }
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs}ms`
  }

  return `${(durationMs / 1000).toFixed(1)}s`
}

export function buildExecutionReport(input: {
  startedAt: number
  finishedAt: number
  toolCalls: AgentToolExecutionRecord[]
}): AgentExecutionReport {
  const affectedPaths = new Set<string>()
  const backupIds = new Set<string>()
  let latestWorkspaceValidation: AgentExecutionReportValidation | undefined
  let latestChangeSummary:
    | {
      headline?: string
      notes: string[]
    }
    | undefined

  for (const record of input.toolCalls) {
    if (!record.ok) {
      continue
    }

    for (const path of getAffectedPaths(record.toolName, record.result)) {
      affectedPaths.add(path)
    }

    const backupId = getBackupId(record.result)

    if (backupId) {
      backupIds.add(backupId)
    }

    const workspaceValidation = getWorkspaceValidation(record.result)

    if (workspaceValidation) {
      latestWorkspaceValidation = workspaceValidation
    }

    const changeSummary = getChangeSummary(record.result)

    if (changeSummary) {
      latestChangeSummary = {
        notes: changeSummary.notes,
        ...(changeSummary.headline ? { headline: changeSummary.headline } : {}),
      }
    }
  }

  const successfulToolCalls = input.toolCalls.filter(record => record.ok).length
  const failedToolCalls = input.toolCalls.length - successfulToolCalls

  return {
    startedAt: new Date(input.startedAt).toISOString(),
    finishedAt: new Date(input.finishedAt).toISOString(),
    durationMs: Math.max(input.finishedAt - input.startedAt, 0),
    totalToolCalls: input.toolCalls.length,
    successfulToolCalls,
    failedToolCalls,
    toolCalls: input.toolCalls.map(summarizeToolCall),
    affectedPaths: [...affectedPaths],
    backupIds: [...backupIds],
    changeSummaryNotes: latestChangeSummary?.notes || [],
    ...(latestChangeSummary?.headline
      ? { changeSummaryHeadline: latestChangeSummary.headline }
      : {}),
    ...(latestWorkspaceValidation
      ? { workspaceValidation: latestWorkspaceValidation }
      : {}),
  }
}

export function formatExecutionReport(report: AgentExecutionReport | null) {
  if (!report) {
    return '[执行报告]\n当前没有可展示的执行报告。'
  }

  const lines = [
    '[执行报告]',
    `耗时：${formatDuration(report.durationMs)}`,
  ]

  if (report.totalToolCalls === 0) {
    lines.push('本轮未调用任何工具。')
    return lines.join('\n')
  }

  lines.push(`工具调用：${report.totalToolCalls} 次（成功 ${report.successfulToolCalls}，失败 ${report.failedToolCalls}）`)
  lines.push('调用明细：')
  lines.push(...report.toolCalls.map((toolCall, index) => {
    const statusText = toolCall.status === 'success' ? '成功' : '失败'
    const noteText = toolCall.note ? `（${toolCall.note}）` : ''
    return `${index + 1}. 第 ${toolCall.step} 步 ${toolCall.toolName}：${statusText}${noteText}`
  }))

  if (report.affectedPaths.length > 0) {
    lines.push(`影响路径：${formatPathList(report.affectedPaths)}`)
  }

  if (report.backupIds.length > 0) {
    lines.push(`创建备份：${formatPathList(report.backupIds, 3)}`)
  }

  if (report.changeSummaryHeadline) {
    lines.push(`Git 变更：${report.changeSummaryHeadline}`)
  }

  if (report.changeSummaryNotes.length > 0) {
    lines.push(`Git 备注：${report.changeSummaryNotes.join('；')}`)
  }

  if (report.workspaceValidation) {
    const validation = report.workspaceValidation
    const executedCommands = validation.executedCommands.join(', ')
    const skippedCommands = validation.skippedCommands.join(', ')

    lines.push(validation.passed
      ? `自动验证：通过${executedCommands ? `（已执行 ${executedCommands}）` : ''}`
      : `自动验证：失败${validation.failedCommands.length > 0 ? `（失败命令：${validation.failedCommands.join(', ')}）` : ''}`)

    if (skippedCommands) {
      lines.push(`验证跳过：${skippedCommands}`)
    }
  }

  return lines.join('\n')
}

import type { AgentPlan, AgentPlanStep, AgentPlanStepStatus } from '@/types'
import { isArray, isObject, isString } from '@/shared/general'

const planStepStatusLabels: Record<AgentPlanStepStatus, string> = {
  pending: '待办',
  in_progress: '进行中',
  completed: '已完成',
}

function isPlanStepStatus(value: unknown): value is AgentPlanStepStatus {
  return value === 'pending' || value === 'in_progress' || value === 'completed'
}

function normalizePlanStep(value: unknown): AgentPlanStep | null {
  if (!isObject(value) || !isString(value.step) || !value.step.trim() || !isPlanStepStatus(value.status)) {
    return null
  }

  return {
    step: value.step.trim(),
    status: value.status,
  }
}

function formatPlanUpdatedAt(updatedAt: string) {
  const date = new Date(updatedAt)

  if (Number.isNaN(date.getTime())) {
    return updatedAt
  }

  return date.toLocaleString('zh-CN', { hour12: false })
}

export function createAgentPlan(input: {
  explanation?: string
  items: AgentPlanStep[]
}): AgentPlan {
  const plan: AgentPlan = {
    items: input.items,
    updatedAt: new Date().toISOString(),
  }

  const explanation = input.explanation?.trim()

  if (explanation) {
    plan.explanation = explanation
  }

  return plan
}

export function normalizeAgentPlan(value: unknown): AgentPlan | null {
  if (!isObject(value) || !isArray(value.items)) {
    return null
  }

  const items = value.items
    .map(normalizePlanStep)
    .filter((item): item is AgentPlanStep => item !== null)

  if (items.length === 0) {
    return null
  }

  const plan: AgentPlan = {
    items,
    updatedAt: isString(value.updatedAt) && value.updatedAt.trim()
      ? value.updatedAt
      : new Date().toISOString(),
  }

  if (isString(value.explanation) && value.explanation.trim()) {
    plan.explanation = value.explanation.trim()
  }

  return plan
}

export function formatAgentPlan(plan: AgentPlan | null) {
  if (!plan || plan.items.length === 0) {
    return '当前没有计划。'
  }

  const lines = [
    `当前计划（更新时间：${formatPlanUpdatedAt(plan.updatedAt)}）`,
  ]

  if (plan.explanation) {
    lines.push(`说明：${plan.explanation}`)
  }

  lines.push(...plan.items.map((item, index) => {
    return `${index + 1}. [${planStepStatusLabels[item.status]}] ${item.step}`
  }))

  return lines.join('\n')
}

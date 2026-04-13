import type { AgentPlanStep, AgentPlanStepStatus, AgentTool } from '@/types'
import { createAgentPlan } from '@/planner'
import { isArray, isObject, isString } from '@/shared/general'

function isPlanStepStatus(value: unknown): value is AgentPlanStepStatus {
  return value === 'pending' || value === 'in_progress' || value === 'completed'
}

function parsePlanItems(value: unknown) {
  if (!isArray(value)) {
    throw new Error('items 必须是数组。')
  }

  const items = value.map((item, index) => {
    if (!isObject(item) || !isString(item.step) || !item.step.trim() || !isPlanStepStatus(item.status)) {
      throw new Error(`items[${index}] 必须包含合法的 step 和 status。`)
    }

    return {
      step: item.step.trim(),
      status: item.status,
    } satisfies AgentPlanStep
  })

  const inProgressCount = items.filter(item => item.status === 'in_progress').length

  if (inProgressCount > 1) {
    throw new Error('计划中最多只能有一个 in_progress 步骤。')
  }

  return items
}

export const updatePlanTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'updatePlan',
      description: '创建或更新当前任务计划。适合在复杂任务前列出步骤，并在执行过程中持续更新状态。传入空 items 可清空当前计划。',
      parameters: {
        type: 'object',
        properties: {
          explanation: {
            type: 'string',
            description: '可选，对当前计划的简短说明。',
          },
          items: {
            type: 'array',
            description: '计划步骤列表。每个步骤都必须包含 step 和 status。',
            items: {
              type: 'object',
              properties: {
                step: {
                  type: 'string',
                  description: '步骤内容。',
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'in_progress', 'completed'],
                  description: '步骤状态。',
                },
              },
              required: ['step', 'status'],
              additionalProperties: false,
            },
          },
        },
        required: ['items'],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, context) => {
    if (!context.setPlan) {
      throw new Error('当前运行环境不支持计划更新。')
    }

    const items = parsePlanItems(args.items)
    const explanation = isString(args.explanation) && args.explanation.trim()
      ? args.explanation.trim()
      : undefined

    if (items.length === 0) {
      context.setPlan(null)

      return {
        cleared: true,
        plan: null,
      }
    }

    const plan = createAgentPlan(
      explanation === undefined
        ? { items }
        : { explanation, items },
    )

    context.setPlan(plan)

    return {
      cleared: false,
      plan,
    }
  },
}

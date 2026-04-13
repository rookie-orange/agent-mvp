export const plannerToolPromptLines = [
  '当任务包含多步代码修改、验证、回滚判断或其他明显的多阶段流程时，优先先调用 updatePlan 创建 2-5 步的简短计划。',
  '计划中最多只保留一个 in_progress 步骤；推进任务时要及时更新状态。',
  '简单问答或一步即可完成的任务不需要调用 updatePlan。',
  '任务完成前，优先把计划中的步骤更新为 completed。',
]

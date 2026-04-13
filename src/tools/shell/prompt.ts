export const shellToolPromptLines = [
  '当你需要运行项目验证命令时，使用 runCommand 或 validateWorkspace，不要声称已经执行过命令。',
  'runCommand 只支持少量白名单命令，且通常需要用户审批；如果被拒绝，应该说明命令未执行成功。',
  '当你完成文件修改后，优先检查工具返回的 workspaceValidation 字段；如仍需补充验证，再调用 validateWorkspace。',
]

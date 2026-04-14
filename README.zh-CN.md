# agent-mvp

[English](./README.md)

这是一个用于学习 AI Agent 演进过程的最小项目：从一次普通模型调用开始，逐步加入工具、安全层、回滚、持久化记忆和会话管理等功能。

## 当前状态

当前项目已经进入 **带 planner 的审批 / 验证交互式 CLI** 阶段，当前实现位于 [`main`](https://github.com/rookie-orange/agent-mvp/tree/main)。上一个里程碑版本仍保留在专门的 [`stage/approval-validation`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fapproval-validation) 分支中。

当前已经具备的能力：

- 交互式 CLI Agent 入口
- 基于 OpenAI 兼容接口的 `chat.completions` 调用
- 多步 tool-calling 循环
- 从 `.agent/memory.md` 自动加载项目级持久化记忆
- 在 `.agent/sessions/*.json` 下保存多会话历史
- 启动时不自动恢复上次对话，需由用户显式加载历史会话
- 会话级 planner 会随每个已保存 session 一起持久化
- 内置 CLI 会话命令：
  - `/sessions`
  - `/load <session-id>`
  - `/new [title]`
  - `/rename <title>`
  - `/delete <session-id>`
  - `/clear`
  - `/plan`
  - `/clear-plan`
  - `/memory`
  - `/remember <内容>`
  - `/forget`
- 内置工具：
  - `getCurrentTime`
  - `listFiles`
  - `readLocalFile`
  - `readMultipleFiles`
  - `searchInFiles`
  - `gitStatus`
  - `gitDiff`
  - `runCommand`
  - `validateWorkspace`
  - `updatePlan`
  - `listBackups`
  - `getLatestBackup`
  - `writeFile`
  - `replaceInFile`
  - `applyFileEdits`
  - `moveFile`
  - `deleteFile`
  - `restoreBackup`
  - `rollbackLatest`
- 自动修改校验：
  - 写入后自动回读
  - 移动 / 删除后自动检查
  - 文件修改与恢复后自动附带 Git 状态与 diff 自检
  - 修改后基于 Git inspection 自动生成可读的 `changeSummary`
- 高风险修改工具执行前会先进入 CLI 审批
- 命令执行限制为白名单验证命令
- 修改成功后会自动运行 `pnpm typecheck` 与 `pnpm build`
- 每轮真实交互后都会输出结构化的 execution report，汇总工具调用、影响路径、备份与验证结果
- 所有写类工具在执行前会自动生成备份
- 通过 `tsdown` 构建可分发的 `.js` 产物

## 阶段进度

### 当前阶段

#### 阶段 8：Planner、Execution Report 与自检总结

- 状态：进行中，位于 [`main`](https://github.com/rookie-orange/agent-mvp/tree/stage%2planner)
- 目标：
  - 在复杂编辑前增加任务规划
  - 在 CLI 中展示并持久化当前会话计划
  - 在每轮执行后输出结构化 execution report
  - 在修改后输出更结构化的自检总结

### 最近完成阶段

#### 阶段 7：确认与验证闭环

- 状态：已完成，分支为 [`stage/approval-validation`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fapproval-validation)
- 已完成内容：
  - 在高风险写操作前加入确认边界
  - 让 Agent 运行白名单项目命令
  - 在编辑后自动执行 typecheck / build 验证

### 已完成阶段

#### 阶段 1：MVP CLI Agent

- 分支：[`stage/mvp`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmvp)
- 已完成内容：
  - 基础 CLI 入口
  - 使用 `dotenv` 加载环境变量
  - OpenAI 兼容模型调用
  - 最小可运行 Agent 骨架

#### 阶段 2：Tool-Calling Agent Loop

- 分支：[`stage/tool-call`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ftool-call)
- 已完成内容：
  - 多步 Agent 循环
  - 工具注册与执行流程
  - 第一个内置工具：`getCurrentTime`
  - 为后续扩展重构项目结构

#### 阶段 3：工作区 File IO

- 分支：[`stage/file-io`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ffile-io)
- 已完成内容：
  - 目录列举、本地文件读取、多文件读取
  - 工作区关键词搜索
  - 受控的写入 / 替换 / 移动 / 删除文件能力
  - 初步具备面向工作区的 Agent 行为

#### 阶段 4：Undo / Redo 安全层

- 分支：[`stage/undo-redo`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fundo-redo)
- 已完成内容：
  - 写操作前自动备份
  - 回滚原语与恢复流程
  - 带文件与 Git 检查的修改校验
  - 更安全的文件编辑闭环

#### 阶段 5：持久化记忆基础层

- 分支：[`stage/memory`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmemory)
- 已完成内容：
  - 项目级持久化记忆
  - 会话历史持久化
  - CLI 级记忆命令
  - 将 memory 注入 Agent prompt

#### 阶段 6：连续对话与多对话CLI

- 分支：[`main`](https://github.com/rookie-orange/agent-mvp/tree/main)
- 已完成内容：
  - 显式的多会话管理
  - 手动加载会话而非自动恢复
  - 将 slash command 注册表从 CLI 输入层中拆出
  - 命令式的交互工作流

## 分支导航

| 阶段 | 状态 | 分支 | 链接 |
| --- | --- | --- | --- |
| 阶段 1：MVP CLI Agent | 已完成 | `stage/mvp` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmvp) |
| 阶段 2：Tool-Calling Agent Loop | 已完成 | `stage/tool-call` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ftool-call) |
| 阶段 3：工作区 File IO | 已完成 | `stage/file-io` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ffile-io) |
| 阶段 4：Undo / Redo 安全层 | 已完成 | `stage/undo-redo` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fundo-redo) |
| 阶段 5：持久化记忆基础层 | 已完成 | `stage/memory` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmemory) |
| 阶段 6：连续对话与多对话CLI | 已在当前分支完成 | `main` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/main) |
| 阶段 7：确认与验证闭环 | 已完成 | `stage/approval-validation` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fapproval-validation) |
| 阶段 8：Planner 与自检总结 | 当前在 `planner` 上继续推进 | `planner` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/stage%2planner) |

## 工具分组

### 工作区读取类

- `listFiles`
- `readLocalFile`
- `readMultipleFiles`
- `searchInFiles`

### Git 自检类

- `gitStatus`
- `gitDiff`

### 验证执行类

- `runCommand`
- `validateWorkspace`

### Planner 类

- `updatePlan`

### 修改类

- `writeFile`
- `replaceInFile`
- `applyFileEdits`
- `moveFile`
- `deleteFile`

### 恢复与回滚类

- `listBackups`
- `getLatestBackup`
- `restoreBackup`
- `rollbackLatest`

## CLI 会话与记忆

会话历史和项目记忆都保存在本地 `.agent/` 目录下，并已加入 Git ignore。

存储结构：

```txt
.agent/
  memory.md
  sessions/
    <session-id>.json
```

当前行为：

- 项目记忆会在启动时自动加载
- 历史对话不会在启动时自动加载
- 已保存会话必须通过 `/load <session-id>` 显式加载
- 一个新草稿会话在第一次真实对话成功后，才会被保存成正式会话
- 当前计划会跟随 session 一起保存，并在该 session 被重新加载时恢复

常用命令：

```txt
/sessions
/load <session-id>
/new [title]
/rename <title>
/delete <session-id>
/clear
/plan
/clear-plan
/memory
/remember <content>
/forget
```

命令语义：

- `/clear`：清空当前内存中的会话，并删除当前已加载会话对应的持久化文件
- `/delete <session-id>`：按 ID 删除指定已保存会话
- `/plan`：打印当前 session 的执行计划
- `/clear-plan`：只清空当前 session 的计划，不删除对话历史
- `/rename <title>`：重命名当前已保存会话，或在草稿阶段先修改会话标题

## 回滚模型

现在每一个写类工具都会在修改工作区之前自动创建备份。

这意味着 Agent 可以：

- 用 `listBackups` 查看历史备份
- 用 `getLatestBackup` 定位最近一次可回滚记录
- 用 `restoreBackup` 恢复指定备份
- 用 `rollbackLatest` 一步撤销最近一次匹配条件的修改

典型回滚链路：

```txt
write/replace/move/delete
-> 自动创建 backup
-> validation 校验文件与 git 状态
-> 如有需要：rollbackLatest
```

## 项目结构

```txt
src/
  agent/        # agent 循环与提示词
  cli/          # 交互式 CLI
  commands/     # slash commands 与命令注册表
  config/       # 环境变量配置
  llm/          # 模型调用层
  planner/      # 会话级计划模型与格式化
  persistence/  # 本地记忆与会话存储
  tools/        # 工具定义与执行
    files/      # 工作区读写与恢复工具
    git/        # Git 自检工具
    planner/    # 计划更新工具
    shell/      # 命令执行与工作区验证工具
  types/        # 共享类型
  index.ts      # CLI 入口
```

## 开发方式

安装依赖：

```bash
pnpm install
```

配置环境变量：

```bash
# 复制 .env.example 到 .env
cp .env.example .env
# 配置 API Key
OPENAI_API_KEY=your_openai_api_key_here
# 配置 URL，默认为 https://api.openai.com/v1
OPENAI_BASE_URL=https://api.openai.com/v1
# 配置 模型，默认为 gpt-4.1-mini
OPENAI_MODEL=gpt-4.1-mini
```

启动 CLI：

```bash
pnpm dev
```

带首条消息启动 CLI：

```bash
pnpm dev "这个项目里有哪些工具？"
```

一个典型的会话管理流程：

```txt
/sessions
/load session-20260410-abc123
/new 重构方案讨论
/remember This project uses tsdown for builds
```

尝试一次回滚场景：

```bash
pnpm dev "请创建 playground/undo-demo.txt，内容是 hello undo"
pnpm dev "请把 playground/undo-demo.txt 中的 hello undo 改成 hello rollback"
pnpm dev "请列出最近的备份"
pnpm dev "请回滚最近一次修改"
```

使用 `tsdown` 构建：

```bash
pnpm build
```

运行构建产物：

```bash
pnpm start
pnpm start "列出 src/tools 目录下的文件"
```

## 说明

- 这些阶段分支被保留为学习检查点，方便回看项目是如何一步步演进的

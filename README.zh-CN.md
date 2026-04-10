# agent-mvp

[English README](./README.md)

这是一个用于学习 AI Agent 演进过程的最小项目：从一次普通模型调用开始，逐步加入工具、安全层、回滚、持久化记忆和会话管理。

## 当前状态

当前项目处于 **交互式 CLI + 持久化记忆 + 多会话管理** 阶段，对应当前的 [`main`](https://github.com/rookie-orange/agent-mvp/tree/main) 分支。

当前已经具备的能力：

- 交互式 CLI Agent 入口
- 基于 OpenAI 兼容接口的 `chat.completions` 调用
- 多步 tool-calling 循环
- 从 `.agent/memory.md` 自动加载项目级持久化记忆
- 在 `.agent/sessions/*.json` 下保存多会话历史
- 启动时不自动恢复上次对话，需由用户显式加载历史会话
- 内置 CLI 会话命令：
  - `/sessions`
  - `/load <sessionId>`
  - `/new [title]`
  - `/rename <title>`
  - `/delete <sessionId>`
  - `/clear`
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
- 所有写类工具在执行前会自动生成备份
- 通过 `tsdown` 构建可分发的 `.js` 产物

## 阶段进度

### 当前阶段

#### 阶段 4：交互层

- 状态：进行中，位于 [`main`](https://github.com/rookie-orange/agent-mvp/tree/main)
- 目标：
  - 把 CLI 从一次性调用演进为真实的连续协作流程
  - 把项目记忆和聊天历史拆开持久化
  - 让多会话由用户显式管理，而不是自动恢复上次历史
  - 保持交互行为透明、可理解、可控

### 下一阶段规划

#### 阶段 5：确认与验证闭环

- 状态：规划中，暂未创建分支
- 目标：
  - 在高风险写操作前加入确认边界
  - 在长任务中更明显地展示动作日志和 diff
  - 在编辑后让 Agent 自动执行 typecheck、test、lint 等验证步骤

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

#### 阶段 3：工作区读写与恢复基础层

- 分支：[`main`](https://github.com/rookie-orange/agent-mvp/tree/main)
- 已完成内容：
  - 工作区检查工具
  - 受控文件修改工具
  - 修改后的 Git 自检
  - 自动备份与回滚原语

## 分支导航

| 阶段 | 状态 | 分支 | 链接 |
| --- | --- | --- | --- |
| 阶段 1：MVP CLI Agent | 已完成 | `stage/mvp` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmvp) |
| 阶段 2：Tool-Calling Agent Loop | 已完成 | `stage/tool-call` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ftool-call) |
| 阶段 3：工作区读写与恢复基础层 | 基础能力已完成 | `main` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/main) |
| 阶段 4：交互层 | 当前阶段 | `main` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/main) |
| 阶段 5：确认与验证闭环 | 规划中 | N/A | 尚未创建 |

## 工具分组

### 工作区读取类

- `listFiles`
- `readLocalFile`
- `readMultipleFiles`
- `searchInFiles`

### Git 自检类

- `gitStatus`
- `gitDiff`

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
- 已保存会话必须通过 `/load <sessionId>` 显式加载
- 一个新草稿会话在第一次真实对话成功后，才会被保存成正式会话

常用命令：

```txt
/sessions
/load <sessionId>
/new [title]
/rename <title>
/delete <sessionId>
/clear
/memory
/remember <content>
/forget
```

命令语义：

- `/clear`：清空当前内存中的会话，并删除当前已加载会话对应的持久化文件
- `/delete <sessionId>`：按 ID 删除指定已保存会话
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
  persistence/  # 本地记忆与会话存储
  tools/        # 工具定义与执行
    files/      # 工作区读写与恢复工具
    git/        # Git 自检工具
  types/        # 共享类型
  index.ts      # CLI 入口
```

## 开发方式

安装依赖：

```bash
pnpm install
```

启动交互式 CLI：

```bash
pnpm dev
pnpm chat
```

带首条消息启动交互式 CLI：

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
- 当前实现依然是 CLI first
- 交互层已经初步具备，但确认边界和编辑后验证仍然是下一步最实用的增强方向

## 下一步实用路线

当前状态下，最值得继续做的是：

1. 给写操作加确认机制和 `--yes` 模式
2. 增加流式输出和更明确的动作 trace
3. 在编辑完成后自动执行 typecheck、test、lint 等验证
4. 为长会话增加摘要压缩，避免历史无限膨胀

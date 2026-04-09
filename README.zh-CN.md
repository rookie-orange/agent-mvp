# agent-mvp

[English README](./README.md)

这是一个用于学习 AI Agent 演进过程的最小项目：从一次普通模型调用开始，逐步发展到具备完备的 Agent。

## 当前状态

当前项目处于 **工作区读写 + Git 自检 + 可回滚安全层阶段**，对应当前的 [`main`](https://github.com/rookie-orange/agent-mvp/tree/main) 分支。

当前已经具备的能力：

- 本地 CLI Agent 入口
- 基于 OpenAI 兼容接口的 `chat.completions` 调用
- 多步 tool-calling 循环
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

#### 阶段 3：工作区读写工具

- 状态：进行中，位于 [`main`](https://github.com/rookie-orange/agent-mvp/tree/main)
- 目标：
  - 让 Agent 在回答之前先检查本地工作区
  - 支持目录列举、文件读取、关键词搜索和受控文件修改
  - 在修改后加入 Git 自检能力
  - 为写操作增加可恢复、可回滚的安全能力
  - 保持工具调用闭环尽可能小而清晰

### 下一阶段规划

#### 阶段 4：交互层演进

- 状态：规划中，暂未创建分支
- 目标：
  - 把交互从“单次输入 -> 最终结果”演进为更清晰的协作流程
  - 让 Agent 更明确地暴露自己在做什么、为什么这么做、以及如何撤销
  - 让长时间编辑任务更安全、更可控

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

## 分支导航

| 阶段 | 状态 | 分支 | 链接 |
| --- | --- | --- | --- |
| 阶段 1：MVP CLI Agent | 已完成 | `stage/mvp` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmvp) |
| 阶段 2：Tool-Calling Agent Loop | 已完成 | `stage/tool-call` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ftool-call) |
| 阶段 3：工作区读写工具 | 当前阶段 | `main` | [打开分支](https://github.com/rookie-orange/agent-mvp/tree/main) |
| 阶段 4：交互层演进 | 规划中 | N/A | 尚未创建 |

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
  agent/     # agent 循环
  config/    # 环境变量配置
  llm/       # 模型调用层
  tools/     # 工具定义与执行
    files/   # 工作区读写与恢复工具
    git/     # Git 自检工具
  types/     # 共享类型
  index.ts   # CLI 入口
```

## 开发方式

安装依赖：

```bash
pnpm install
```

本地运行 Agent：

```bash
pnpm dev "这个项目里有哪些工具？"
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
pnpm start "列出 src/tools 目录下的文件"
```

## 说明

- 这些阶段分支被保留为学习检查点，方便回看项目是如何一步步演进的
- 当前实现依然是 CLI first。下一步更自然的演进方向不是继续堆工具，而是改进交互方式

## 下一步：交互演进路线

如果你的下一步重点是“交互方式变化”，我更推荐按下面的顺序演进：

### 1. 先让 Agent 的动作可见

目标：

- 让用户知道 Agent 打算做什么
- 让用户知道调用了哪些工具
- 让用户知道改了什么，以及怎么撤销

可做的事情：

- 在每次 tool call 前后打印简短步骤日志
- 把 `backupId` 更明显地展示出来
- 在修改后输出精简版的“改动文件 / git diff / 是否可回滚”摘要

### 2. 加确认边界

目标：

- 把安全读取和高风险写入分开

可做的事情：

- 读取类工具默认直接执行
- 写入类工具执行前先确认
- 为自动化或熟练用户保留 `--yes` 这类快速模式

### 3. 引入会话状态

目标：

- 让 Agent 不再只是“单轮 CLI 调用”

可做的事情：

- 在一个会话里保留最近的工具结果
- 缓存最近一个 backup，让“撤销上一步”更自然
- 在每轮结束时输出当前上下文摘要

### 4. 升级输出结构

目标：

- 让较长任务中的协作体验更清楚

可做的事情：

- 把输出拆成 `Plan`、`Actions`、`Result`、`Undo`
- 可选提供 JSON 模式，方便程序消费
- 增加精简模式和详细模式

### 5. 从 CLI 演进到交互式 UI

目标：

- 支持更长流程、更强可见性和更强控制力

可做的事情：

- 简单的 TUI 或 Web Chat
- 工具调用时间线
- diff 查看器
- 备份历史与一键回滚
- 写操作审批面板

### 推荐顺序

如果你想优先拿到最高收益，建议按这个顺序做：

1. 可见的步骤日志 + 修改摘要
2. 写入前确认边界
3. 会话级 `undo last change`
4. 结构化输出模式
5. TUI 或 Web UI

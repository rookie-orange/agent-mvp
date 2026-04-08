# agent-mvp

[English README](./README.md)

这是一个用于学习 AI Agent 演进过程的最小项目：从一次普通模型调用开始，逐步发展到具备完备的 Agent。

## 当前状态

当前已经具备的能力：

- 本地 CLI Agent 入口
- 基于 OpenAI 兼容接口的 `chat.completions` 调用
- 多步 tool-calling 循环
- 内置工具：
  - `getCurrentTime`
  - `listFiles`
  - `readLocalFile`
  - `searchInFiles`
- 通过 `tsdown` 构建可分发的 `.js` 产物

## 阶段进度

### 当前阶段

#### 阶段 3：工作区检查工具

- 状态：进行中，位于 [`main`](https://github.com/rookie-orange/agent-mvp/tree/main)
- 目标：
  - 让 Agent 在回答之前先检查本地工作区
  - 支持目录列举、文件读取和关键词搜索
  - 保持工具调用闭环尽可能小而清晰

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

## 项目结构

```txt
src/
  agent/     # agent 循环
  config/    # 环境变量配置
  llm/       # 模型调用层
  tools/     # 工具定义与执行
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

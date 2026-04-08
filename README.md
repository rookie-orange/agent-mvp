# agent-mvp

[中文说明](./README.zh-CN.md)

This is the smallest project designed for studying the evolution process of AI Agents: starting from a simple model call, it gradually develops into a fully-fledged Agent.

## Current Status

The project is currently in the **workspace inspection tools** stage on the [`main`](https://github.com/rookie-orange/agent-mvp/tree/main) branch.

Current capabilities:

- CLI entry for local agent execution
- OpenAI-compatible `chat.completions` integration
- Multi-step tool-calling loop
- Built-in tools:
  - `getCurrentTime`
  - `listFiles`
  - `readLocalFile`
  - `searchInFiles`
- `tsdown` build output for distributable `.js` files

## Stage Progress

### Current Stage

#### Stage 3: Workspace Inspection Tools

- Status: In progress on [`main`](https://github.com/rookie-orange/agent-mvp/tree/main)
- Focus:
  - let the agent inspect the local workspace before answering
  - support directory listing, file reading, and keyword search
  - keep the tool loop minimal and easy to understand

### Completed Stages

#### Stage 1: MVP CLI Agent

- Branch: [`stage/mvp`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmvp)
- What was completed:
  - basic CLI entry
  - environment loading via `dotenv`
  - OpenAI-compatible model call
  - minimal runnable agent skeleton

#### Stage 2: Tool-Calling Agent Loop

- Branch: [`stage/tool-call`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ftool-call)
- What was completed:
  - multi-step agent loop
  - tool registry and execution flow
  - first built-in tool: `getCurrentTime`
  - project restructuring for easier expansion

## Branch Map

| Stage | Status | Branch | Link |
| --- | --- | --- | --- |
| Stage 1: MVP CLI Agent | Completed | `stage/mvp` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmvp) |
| Stage 2: Tool-Calling Agent Loop | Completed | `stage/tool-call` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ftool-call) |

## Project Structure

```txt
src/
  agent/     # agent loop
  config/    # env config
  llm/       # model provider integration
  tools/     # tool definitions and execution
  types/     # shared types
  index.ts   # CLI entry
```

## Development

Install dependencies:

```bash
pnpm install
```

Run the agent locally:

```bash
pnpm dev "What tools are available in this project?"
```

Build with `tsdown`:

```bash
pnpm build
```

Start the built output:

```bash
pnpm start "List files under src/tools"
```

## Notes

- Stage branches are kept as learning checkpoints so the project history is easier to follow.

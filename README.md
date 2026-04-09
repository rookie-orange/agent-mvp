# agent-mvp

[中文说明](./README.zh-CN.md)

This is the smallest project designed for studying the evolution process of AI Agents: starting from a simple model call, it gradually develops into a fully-fledged Agent.

## Current Status

The project is currently in the **workspace read/write + git inspection + rollback safety** stage on the [`main`](https://github.com/rookie-orange/agent-mvp/tree/main) branch.

Current capabilities:

- CLI entry for local agent execution
- OpenAI-compatible `chat.completions` integration
- Multi-step tool-calling loop
- Built-in tools:
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
- Automatic mutation validation:
  - readback after writes
  - move/delete checks
  - git status + git diff inspection after file changes and restores
- Automatic backup generation before mutation tools run
- `tsdown` build output for distributable `.js` files

## Stage Progress

### Current Stage

#### Stage 3: Workspace Read/Write Tools

- Status: In progress on [`main`](https://github.com/rookie-orange/agent-mvp/tree/main)
- Focus:
  - let the agent inspect the local workspace before answering
  - support directory listing, file reading, keyword search, and controlled file modification
  - add git-aware self-checking after changes
  - add rollback primitives so file mutations are recoverable
  - keep the tool loop minimal and easy to understand

### Planned Next Stage

#### Stage 4: Interaction Layer

- Status: Planned, branch not created yet
- Focus:
  - improve the interaction model from "single prompt -> final answer" into a clearer collaborative workflow
  - expose what the agent is doing, why it is doing it, and what can be undone
  - make the agent safer to use for longer editing sessions

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
| Stage 3: Workspace Read/Write Tools | Current | `main` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/main) |
| Stage 4: Interaction Layer | Planned | N/A | Not created yet |

## Tool Groups

### Workspace Read Tools

- `listFiles`
- `readLocalFile`
- `readMultipleFiles`
- `searchInFiles`

### Git Inspection Tools

- `gitStatus`
- `gitDiff`

### Mutation Tools

- `writeFile`
- `replaceInFile`
- `applyFileEdits`
- `moveFile`
- `deleteFile`

### Recovery Tools

- `listBackups`
- `getLatestBackup`
- `restoreBackup`
- `rollbackLatest`

## Recovery Model

Every mutation tool now creates a backup before changing the workspace.

This means the agent can:

- inspect backup history with `listBackups`
- resolve the newest rollback target with `getLatestBackup`
- restore a specific backup with `restoreBackup`
- undo the latest matching change in one step with `rollbackLatest`

Typical rollback flow:

```txt
write/replace/move/delete
-> backup created automatically
-> validation checks file + git state
-> if needed: rollbackLatest
```

## Project Structure

```txt
src/
  agent/     # agent loop
  config/    # env config
  llm/       # model provider integration
  tools/     # tool definitions and execution
    files/   # workspace read/write/recovery tools
    git/     # git inspection tools
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

Try a rollback scenario:

```bash
pnpm dev "Create playground/undo-demo.txt with content hello undo"
pnpm dev "Replace hello undo with hello rollback in playground/undo-demo.txt"
pnpm dev "List recent backups"
pnpm dev "Rollback the latest change"
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
- The current implementation is still CLI-first. The next natural evolution is to improve interaction, not only add more tools.

## Next: Interaction Roadmap

If the next step is to change the interaction model, this is the most practical route:

### 1. Make Agent Actions Visible

Goal:

- show what the agent is planning to do
- show which tools were called
- show what changed and how to undo it

Ideas:

- print a short step log before and after each tool call
- surface the returned `backupId` in a more obvious way
- show a concise "changed files / git diff / rollback available" summary after mutations

### 2. Add Confirmation Boundaries

Goal:

- separate safe read operations from risky write operations

Ideas:

- allow reads without confirmation
- require a confirmation step before mutation tools
- support a `--yes` mode for power users or scripted runs

### 3. Introduce Session State

Goal:

- make the agent feel less like stateless CLI execution

Ideas:

- keep recent tool results in memory during a session
- keep the latest backup handy so "undo last change" works naturally
- show a current task/session summary at the end of each turn

### 4. Upgrade the Output Format

Goal:

- make the agent easier to collaborate with during longer tasks

Ideas:

- split output into sections like `Plan`, `Actions`, `Result`, `Undo`
- emit machine-friendly JSON in an optional mode
- add compact and verbose output modes

### 5. Move from CLI to Interactive UI

Goal:

- support longer workflows with better visibility and control

Ideas:

- a simple TUI or web chat
- tool timeline panel
- diff viewer
- backup history / one-click rollback
- approval UI for writes

### Recommended Order

If you want the highest leverage path, do it in this order:

1. visible step logs + mutation summary
2. confirmation boundary before writes
3. session-aware `undo last change`
4. structured output modes
5. TUI or web UI

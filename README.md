# agent-mvp

[中文说明](./README.zh-CN.md)

A minimal project for learning how an AI Agent evolves: start with a single model call, then gradually add tools, safety, rollback, persistent memory, and session management.

## Current Status

The project is currently in the **approval + validation loop on top of the interactive CLI** stage on the [`main`](https://github.com/rookie-orange/agent-mvp/tree/main) branch.

Current capabilities:

- interactive CLI entry
- OpenAI-compatible `chat.completions` integration
- multi-step tool-calling loop
- persistent project memory loaded from `.agent/memory.md`
- multi-session storage under `.agent/sessions/*.json`
- manual session loading instead of auto-restoring the previous conversation
- built-in CLI session commands:
  - `/sessions`
  - `/load <sessionId>`
  - `/new [title]`
  - `/rename <title>`
  - `/delete <sessionId>`
  - `/clear`
  - `/memory`
  - `/remember <content>`
  - `/forget`
- built-in tools:
  - `getCurrentTime`
  - `listFiles`
  - `readLocalFile`
  - `readMultipleFiles`
  - `searchInFiles`
  - `gitStatus`
  - `gitDiff`
  - `runCommand`
  - `validateWorkspace`
  - `listBackups`
  - `getLatestBackup`
  - `writeFile`
  - `replaceInFile`
  - `applyFileEdits`
  - `moveFile`
  - `deleteFile`
  - `restoreBackup`
  - `rollbackLatest`
- automatic mutation validation:
  - readback after writes
  - move/delete checks
  - git status + git diff inspection after file changes and restores
  - readable `changeSummary` generated from Git inspection after mutations
- approval boundary before mutation tools run
- whitelist command execution for validation workflows
- automatic `pnpm typecheck` + `pnpm build` after successful mutation tools
- automatic backup generation before mutation tools run
- `tsdown` build output for distributable `.js` files

## Stage Progress

### Current Stage

#### Stage 7: Approval And Validation Loop

- Status: In progress on [`main`](https://github.com/rookie-orange/agent-mvp/tree/main)
- Focus:
  - add confirmation boundaries before risky write actions
  - let the agent run whitelisted project commands
  - automatically validate edits with typecheck/build after mutations

### Planned Next Stage

#### Stage 8: Planner And Self-Review

- Status: Planned, branch not created yet
- Focus:
  - expose more visible action logs and diffs during long tasks
  - add task planning before complex edits
  - add a structured self-review summary after changes

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

#### Stage 3: Workspace File IO

- Branch: [`stage/file-io`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ffile-io)
- What was completed:
  - directory listing, local file reading, and multi-file reading
  - keyword search inside the workspace
  - controlled write / replace / move / delete file operations
  - initial workspace-aware agent behavior

#### Stage 4: Undo / Redo Safety Layer

- Branch: [`stage/undo-redo`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fundo-redo)
- What was completed:
  - automatic backups before mutation tools
  - rollback primitives and restore flow
  - mutation validation with file and git checks
  - safer file editing workflow

#### Stage 5: Persistent Memory Foundation

- Branch: [`stage/memory`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmemory)
- What was completed:
  - persistent project memory
  - persisted session history
  - CLI-level memory commands
  - memory injection into the agent prompt

#### Stage 6: Multi-Session Interactive CLI

- Branch: [`main`](https://github.com/rookie-orange/agent-mvp/tree/main)
- What was completed:
  - explicit multi-session management
  - manual session load instead of auto-resume
  - slash command registry split from CLI input handling
  - command-oriented interactive workflow

## Branch Map

| Stage | Status | Branch | Link |
| --- | --- | --- | --- |
| Stage 1: MVP CLI Agent | Completed | `stage/mvp` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmvp) |
| Stage 2: Tool-Calling Agent Loop | Completed | `stage/tool-call` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ftool-call) |
| Stage 3: Workspace File IO | Completed | `stage/file-io` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ffile-io) |
| Stage 4: Undo / Redo Safety Layer | Completed | `stage/undo-redo` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fundo-redo) |
| Stage 5: Persistent Memory Foundation | Completed | `stage/memory` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmemory) |
| Stage 6: Multi-Session Interactive CLI | Completed on current branch | `main` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/main) |
| Stage 7: Approval And Validation Loop | Current | `main` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/main) |
| Stage 8: Planner And Self-Review | Planned | N/A | Not created yet |

## Tool Groups

### Workspace Read Tools

- `listFiles`
- `readLocalFile`
- `readMultipleFiles`
- `searchInFiles`

### Git Inspection Tools

- `gitStatus`
- `gitDiff`

### Validation Tools

- `runCommand`
- `validateWorkspace`

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

## CLI Sessions And Memory

Session history and project memory are stored locally under `.agent/` and ignored by Git.

Storage layout:

```txt
.agent/
  memory.md
  sessions/
    <session-id>.json
```

Behavior:

- project memory is loaded automatically on startup
- previous conversations are **not** auto-loaded on startup
- saved sessions must be loaded explicitly with `/load <sessionId>`
- the first real message in a fresh draft creates a new saved session automatically

Useful commands:

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

Command semantics:

- `/clear`: clear the current in-memory conversation and remove its persisted session file if one is loaded
- `/delete <sessionId>`: remove a specific saved session by id
- `/rename <title>`: rename the current saved session, or rename the current draft title before it is first persisted

## Recovery Model

Every mutation tool creates a backup before changing the workspace.

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
  agent/        # agent loop and prompts
  cli/          # interactive CLI
  commands/     # slash commands and registry
  config/       # env config
  llm/          # model provider integration
  persistence/  # local memory and session storage
  tools/        # tool definitions and execution
    files/      # workspace read/write/recovery tools
    git/        # git inspection tools
    shell/      # command execution and workspace validation
  types/        # shared types
  index.ts      # CLI entry
```

## Development

Install dependencies:

```bash
pnpm install
```

Start interactive CLI:

```bash
pnpm dev
pnpm chat
```

Start interactive CLI with the first message:

```bash
pnpm dev "What tools are available in this project?"
```

Typical session workflow:

```txt
/sessions
/load session-20260410-abc123
/new refactor plan
/remember This project uses tsdown for builds
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
pnpm start
pnpm start "List files under src/tools"
```

## Notes

- stage branches are kept as learning checkpoints so the evolution path stays easy to inspect
- the current implementation is still CLI-first
- the interaction layer now exists, but approval boundaries and post-edit validation are still the next practical upgrades

## Next Practical Roadmap

The most useful next steps after the current state are:

1. add write confirmations and a `--yes` mode
2. stream model output and expose clearer action traces
3. add post-edit validation commands such as typecheck, tests, and lint
4. summarize long sessions so saved histories stay compact

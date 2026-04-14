# agent-mvp

[中文](./README.zh-CN.md)

A minimal project for learning how an AI Agent evolves: start with a basic model call, then gradually add tools, safety layers, rollback, persistent memory, and session management.

## Current Status

The project has entered the **interactive CLI stage with planner + approval / validation**. The current implementation lives on [`main`](https://github.com/rookie-orange/agent-mvp/tree/main). The previous milestone version is still preserved on the dedicated [`stage/approval-validation`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fapproval-validation) branch.

Current capabilities:

- interactive CLI Agent entry
- OpenAI-compatible `chat.completions` integration
- multi-step tool-calling loop
- automatic loading of project-level persistent memory from `.agent/memory.md`
- multi-session history stored under `.agent/sessions/*.json`
- previous conversations are not restored automatically on startup; users load sessions explicitly
- session-level planner state is persisted together with each saved session
- built-in CLI session commands:
  - `/sessions`
  - `/load <session-id>`
  - `/new [title]`
  - `/rename <title>`
  - `/delete <session-id>`
  - `/clear`
  - `/plan`
  - `/clear-plan`
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
- automatic mutation validation:
  - read back files after writes
  - verify moves / deletes after execution
  - attach Git status and diff checks after file mutations and restores
  - generate a readable `changeSummary` from Git inspection after mutations
- high-risk mutation tools require CLI approval before execution
- command execution is limited to a validation whitelist
- `pnpm typecheck` and `pnpm build` run automatically after successful mutations
- all mutation tools create backups before editing
- distributable `.js` output is built with `tsdown`

## Stage Progress

### Current Stage

#### Stage 8: Planner And Self-Review

- Status: In progress on [`planner`](https://github.com/rookie-orange/agent-mvp/tree/planner)
- Focus:
  - add task planning before complex edits
  - display and persist the current session plan in the CLI
  - output a more structured self-review summary after changes

### Recently Completed Stage

#### Stage 7: Approval And Validation Loop

- Status: Completed on [`stage/approval-validation`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fapproval-validation)
- What was completed:
  - add confirmation boundaries before risky write actions
  - let the Agent run whitelisted project commands
  - automatically run typecheck / build validation after edits

### Completed Stages

#### Stage 1: MVP CLI Agent

- Branch: [`stage/mvp`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmvp)
- What was completed:
  - basic CLI entry
  - environment loading via `dotenv`
  - OpenAI-compatible model integration
  - minimal runnable Agent skeleton

#### Stage 2: Tool-Calling Agent Loop

- Branch: [`stage/tool-call`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ftool-call)
- What was completed:
  - multi-step Agent loop
  - tool registry and execution flow
  - first built-in tool: `getCurrentTime`
  - project restructuring for future expansion

#### Stage 3: Workspace File IO

- Branch: [`stage/file-io`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ffile-io)
- What was completed:
  - directory listing, local file reading, and multi-file reading
  - workspace keyword search
  - controlled write / replace / move / delete operations
  - initial workspace-aware Agent behavior

#### Stage 4: Undo / Redo Safety Layer

- Branch: [`stage/undo-redo`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fundo-redo)
- What was completed:
  - automatic backups before writes
  - rollback primitives and restore flow
  - mutation validation with file and Git checks
  - a safer file editing workflow

#### Stage 5: Persistent Memory Foundation

- Branch: [`stage/memory`](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmemory)
- What was completed:
  - project-level persistent memory
  - persisted session history
  - CLI-level memory commands
  - memory injection into the Agent prompt

#### Stage 6: Continuous Conversation And Multi-Session CLI

- Branch: [`main`](https://github.com/rookie-orange/agent-mvp/tree/main)
- What was completed:
  - explicit multi-session management
  - manual session loading instead of auto-resume
  - slash command registry extracted from CLI input handling
  - command-oriented interaction workflow

## Branch Map

| Stage | Status | Branch | Link |
| --- | --- | --- | --- |
| Stage 1: MVP CLI Agent | Completed | `stage/mvp` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmvp) |
| Stage 2: Tool-Calling Agent Loop | Completed | `stage/tool-call` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ftool-call) |
| Stage 3: Workspace File IO | Completed | `stage/file-io` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/stage%2Ffile-io) |
| Stage 4: Undo / Redo Safety Layer | Completed | `stage/undo-redo` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fundo-redo) |
| Stage 5: Persistent Memory Foundation | Completed | `stage/memory` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fmemory) |
| Stage 6: Continuous Conversation And Multi-Session CLI | Completed on the current branch | `main` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/main) |
| Stage 7: Approval And Validation Loop | Completed | `stage/approval-validation` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/stage%2Fapproval-validation) |
| Stage 8: Planner And Self-Review | Currently progressing on `planner` | `planner` | [Open branch](https://github.com/rookie-orange/agent-mvp/tree/planner) |

## Tool Groups

### Workspace Read Tools

- `listFiles`
- `readLocalFile`
- `readMultipleFiles`
- `searchInFiles`

### Git Inspection Tools

- `gitStatus`
- `gitDiff`

### Validation Execution Tools

- `runCommand`
- `validateWorkspace`

### Planner Tools

- `updatePlan`

### Mutation Tools

- `writeFile`
- `replaceInFile`
- `applyFileEdits`
- `moveFile`
- `deleteFile`

### Recovery And Rollback Tools

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

Current behavior:

- project memory is loaded automatically on startup
- previous conversations are not auto-loaded on startup
- saved sessions must be loaded explicitly with `/load <sessionId>`
- a new draft session is only persisted after the first successful real interaction
- the current plan is saved with the session and restored when that session is loaded again

Common commands:

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

Command semantics:

- `/clear`: clear the current in-memory conversation and delete the persisted file of the currently loaded session
- `/delete <session-id>`: delete a saved session by id
- `/plan`: print the execution plan of the current session
- `/clear-plan`: clear only the current session plan without deleting conversation history
- `/rename <title>`: rename the current saved session, or rename the draft title before the session is first persisted

## Rollback Model

Every mutation tool automatically creates a backup before modifying the workspace.

That means the Agent can:

- inspect backup history with `listBackups`
- locate the latest rollback target with `getLatestBackup`
- restore a specific backup with `restoreBackup`
- undo the latest matching change with `rollbackLatest`

Typical rollback flow:

```txt
write/replace/move/delete
-> create backup automatically
-> validate file and git state
-> if needed: rollbackLatest
```

## Project Structure

```txt
src/
  agent/        # agent loop and prompts
  cli/          # interactive CLI
  commands/     # slash commands and command registry
  config/       # environment config
  llm/          # model integration layer
  planner/      # session-level plan model and formatting
  persistence/  # local memory and session storage
  tools/        # tool definitions and execution
    files/      # workspace read/write/recovery tools
    git/        # Git inspection tools
    planner/    # plan update tool
    shell/      # command execution and workspace validation tools
  types/        # shared types
  index.ts      # CLI entry
```

## Development

Install dependencies:

```bash
pnpm install
```

Configure environment variables:

```bash
# copy .env.example to .env
cp .env.example .env
# configure API key
OPENAI_API_KEY=your_openai_api_key_here
# configure base URL, defaults to https://api.openai.com/v1
OPENAI_BASE_URL=https://api.openai.com/v1
# configure model, defaults to gpt-4.1-mini
OPENAI_MODEL=gpt-4.1-mini
```

Start the CLI:

```bash
pnpm dev
```

Start the CLI with the first message:

```bash
pnpm dev "What tools are available in this project?"
```

A typical session workflow:

```txt
/sessions
/load session-20260410-abc123
/new Refactor discussion
/remember This project uses tsdown for builds
```

Try a rollback scenario:

```bash
pnpm dev "Please create playground/undo-demo.txt with content hello undo"
pnpm dev "Please replace hello undo with hello rollback in playground/undo-demo.txt"
pnpm dev "Please list recent backups"
pnpm dev "Please roll back the latest change"
```

Build with `tsdown`:

```bash
pnpm build
```

Run the built output:

```bash
pnpm start
pnpm start "List files under src/tools"
```

## Notes

- these stage branches are kept as learning checkpoints so you can review how the project evolved step by step

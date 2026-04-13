import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { resolveWorkspacePath, WORKSPACE_ROOT } from '../files/workspace'

/**
 * 默认最大状态条目数，超过后会截断并提示用户缩小范围。
 */
const DEFAULT_STATUS_MAX_ENTRIES = 50
/**
 * 默认 diff 上下文行数，超过后会截断并提示用户降低 contextLines。
 */
const MAX_STATUS_ENTRIES = 200
const DEFAULT_DIFF_CONTEXT_LINES = 3
const MAX_DIFF_CONTEXT_LINES = 10
const DEFAULT_DIFF_MAX_CHARS = 12000
const MAX_DIFF_CHARS = 40000
const MAX_UNTRACKED_FILE_BYTES = 64 * 1024
const REGEX_LINE_SPLIT = /\r?\n/

interface RunGitOptions {
  args: string[]
}

interface ScopeOptions {
  paths?: string[]
}

export interface GitStatusEntry {
  path: string
  code: string
  indexStatus: string
  workingTreeStatus: string
  statusLabel: string
}

export interface GitStatusSnapshot {
  scopePaths: string[]
  branch: string
  isClean: boolean
  totalEntries: number
  truncated: boolean
  entries: GitStatusEntry[]
}

export interface GitDiffSnapshot {
  scopePaths: string[]
  staged: boolean
  contextLines: number
  hasDiff: boolean
  truncated: boolean
  diff: string
}

export interface GitChangeSummaryFile {
  path: string
  code: string
  statusLabel: string
}

export interface GitChangeSummary {
  scopePaths: string[]
  isClean: boolean
  totalFiles: number
  truncated: boolean
  counts: Record<string, number>
  files: GitChangeSummaryFile[]
  diffStats: {
    changedFiles: number
    addedLines: number
    removedLines: number
    hasDiff: boolean
    truncated: boolean
  }
  headline: string
  notes: string[]
}

interface GitStatusSnapshotOptions extends ScopeOptions {
  maxEntries?: number
}

interface GitDiffSnapshotOptions extends ScopeOptions {
  staged?: boolean
  contextLines?: number
  maxChars?: number
}

function createGitError(detail: string) {
  if (detail.includes('not a git repository')) {
    return new Error('当前工作区不是 Git 仓库。')
  }

  if (detail.includes('spawn git ENOENT')) {
    return new Error('当前环境未安装 Git。')
  }

  const message = detail.trim() || '未知错误'

  return new Error(`Git 命令执行失败: ${message}`)
}

async function runGit({ args }: RunGitOptions) {
  return await new Promise<string>((resolve, reject) => {
    execFile(
      'git',
      args,
      {
        cwd: WORKSPACE_ROOT,
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(createGitError(`${stderr}\n${stdout}\n${error.message}`))
          return
        }

        resolve(stdout)
      },
    )
  })
}

function normalizeScopePaths(paths?: string[]) {
  if (!paths || paths.length === 0) {
    return {
      scopePaths: ['.'],
      pathspecArgs: [] as string[],
    }
  }

  const uniquePaths = new Set<string>()

  for (const requestedPath of paths) {
    const { relativePath } = resolveWorkspacePath(
      requestedPath,
      '只允许查看当前工作区内的 Git 信息。',
    )

    uniquePaths.add(relativePath)
  }

  const scopePaths = [...uniquePaths]

  if (scopePaths.length === 1 && scopePaths[0] === '.') {
    return {
      scopePaths,
      pathspecArgs: [] as string[],
    }
  }

  return {
    scopePaths,
    pathspecArgs: ['--', ...scopePaths],
  }
}

function trimLargeText(content: string, maxChars: number) {
  if (content.length <= maxChars) {
    return {
      content,
      truncated: false,
    }
  }

  return {
    content: `${content.slice(0, maxChars)}\n\n[diff 内容已截断，请缩小范围或降低 contextLines 后重试]`,
    truncated: true,
  }
}

function getStatusLabel(code: string) {
  if (code === '??') {
    return 'untracked'
  }

  if (code.includes('U')) {
    return 'unmerged'
  }

  if (code.includes('R')) {
    return 'renamed'
  }

  if (code.includes('C')) {
    return 'copied'
  }

  if (code.includes('A')) {
    return 'added'
  }

  if (code.includes('D')) {
    return 'deleted'
  }

  if (code.includes('M')) {
    return 'modified'
  }

  return 'changed'
}

const statusLabelTextMap: Record<string, string> = {
  added: '新增',
  modified: '修改',
  deleted: '删除',
  renamed: '重命名',
  untracked: '未跟踪',
  unmerged: '冲突',
  copied: '复制',
  changed: '变更',
}

function parseGitStatusEntry(line: string): GitStatusEntry | undefined {
  if (line.length < 4) {
    return undefined
  }

  const indexStatus = line[0] ?? ' '
  const workingTreeStatus = line[1] ?? ' '
  const path = line.slice(3)
  const code = `${indexStatus}${workingTreeStatus}`

  return {
    path,
    code,
    indexStatus,
    workingTreeStatus,
    statusLabel: getStatusLabel(code),
  }
}

export async function getGitStatusSnapshot({
  paths,
  maxEntries = DEFAULT_STATUS_MAX_ENTRIES,
}: GitStatusSnapshotOptions = {}): Promise<GitStatusSnapshot> {
  const { scopePaths, pathspecArgs } = normalizeScopePaths(paths)
  const output = await runGit({
    args: ['status', '--porcelain=v1', '--branch', '--untracked-files=all', ...pathspecArgs],
  })
  const lines = output.split(REGEX_LINE_SPLIT).filter(Boolean)
  const branchLine = lines[0]?.startsWith('## ')
    ? lines[0].slice(3).trim()
    : '(unknown)'
  const parsedEntries = lines
    .slice(lines[0]?.startsWith('## ') ? 1 : 0)
    .map(parseGitStatusEntry)
    .filter((entry): entry is GitStatusEntry => Boolean(entry))
  const safeMaxEntries = Math.min(Math.max(maxEntries, 1), MAX_STATUS_ENTRIES)
  const entries = parsedEntries.slice(0, safeMaxEntries)

  return {
    scopePaths,
    branch: branchLine,
    isClean: parsedEntries.length === 0,
    totalEntries: parsedEntries.length,
    truncated: parsedEntries.length > safeMaxEntries,
    entries,
  }
}

function summarizeDiffLines(diffText: string) {
  const lines = diffText.split(REGEX_LINE_SPLIT)
  let changedFiles = 0
  let addedLines = 0
  let removedLines = 0

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      changedFiles += 1
      continue
    }

    if (line.startsWith('+++ ') || line.startsWith('--- ') || line.startsWith('@@')) {
      continue
    }

    if (line.startsWith('+')) {
      addedLines += 1
      continue
    }

    if (line.startsWith('-')) {
      removedLines += 1
    }
  }

  return {
    changedFiles,
    addedLines,
    removedLines,
  }
}

function buildStatusCounts(entries: GitStatusEntry[]) {
  const counts: Record<string, number> = {}

  for (const entry of entries) {
    counts[entry.statusLabel] = (counts[entry.statusLabel] || 0) + 1
  }

  return counts
}

function formatStatusCounts(counts: Record<string, number>) {
  const orderedLabels = [
    'modified',
    'added',
    'deleted',
    'renamed',
    'untracked',
    'unmerged',
    'copied',
    'changed',
  ]
  const parts: string[] = []

  for (const label of orderedLabels) {
    const count = counts[label]

    if (!count) {
      continue
    }

    const text = statusLabelTextMap[label] || label
    parts.push(`${text} ${count} 个`)
  }

  return parts
}

export function buildGitChangeSummaryFromInspection(input: {
  status: GitStatusSnapshot
  diff: GitDiffSnapshot
}): GitChangeSummary {
  const { status, diff } = input
  const counts = buildStatusCounts(status.entries)
  const diffStats = summarizeDiffLines(diff.diff)
  const countParts = formatStatusCounts(counts)
  const notes: string[] = []

  if (status.truncated) {
    notes.push('Git 状态结果已截断。')
  }

  if (diff.truncated) {
    notes.push('Git diff 结果已截断。')
  }

  const headline = status.isClean
    ? '指定范围内没有 Git 改动。'
    : [
        `共影响 ${status.totalEntries} 个路径`,
        countParts.length > 0 ? `状态分布：${countParts.join('，')}` : '',
        diff.hasDiff ? `diff 统计：新增 ${diffStats.addedLines} 行，删除 ${diffStats.removedLines} 行` : '当前没有可展示的 diff',
      ].filter(Boolean).join('；')

  return {
    scopePaths: status.scopePaths,
    isClean: status.isClean,
    totalFiles: status.totalEntries,
    truncated: status.truncated || diff.truncated,
    counts,
    files: status.entries.map(entry => ({
      path: entry.path,
      code: entry.code,
      statusLabel: entry.statusLabel,
    })),
    diffStats: {
      changedFiles: diffStats.changedFiles,
      addedLines: diffStats.addedLines,
      removedLines: diffStats.removedLines,
      hasDiff: diff.hasDiff,
      truncated: diff.truncated,
    },
    headline,
    notes,
  }
}

function normalizeTextFileContent(content: string) {
  const normalized = content.replace(/\r\n/g, '\n')
  const hasTrailingNewline = normalized.endsWith('\n')
  const lines = hasTrailingNewline
    ? normalized.slice(0, -1).split('\n')
    : normalized.split('\n')

  if (lines.length === 1 && lines[0] === '') {
    return {
      lines: [] as string[],
      hasTrailingNewline,
    }
  }

  return {
    lines,
    hasTrailingNewline,
  }
}

async function buildUntrackedFileDiff(relativePath: string) {
  const { resolvedPath } = resolveWorkspacePath(
    relativePath,
    '只允许查看当前工作区内的 Git diff。',
  )
  const targetStat = await stat(resolvedPath)

  if (!targetStat.isFile()) {
    return `[跳过未跟踪目录或非文件路径: ${relativePath}]`
  }

  if (targetStat.size > MAX_UNTRACKED_FILE_BYTES) {
    return `[跳过未跟踪文件 diff，文件过大: ${relativePath}]`
  }

  const rawContent = await readFile(resolvedPath)

  if (rawContent.includes(0)) {
    return `[跳过未跟踪二进制文件 diff: ${relativePath}]`
  }

  const content = rawContent.toString('utf8')
  const { lines, hasTrailingNewline } = normalizeTextFileContent(content)
  const header = [
    `diff --git a/${relativePath} b/${relativePath}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${relativePath}`,
  ]

  if (lines.length === 0) {
    return header.join('\n')
  }

  const diffLines = [
    ...header,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map(line => `+${line}`),
  ]

  if (!hasTrailingNewline) {
    diffLines.push('\\ No newline at end of file')
  }

  return diffLines.join('\n')
}

async function collectUntrackedDiffs(scopePaths: string[], contextLines: number) {
  const status = await getGitStatusSnapshot({
    paths: scopePaths,
    maxEntries: MAX_STATUS_ENTRIES,
  })
  const untrackedEntries = status.entries.filter(entry => entry.code === '??')

  if (untrackedEntries.length === 0) {
    return ''
  }

  const diffs = await Promise.all(
    untrackedEntries.map(entry => buildUntrackedFileDiff(entry.path)),
  )

  const prefix = contextLines === DEFAULT_DIFF_CONTEXT_LINES
    ? []
    : [`[以下为未跟踪文件的完整新增内容，requested contextLines=${contextLines}]`]

  return [...prefix, ...diffs].join('\n\n')
}

export async function getGitDiffSnapshot({
  paths,
  staged = false,
  contextLines = DEFAULT_DIFF_CONTEXT_LINES,
  maxChars = DEFAULT_DIFF_MAX_CHARS,
}: GitDiffSnapshotOptions = {}): Promise<GitDiffSnapshot> {
  const safeContextLines = Math.min(Math.max(contextLines, 0), MAX_DIFF_CONTEXT_LINES)
  const safeMaxChars = Math.min(Math.max(maxChars, 1), MAX_DIFF_CHARS)
  const { scopePaths, pathspecArgs } = normalizeScopePaths(paths)
  const trackedDiff = await runGit({
    args: [
      'diff',
      '--no-ext-diff',
      `--unified=${safeContextLines}`,
      ...(staged ? ['--cached'] : []),
      ...pathspecArgs,
    ],
  })
  const untrackedDiff = staged
    ? ''
    : await collectUntrackedDiffs(scopePaths, safeContextLines)
  const combinedDiff = [trackedDiff.trimEnd(), untrackedDiff.trimEnd()]
    .filter(Boolean)
    .join('\n\n')
  const trimmed = trimLargeText(combinedDiff, safeMaxChars)

  return {
    scopePaths,
    staged,
    contextLines: safeContextLines,
    hasDiff: combinedDiff.length > 0,
    truncated: trimmed.truncated,
    diff: trimmed.content,
  }
}

export async function buildGitInspection(paths: string[]) {
  const [status, diff] = await Promise.all([
    getGitStatusSnapshot({
      paths,
      maxEntries: 20,
    }),
    getGitDiffSnapshot({
      paths,
      maxChars: 6000,
    }),
  ])

  return {
    status,
    diff,
  }
}

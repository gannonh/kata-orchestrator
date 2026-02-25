import type { SpaceRecord } from '@shared/types/space'

// Invariant: `archived: true` must always be paired with `status: 'archived'`,
// and `archived: false` must never have `status: 'archived'`. Code that reads
// these fields (e.g. statusDotClassName, showArchived filter) relies on this
// consistency. Enforce it at any creation or update site.
export type DisplaySpace = SpaceRecord & {
  repo: string
  elapsed: string
  archived: boolean
}

function parseRepoName(repoUrl: string): string {
  const trimmed = repoUrl.trim()
  const sshMatch = /^git@[^:]+:(.+)$/.exec(trimmed)
  const candidatePath = sshMatch?.[1] ?? (() => {
    try {
      return new URL(trimmed).pathname
    } catch {
      return trimmed
    }
  })()

  const normalizedPath = candidatePath
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')

  const segments = normalizedPath.split('/').filter(Boolean)
  if (segments.length >= 2) {
    return `${segments[segments.length - 2]}/${segments[segments.length - 1]}`
  }

  return ''
}

export function toDisplaySpace(record: SpaceRecord): DisplaySpace {
  const repo = parseRepoName(record.repoUrl)

  return {
    ...record,
    repo,
    elapsed: '',
    archived: record.status === 'archived'
  }
}

export const mockSpaces: DisplaySpace[] = [
  {
    id: 'space-wave-1',
    name: 'Unblock Wave 1 verification',
    repoUrl: 'https://github.com/gannonh/kata-cloud',
    rootPath: '/Users/gannonh/dev/kata/kata-cloud',
    repo: 'gannonh/kata-cloud',
    branch: 'main',
    orchestrationMode: 'team',
    createdAt: '2026-02-20T10:00:00.000Z',
    elapsed: '2h',
    archived: false,
    status: 'active'
  },
  {
    id: 'space-left-panel',
    name: 'Left panel parity follow-ups',
    repoUrl: 'https://github.com/gannonh/kata-cloud',
    rootPath: '/Users/gannonh/dev/kata/kata-cloud',
    repo: 'gannonh/kata-cloud',
    branch: 'feature/left-panel',
    orchestrationMode: 'team',
    createdAt: '2026-02-21T09:00:00.000Z',
    elapsed: '48m',
    archived: false,
    status: 'idle'
  },
  {
    id: 'space-docs-sync',
    name: 'Docs and release sync',
    repoUrl: 'https://github.com/gannonh/kata-orchestrator',
    rootPath: '/Users/gannonh/dev/kata/kata-orchestrator',
    repo: 'gannonh/kata-orchestrator',
    branch: 'main',
    orchestrationMode: 'single',
    createdAt: '2026-02-22T14:00:00.000Z',
    elapsed: '15m',
    archived: false,
    status: 'idle'
  },
  {
    id: 'space-archived-migration',
    name: 'Archived migration notes',
    repoUrl: 'https://github.com/gannonh/kata-orchestrator',
    rootPath: '/Users/gannonh/dev/kata/kata-orchestrator',
    repo: 'gannonh/kata-orchestrator',
    branch: 'archive/notes',
    orchestrationMode: 'single',
    createdAt: '2026-02-18T08:00:00.000Z',
    elapsed: '1d',
    archived: true,
    status: 'archived'
  }
]

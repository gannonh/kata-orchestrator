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

export function toDisplaySpace(record: SpaceRecord): DisplaySpace {
  const urlParts = record.repoUrl.split('/')
  const repo = urlParts.slice(-2).join('/')

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

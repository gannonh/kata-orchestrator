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

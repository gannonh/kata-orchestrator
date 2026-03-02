// Split on / and : to handle both HTTPS paths and SSH-style git@host:org/repo URLs.
export function extractRepoLabel(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '').replace(/\.git$/i, '')
  const segments = normalized.split(/[/:]/)
  return segments[segments.length - 1] || 'repo'
}

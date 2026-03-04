export function toStableTaskId(title: string, seenIds: Map<string, number>): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'task'

  const nextCount = (seenIds.get(slug) ?? 0) + 1
  seenIds.set(slug, nextCount)

  if (nextCount === 1) {
    return `task-${slug}`
  }

  return `task-${slug}-${nextCount}`
}

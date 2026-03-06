export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)

  if (Number.isNaN(date.getTime())) {
    return 'Just now'
  }

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) {
    return 'Just now'
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)

  return `${days}d ago`
}

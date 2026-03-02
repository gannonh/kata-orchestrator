import type { SpecTaskStatus } from '../../types/spec-document'

export function cycleTaskStatus(status: SpecTaskStatus): SpecTaskStatus {
  if (status === 'not_started') {
    return 'in_progress'
  }

  if (status === 'in_progress') {
    return 'complete'
  }

  return 'not_started'
}

export function markerForStatus(status: SpecTaskStatus): string {
  if (status === 'not_started') {
    return '[ ]'
  }

  if (status === 'in_progress') {
    return '[/]'
  }

  return '[x]'
}

export function updateTaskLineInMarkdown(
  markdown: string,
  lineIndex: number,
  next: SpecTaskStatus
): string {
  const lineEnding = markdown.includes('\r\n') ? '\r\n' : '\n'
  const lines = markdown.split(lineEnding)
  const targetLine = lines[lineIndex]

  if (targetLine === undefined) {
    return markdown
  }

  lines[lineIndex] = targetLine.replace(/\[(?: |\/|x|X)\]/, markerForStatus(next))
  return lines.join(lineEnding)
}

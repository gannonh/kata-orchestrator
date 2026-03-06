import type { ParsedSpecTaskStatus } from './spec-markdown-types'

export function cycleTaskBlockStatus(status: ParsedSpecTaskStatus): ParsedSpecTaskStatus {
  if (status === 'not_started') {
    return 'in_progress'
  }

  if (status === 'in_progress') {
    return 'complete'
  }

  return 'not_started'
}

export function markerForTaskBlockStatus(status: ParsedSpecTaskStatus): string {
  if (status === 'not_started') {
    return '[ ]'
  }

  if (status === 'in_progress') {
    return '[/]'
  }

  return '[x]'
}

export function updateTaskBlockLineInMarkdown(
  markdown: string,
  lineIndex: number,
  next: ParsedSpecTaskStatus
): string {
  const lineEnding = markdown.includes('\r\n') ? '\r\n' : '\n'
  const lines = markdown.split(/\r?\n/)
  const targetLine = lines[lineIndex]

  if (targetLine === undefined) {
    return markdown
  }

  lines[lineIndex] = targetLine.replace(/\[(?: |\/|x|X)\]/, markerForTaskBlockStatus(next))
  return lines.join(lineEnding)
}

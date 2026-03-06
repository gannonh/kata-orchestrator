import { toStableTaskId } from '@shared/task-id'

import type {
  ParsedSpecMarkdownDocument,
  ParsedSpecTaskItem,
  ParsedSpecTaskStatus
} from './spec-markdown-types'

interface IndexedLine {
  content: string
  lineIndex: number
}

type KnownSectionKey =
  | 'goal'
  | 'acceptanceCriteria'
  | 'nonGoals'
  | 'assumptions'
  | 'verificationPlan'
  | 'rollbackPlan'
  | 'tasks'

const SECTION_NAME_TO_KEY: Record<string, KnownSectionKey> = {
  goal: 'goal',
  'acceptance criteria': 'acceptanceCriteria',
  'non-goals': 'nonGoals',
  'non goals': 'nonGoals',
  assumptions: 'assumptions',
  'verification plan': 'verificationPlan',
  'rollback plan': 'rollbackPlan',
  tasks: 'tasks'
}

export function parseSpecMarkdown(markdown: string): ParsedSpecMarkdownDocument {
  const sectionLines = new Map<KnownSectionKey, IndexedLine[]>()
  const lines = markdown.split(/\r?\n/)
  let currentSection: KnownSectionKey | null = null

  lines.forEach((line, lineIndex) => {
    const headingMatch = line.match(/^##\s+(.+?)\s*$/)

    if (headingMatch) {
      currentSection = SECTION_NAME_TO_KEY[normalizeHeading(headingMatch[1])] ?? null
      if (currentSection && !sectionLines.has(currentSection)) {
        sectionLines.set(currentSection, [])
      }
      return
    }

    if (!currentSection) {
      return
    }

    sectionLines.get(currentSection)!.push({ content: line, lineIndex })
  })

  return {
    markdown,
    sections: {
      goal: normalizeTextBlock(sectionLines.get('goal') ?? []),
      acceptanceCriteria: normalizeListItems(sectionLines.get('acceptanceCriteria') ?? []),
      nonGoals: normalizeListItems(sectionLines.get('nonGoals') ?? []),
      assumptions: normalizeListItems(sectionLines.get('assumptions') ?? []),
      verificationPlan: normalizeListItems(sectionLines.get('verificationPlan') ?? []),
      rollbackPlan: normalizeListItems(sectionLines.get('rollbackPlan') ?? [])
    },
    tasks: normalizeTasks(sectionLines.get('tasks') ?? []),
    updatedAt: new Date().toISOString()
  }
}

function normalizeHeading(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizeTextBlock(lines: IndexedLine[]): string {
  return trimBlankEdges(lines.map((line) => line.content.trimEnd())).join('\n')
}

function normalizeListItems(lines: IndexedLine[]): string[] {
  const items: string[] = []
  let currentItemLines: string[] = []
  let openFenceMarker: string | null = null

  lines.forEach(({ content }) => {
    const trimmedEnd = content.trimEnd()
    const trimmed = trimmedEnd.trim()

    if (openFenceMarker) {
      currentItemLines.push(trimmedEnd)
      if (isMatchingFenceLine(trimmed, openFenceMarker)) {
        openFenceMarker = null
      }
      return
    }

    const listItemMatch = trimmedEnd.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+?)\s*$/)

    if (listItemMatch) {
      pushNormalizedListItem(items, currentItemLines)
      currentItemLines = [listItemMatch[1].trim()]
      return
    }

    if (currentItemLines.length > 0) {
      if (trimmed === '') {
        currentItemLines.push('')
        return
      }

      const fenceMarker = getFenceMarker(trimmed)
      if (fenceMarker) {
        currentItemLines.push(trimmedEnd)
        openFenceMarker = fenceMarker
        return
      }

      if (isNestedListItem(trimmedEnd)) {
        return
      }

      if (isIndentedContinuation(trimmedEnd)) {
        currentItemLines.push(trimmedEnd)
        return
      }

      pushNormalizedListItem(items, currentItemLines)
      currentItemLines = [trimmedEnd.trim()]
      return
    }

    if (trimmed) {
      currentItemLines = [trimmed]
      openFenceMarker = getFenceMarker(trimmed)
    }
  })

  pushNormalizedListItem(items, currentItemLines)

  return items
}

function normalizeTasks(lines: IndexedLine[]): ParsedSpecTaskItem[] {
  const tasks: ParsedSpecTaskItem[] = []
  const seenIds = new Map<string, number>()

  lines.forEach(({ content, lineIndex }) => {
    const match = content.match(/^\s*(?:(?:[-*+]\s+|\d+[.)]\s+))?\[( |\/|x|X)\]\s+(.*?)\s*$/)
    if (!match) {
      return
    }

    const title = match[2]

    tasks.push({
      id: toStableTaskId(title, seenIds),
      title,
      status: statusForMarker(match[1]),
      markdownLineIndex: lineIndex
    })
  })

  return tasks
}

function statusForMarker(marker: string): ParsedSpecTaskStatus {
  if (marker === '/') {
    return 'in_progress'
  }

  if (marker.toLowerCase() === 'x') {
    return 'complete'
  }

  return 'not_started'
}

function trimBlankEdges(values: string[]): string[] {
  let start = 0
  let end = values.length

  while (start < end && values[start].trim() === '') {
    start += 1
  }

  while (end > start && values[end - 1].trim() === '') {
    end -= 1
  }

  return values.slice(start, end)
}

function pushNormalizedListItem(items: string[], itemLines: string[]): void {
  const normalized = normalizeListItem(itemLines)
  if (normalized) {
    items.push(normalized)
  }
}

function normalizeListItem(lines: string[]): string {
  const trimmedLines = trimBlankEdges(lines)

  if (trimmedLines.length === 0) {
    return ''
  }

  const [firstLine, ...continuationLines] = trimmedLines
  const dedentedContinuationLines = dedentLines(continuationLines)

  if (shouldCollapseContinuationLines(dedentedContinuationLines)) {
    return [firstLine, ...dedentedContinuationLines.map((line) => line.trim())].join(' ')
  }

  return trimBlankEdges([firstLine, ...dedentedContinuationLines]).join('\n')
}

function dedentLines(lines: string[]): string[] {
  const nonBlankLines = lines.filter((line) => line.trim() !== '')
  if (nonBlankLines.length === 0) {
    return lines
  }

  const sharedIndent = Math.min(
    ...nonBlankLines.map((line) => {
      const match = line.match(/^\s*/)
      return match?.[0].length ?? 0
    })
  )

  return lines.map((line) => line.slice(Math.min(sharedIndent, line.length)))
}

function getFenceMarker(line: string): string | null {
  const match = line.match(/^(`{3,}|~{3,})/)
  return match?.[1] ?? null
}

function isMatchingFenceLine(line: string, openFenceMarker: string): boolean {
  const marker = getFenceMarker(line)
  return marker !== null && marker[0] === openFenceMarker[0]
}

function isNestedListItem(line: string): boolean {
  return /^\s+(?:[-*+]\s+|\d+[.)]\s+)/.test(line)
}

function isIndentedContinuation(line: string): boolean {
  return /^\s+/.test(line)
}

function shouldCollapseContinuationLines(lines: string[]): boolean {
  return (
    lines.length > 0 &&
    lines.every((line) => {
      const trimmed = line.trim()
      return trimmed !== '' && !/^(?:```|~~~)/.test(trimmed)
    })
  )
}

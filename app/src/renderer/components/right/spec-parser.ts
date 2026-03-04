import type {
  SpecTaskItem,
  SpecTaskStatus,
  StructuredSpecDocument
} from '../../types/spec-document'

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

export function parseStructuredSpec(markdown: string): StructuredSpecDocument {
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
  const values = lines.map((line) => line.content.trimEnd())

  let start = 0
  let end = values.length

  while (start < end && values[start].trim() === '') {
    start += 1
  }

  while (end > start && values[end - 1].trim() === '') {
    end -= 1
  }

  return values.slice(start, end).join('\n')
}

function normalizeListItems(lines: IndexedLine[]): string[] {
  const items: string[] = []

  lines.forEach(({ content }) => {
    const listItemMatch = content.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+?)\s*$/)
    if (listItemMatch) {
      items.push(listItemMatch[1].trim())
      return
    }

    const nestedListMatch = content.match(/^\s+(?:[-*+]\s+|\d+[.)]\s+).+$/)
    if (nestedListMatch) {
      return
    }

    const continuationMatch = content.match(/^\s+(.+?)\s*$/)
    if (continuationMatch && items.length > 0) {
      const previousIndex = items.length - 1
      items[previousIndex] = `${items[previousIndex]} ${continuationMatch[1].trim()}`
      return
    }

    const trimmed = content.trim()
    if (trimmed) {
      items.push(trimmed)
    }
  })

  return items
}

function normalizeTasks(lines: IndexedLine[]): SpecTaskItem[] {
  const tasks: SpecTaskItem[] = []
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

function toStableTaskId(title: string, seenIds: Map<string, number>): string {
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

function statusForMarker(marker: string): SpecTaskStatus {
  if (marker === '/') {
    return 'in_progress'
  }

  if (marker.toLowerCase() === 'x') {
    return 'complete'
  }

  return 'not_started'
}

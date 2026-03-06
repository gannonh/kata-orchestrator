import path from 'node:path'

import type {
  SpecArtifactDiagnostic,
  SpecArtifactFrontmatter,
  SpecArtifactStatus
} from '../shared/types/spec-document'

const DEFAULT_STATUS: SpecArtifactStatus = 'drafting'
const FRONTMATTER_DELIMITER = '---'

export type ParsedSpecArtifactFile = {
  raw: string
  markdown: string
  frontmatter: SpecArtifactFrontmatter
  diagnostics: SpecArtifactDiagnostic[]
}

export function buildSpecArtifactPath(spaceRootPath: string, sessionId: string): string {
  return path.join(spaceRootPath, '.kata', 'sessions', sessionId, 'notes', 'spec.md')
}

export function buildDefaultSpecArtifact(updatedAt: string): string {
  return [
    FRONTMATTER_DELIMITER,
    'status: drafting',
    `updatedAt: ${updatedAt}`,
    FRONTMATTER_DELIMITER,
    '',
    '## Goal',
    '',
    '## Acceptance Criteria',
    '',
    '## Non-goals',
    '',
    '## Assumptions',
    '',
    '## Verification Plan',
    '',
    '## Rollback Plan',
    '',
    '## Tasks',
    ''
  ].join('\n')
}

export function parseSpecArtifactFile(raw: string): ParsedSpecArtifactFile {
  const sections = splitFrontmatter(raw)

  if (!sections) {
    return {
      raw,
      markdown: raw,
      frontmatter: buildFallbackFrontmatter(),
      diagnostics: [
        {
          code: 'invalid_frontmatter_shape',
          message: 'Spec artifact must start with YAML frontmatter.'
        }
      ]
    }
  }

  const parsedFrontmatter = parseFrontmatter(sections.frontmatter)

  return {
    raw,
    markdown: sections.markdown,
    frontmatter: parsedFrontmatter.frontmatter,
    diagnostics: parsedFrontmatter.diagnostics
  }
}

export function serializeSpecArtifactFile(input: {
  frontmatter: SpecArtifactFrontmatter
  markdown: string
}): string {
  const lines = [
    FRONTMATTER_DELIMITER,
    `status: ${input.frontmatter.status}`,
    `updatedAt: ${input.frontmatter.updatedAt}`
  ]

  if (input.frontmatter.sourceRunId) {
    lines.push(`sourceRunId: ${input.frontmatter.sourceRunId}`)
  }

  lines.push(FRONTMATTER_DELIMITER, '', input.markdown)

  return lines.join('\n')
}

function splitFrontmatter(raw: string): { frontmatter: string; markdown: string } | null {
  const normalized = raw.replace(/\r\n/g, '\n')

  if (!normalized.startsWith(`${FRONTMATTER_DELIMITER}\n`)) {
    return null
  }

  const closingIndex = normalized.indexOf(`\n${FRONTMATTER_DELIMITER}\n`, FRONTMATTER_DELIMITER.length + 1)

  if (closingIndex === -1) {
    return null
  }

  return {
    frontmatter: normalized.slice(FRONTMATTER_DELIMITER.length + 1, closingIndex),
    markdown: normalized
      .slice(closingIndex + (`\n${FRONTMATTER_DELIMITER}\n`).length)
      .replace(/^\n/, '')
  }
}

function parseFrontmatter(frontmatterBlock: string): {
  frontmatter: SpecArtifactFrontmatter
  diagnostics: SpecArtifactDiagnostic[]
} {
  const diagnostics: SpecArtifactDiagnostic[] = []
  const candidate: Partial<SpecArtifactFrontmatter> = {}
  const lines = frontmatterBlock.split('\n')

  for (const [index, line] of lines.entries()) {
    if (line.trim().length === 0) {
      continue
    }

    const match = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(line)

    if (!match) {
      diagnostics.push({
        code: 'invalid_frontmatter_yaml',
        message: 'Frontmatter must contain only key: value entries.',
        line: index + 1
      })
      return { frontmatter: buildFallbackFrontmatter(), diagnostics }
    }

    const [, key, value] = match

    if (/[{}\[\]]/.test(value)) {
      diagnostics.push({
        code: 'invalid_frontmatter_yaml',
        message: 'Frontmatter values must be plain scalars.',
        line: index + 1
      })
      return { frontmatter: buildFallbackFrontmatter(), diagnostics }
    }

    if (key === 'status') {
      candidate.status = value as SpecArtifactStatus
      continue
    }

    if (key === 'updatedAt') {
      candidate.updatedAt = value
      continue
    }

    if (key === 'sourceRunId') {
      candidate.sourceRunId = value
      continue
    }

    diagnostics.push({
      code: 'invalid_frontmatter_shape',
      message: `Unknown frontmatter key: ${key}.`,
      line: index + 1
    })
    return { frontmatter: buildFallbackFrontmatter(), diagnostics }
  }

  if (candidate.status !== 'drafting' && candidate.status !== 'ready') {
    diagnostics.push({
      code: 'invalid_frontmatter_shape',
      message: 'Frontmatter status must be drafting or ready.'
    })
  }

  if (typeof candidate.updatedAt !== 'string' || candidate.updatedAt.length === 0) {
    diagnostics.push({
      code: 'invalid_frontmatter_shape',
      message: 'Frontmatter updatedAt must be a non-empty string.'
    })
  }

  if (diagnostics.length > 0) {
    return { frontmatter: buildFallbackFrontmatter(), diagnostics }
  }

  return {
    frontmatter: {
      status: candidate.status,
      updatedAt: candidate.updatedAt,
      sourceRunId: candidate.sourceRunId
    },
    diagnostics
  }
}

function buildFallbackFrontmatter(): SpecArtifactFrontmatter {
  return {
    status: DEFAULT_STATUS,
    updatedAt: ''
  }
}

import fs from 'node:fs'
import path from 'node:path'

import type {
  SpecArtifactDiagnostic,
  SpecArtifactFrontmatter,
  SpecArtifactStatus,
  PersistedSpecDocument
} from '../shared/types/spec-document'

const DEFAULT_STATUS: SpecArtifactStatus = 'drafting'
const FRONTMATTER_DELIMITER = '---'

export type ParsedSpecArtifactFile = {
  raw: string
  markdown: string
  frontmatter: SpecArtifactFrontmatter
  diagnostics: SpecArtifactDiagnostic[]
}

type PersistedSpecArtifactProjectionInput = {
  sourcePath: string
  raw: string
  fallbackUpdatedAt: string
  previous?: PersistedSpecDocument
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

export function buildPersistedSpecDocument(
  input: PersistedSpecArtifactProjectionInput
): PersistedSpecDocument {
  const parsed = parseSpecArtifactFile(input.raw)
  const currentIsValid = parsed.diagnostics.length === 0
  const previous = input.previous
  const previousLastGoodMarkdown =
    previous?.diagnostics.length === 0 ? previous.markdown : previous?.lastGoodMarkdown
  const previousLastGoodFrontmatter =
    previous?.diagnostics.length === 0 ? previous.frontmatter : previous?.lastGoodFrontmatter
  const lastGoodMarkdown = currentIsValid ? parsed.markdown : previousLastGoodMarkdown
  const lastGoodFrontmatter = currentIsValid ? parsed.frontmatter : previousLastGoodFrontmatter

  return {
    sourcePath: input.sourcePath,
    raw: input.raw,
    markdown: parsed.markdown,
    frontmatter: parsed.frontmatter,
    diagnostics: parsed.diagnostics,
    updatedAt: parsed.frontmatter.updatedAt || input.fallbackUpdatedAt,
    ...(lastGoodMarkdown !== undefined && { lastGoodMarkdown }),
    ...(lastGoodFrontmatter !== undefined && { lastGoodFrontmatter }),
    ...(parsed.frontmatter.sourceRunId !== undefined && {
      appliedRunId: parsed.frontmatter.sourceRunId
    })
  }
}

export async function loadSpecArtifactDocument(input: {
  sourcePath: string
  fallbackUpdatedAt: string
  previous?: PersistedSpecDocument
}): Promise<PersistedSpecDocument> {
  let raw: string

  try {
    raw = await fs.promises.readFile(input.sourcePath, 'utf-8')
  } catch (error) {
    if (!isErrnoCode(error, 'ENOENT')) {
      throw error
    }

    raw = buildDefaultSpecArtifact(input.fallbackUpdatedAt)
    await fs.promises.mkdir(path.dirname(input.sourcePath), { recursive: true })
    await fs.promises.writeFile(input.sourcePath, raw, 'utf-8')
  }

  return buildPersistedSpecDocument({
    sourcePath: input.sourcePath,
    raw,
    fallbackUpdatedAt: input.fallbackUpdatedAt,
    previous: input.previous
  })
}

export async function saveSpecArtifactDocument(input: {
  sourcePath: string
  frontmatter: SpecArtifactFrontmatter
  markdown: string
  previous?: PersistedSpecDocument
}): Promise<PersistedSpecDocument> {
  const raw = serializeSpecArtifactFile({
    frontmatter: input.frontmatter,
    markdown: input.markdown
  })

  await fs.promises.mkdir(path.dirname(input.sourcePath), { recursive: true })
  await fs.promises.writeFile(input.sourcePath, raw, 'utf-8')

  return buildPersistedSpecDocument({
    sourcePath: input.sourcePath,
    raw,
    fallbackUpdatedAt: input.frontmatter.updatedAt,
    previous: input.previous
  })
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

  if (candidate.status !== 'drafting' && candidate.status !== 'ready') {
    return { frontmatter: buildFallbackFrontmatter(), diagnostics }
  }

  if (typeof candidate.updatedAt !== 'string' || candidate.updatedAt.length === 0) {
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

function isErrnoCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  )
}

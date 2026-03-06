export type MarkdownRenderMode = 'settled' | 'streaming'

type FenceInfo = {
  length: number
  prefix: string
}

function consumeLeadingWhitespace(line: string, startIndex: number): number {
  let index = startIndex

  while (line[index] === ' ' || line[index] === '\t') {
    index += 1
  }

  return index
}

function consumeOrderedListMarker(line: string, startIndex: number): number | null {
  let index = startIndex

  while (/\d/.test(line[index] ?? '')) {
    index += 1
  }

  if (index === startIndex) {
    return null
  }

  if ((line[index] !== '.' && line[index] !== ')') || (line[index + 1] !== ' ' && line[index + 1] !== '\t')) {
    return null
  }

  return index + 2
}

function consumeListMarker(line: string, startIndex: number): number | null {
  if (
    (line[startIndex] === '-' || line[startIndex] === '+' || line[startIndex] === '*') &&
    (line[startIndex + 1] === ' ' || line[startIndex + 1] === '\t')
  ) {
    return startIndex + 2
  }

  return consumeOrderedListMarker(line, startIndex)
}

function getFenceInfo(line: string): FenceInfo | null {
  let index = consumeLeadingWhitespace(line, 0)

  while (true) {
    if (line[index] === '>') {
      index += 1
      index = consumeLeadingWhitespace(line, index)
      continue
    }

    const nextIndex = consumeListMarker(line, index)
    if (nextIndex === null) {
      break
    }

    index = consumeLeadingWhitespace(line, nextIndex)
  }

  let fenceEnd = index
  while (line[fenceEnd] === '`') {
    fenceEnd += 1
  }

  if (fenceEnd - index < 3) {
    return null
  }

  return {
    length: fenceEnd - index,
    prefix: line.slice(0, index)
  }
}

export function normalizeMarkdownForRender(
  content: string,
  mode: MarkdownRenderMode
): string {
  if (mode === 'settled') {
    return content
  }

  let activeFence: FenceInfo | null = null

  for (const line of content.split('\n')) {
    const fence = getFenceInfo(line)
    if (fence === null) {
      continue
    }

    if (activeFence === null) {
      activeFence = fence
      continue
    }

    if (fence.length >= activeFence.length) {
      activeFence = null
    }
  }

  if (activeFence !== null) {
    return `${content}\n${activeFence.prefix}${'`'.repeat(activeFence.length)}`
  }

  return content
}

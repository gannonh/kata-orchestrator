export type MarkdownRenderMode = 'settled' | 'streaming'

type FenceInfo = {
  length: number
  prefix: string
  suffix: string
}

type WhitespaceInfo = {
  index: number
  width: number
}

function consumeLeadingWhitespace(line: string, startIndex: number): WhitespaceInfo {
  let index = startIndex
  let width = 0

  while (line[index] === ' ' || line[index] === '\t') {
    width += line[index] === '\t' ? 4 : 1
    index += 1
  }

  return { index, width }
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
  let whitespace = consumeLeadingWhitespace(line, 0)
  let index = whitespace.index
  let fenceIndent = whitespace.width

  while (true) {
    if (line[index] === '>') {
      index += 1
      whitespace = consumeLeadingWhitespace(line, index)
      index = whitespace.index
      fenceIndent = whitespace.width
      continue
    }

    const nextIndex = consumeListMarker(line, index)
    if (nextIndex === null) {
      break
    }

    whitespace = consumeLeadingWhitespace(line, nextIndex)
    index = whitespace.index
    fenceIndent = whitespace.width
  }

  if (fenceIndent > 3) {
    return null
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
    prefix: line.slice(0, index),
    suffix: line.slice(fenceEnd)
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

    if (fence.length >= activeFence.length && /^[ \t]*$/.test(fence.suffix)) {
      activeFence = null
    }
  }

  if (activeFence !== null) {
    return `${content}\n${activeFence.prefix}${'`'.repeat(activeFence.length)}`
  }

  return content
}

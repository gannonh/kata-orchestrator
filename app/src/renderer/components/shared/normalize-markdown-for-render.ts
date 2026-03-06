export type MarkdownRenderMode = 'settled' | 'streaming'

type FenceInfo = {
  containerKey: string
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

function getLineEnding(content: string): string {
  const match = content.match(/\r\n|\n|\r/)

  return match?.[0] ?? '\n'
}

function getContainerKey(markers: string[]): string {
  return markers.join('|')
}

function getFenceInfo(line: string): FenceInfo | null {
  let whitespace = consumeLeadingWhitespace(line, 0)
  let index = whitespace.index
  let fenceIndent = whitespace.width
  let containerEnd = 0
  const containerMarkers: string[] = []

  while (true) {
    if (line[index] === '>') {
      let markerEnd = index + 1
      if (line[markerEnd] === ' ' || line[markerEnd] === '\t') {
        markerEnd += 1
      }

      containerEnd = markerEnd
      containerMarkers.push('>')
      whitespace = consumeLeadingWhitespace(line, markerEnd)
      index = whitespace.index
      fenceIndent = whitespace.width
      continue
    }

    const nextIndex = consumeListMarker(line, index)
    if (nextIndex === null) {
      break
    }

    containerEnd = nextIndex
    containerMarkers.push(line.slice(index, nextIndex).trimEnd())
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
    containerKey: getContainerKey(containerMarkers),
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

  const lineEnding = getLineEnding(content)
  let activeFence: FenceInfo | null = null

  for (const line of content.split(/\r\n|\n|\r/)) {
    const fence = getFenceInfo(line)
    if (fence === null) {
      continue
    }

    if (activeFence === null) {
      activeFence = fence
      continue
    }

    if (
      fence.containerKey === activeFence.containerKey &&
      fence.length >= activeFence.length &&
      /^[ \t]*$/.test(fence.suffix)
    ) {
      activeFence = null
    }
  }

  if (activeFence !== null) {
    const separator = /(?:\r\n|\n|\r)$/.test(content) ? '' : lineEnding

    return `${content}${separator}${activeFence.prefix}${'`'.repeat(activeFence.length)}`
  }

  return content
}

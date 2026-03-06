export type MarkdownRenderMode = 'settled' | 'streaming'

const FENCE_PATTERN = /^```/gm

export function normalizeMarkdownForRender(
  content: string,
  mode: MarkdownRenderMode
): string {
  if (mode === 'settled') {
    return content
  }

  const fenceCount = content.match(FENCE_PATTERN)?.length ?? 0
  if (fenceCount % 2 === 1) {
    return `${content}\n\`\`\``
  }

  return content
}

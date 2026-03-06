export function getPastedContentFooter(content: string): string | undefined {
  const match = content.match(/pasted\s+(\d+)\s+lines/i)

  if (!match) {
    return undefined
  }

  return `Pasted ${match[1]} lines`
}

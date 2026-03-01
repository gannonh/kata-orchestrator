import { randomBytes } from 'node:crypto'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function generateShortId(length = 4): string {
  const bytes = randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return result
}

export function resolveSpaceName(input: {
  repoLabel: string
  existingNames: Set<string>
}): string {
  const safeRepo = input.repoLabel.trim() || 'repo'
  const maxAttempts = 10

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = `${safeRepo}-${generateShortId(4)}`
    if (!input.existingNames.has(candidate)) {
      return candidate
    }
  }

  // Fallback: 6-char id on repeated collisions
  return `${safeRepo}-${generateShortId(6)}`
}

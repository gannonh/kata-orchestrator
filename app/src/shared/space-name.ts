export function deriveDefaultSpaceName(repoLabel: string, branch: string): string {
  const safeRepo = repoLabel.trim() || 'repo'
  const safeBranch = branch.trim() || 'main'
  return `${safeRepo} ${safeBranch}`
}

export function ensureUniqueSpaceName(base: string, existingNames: Set<string>): string {
  if (!existingNames.has(base)) {
    return base
  }

  let index = 2
  while (existingNames.has(`${base} (${index})`)) {
    index += 1
  }

  return `${base} (${index})`
}

export function resolveSpaceName(input: {
  repoLabel: string
  branch: string
  override?: string
  existingNames: Set<string>
}): string {
  const raw = input.override?.trim() || deriveDefaultSpaceName(input.repoLabel, input.branch)
  return ensureUniqueSpaceName(raw, input.existingNames)
}

import { ChevronDown, ChevronRight, Cog, File, GitCommitHorizontal, Info, LockKeyhole } from 'lucide-react'

import { cn } from '../../lib/cn'
import type { MockFileNode } from '../../mock/files'

type FileTreeNodeProps = {
  node: MockFileNode
  depth?: number
  expandedPaths: Set<string>
  onToggle: (path: string) => void
  forceExpanded?: boolean
}

export function FileTreeNode({
  node,
  depth = 0,
  expandedPaths,
  onToggle,
  forceExpanded = false
}: FileTreeNodeProps) {
  const hasChildren = node.type === 'directory' && Array.isArray(node.children) && node.children.length > 0
  const isExpanded = forceExpanded || expandedPaths.has(node.path)
  const isAccent = node.tone === 'accent'

  const iconByKind = {
    file: File,
    git: GitCommitHorizontal,
    lock: LockKeyhole,
    settings: Cog,
    info: Info
  } as const

  const fileIconToneByKind = {
    file: 'text-sky-400',
    git: 'text-orange-400',
    lock: 'text-amber-300',
    settings: 'text-sky-400',
    info: 'text-sky-400'
  } as const

  if (node.type === 'file') {
    const iconKind = node.icon ?? 'file'
    const Icon = iconByKind[iconKind]

    return (
      <li
        className="flex items-center gap-2 text-sm"
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <Icon className={cn('h-3.5 w-3.5 shrink-0', fileIconToneByKind[iconKind])} />
        <span
          className={cn('min-w-0 flex-1 truncate', isAccent ? 'text-amber-300' : 'text-muted-foreground')}
          title={node.path}
        >
          {node.name}
        </span>
        {node.stats ? (
          <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums">
            {node.stats.added ? <span className="text-emerald-400">+{node.stats.added}</span> : null}
            {node.stats.removed ? <span className="text-rose-400">-{node.stats.removed}</span> : null}
          </span>
        ) : null}
      </li>
    )
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(node.path)}
        aria-label={`Toggle ${node.path}`}
        className="inline-flex items-center gap-1.5 text-sm hover:text-foreground"
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {isExpanded ? (
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              isAccent ? 'text-amber-400' : 'text-muted-foreground/80'
            )}
          />
        ) : (
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              isAccent ? 'text-amber-400' : 'text-muted-foreground/80'
            )}
          />
        )}
        <span className={cn(isAccent ? 'text-amber-300' : 'text-muted-foreground')}>{node.name}</span>
      </button>
      {hasChildren && isExpanded ? (
        <ul className="mt-0.5 grid gap-1">
          {node.children?.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              forceExpanded={forceExpanded}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

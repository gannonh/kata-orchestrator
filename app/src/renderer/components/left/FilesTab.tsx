import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, MoveUpRight, Pencil, Plus, Search } from 'lucide-react'

import { cn } from '../../lib/cn'
import type { MockFileNode } from '../../mock/files'
import { FileTreeNode } from './FileTreeNode'
import { SearchInput } from '../shared/SearchInput'
import { LeftSection } from './LeftSection'
import { Button } from '../ui/button'

type FilesTabProps = {
  files: MockFileNode[]
}

function filterNodes(nodes: MockFileNode[], query: string): MockFileNode[] {
  if (!query) {
    return nodes
  }

  const loweredQuery = query.toLowerCase()

  return nodes.flatMap((node) => {
    if (node.type === 'file') {
      return node.name.toLowerCase().includes(loweredQuery) ? [node] : []
    }

    const filteredChildren = filterNodes(node.children ?? [], query)
    const nameMatches = node.name.toLowerCase().includes(loweredQuery)

    if (!nameMatches && filteredChildren.length === 0) {
      return []
    }

    return [
      {
        ...node,
        children: filteredChildren
      }
    ]
  })
}

export function FilesTab({ files }: FilesTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [draftFileName, setDraftFileName] = useState('filename')
  const [isCreatingFile, setIsCreatingFile] = useState(false)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const draftFileInputRef = useRef<HTMLInputElement>(null)

  const filteredFiles = useMemo(
    () => filterNodes(files, searchQuery.trim()),
    [files, searchQuery]
  )

  useEffect(() => {
    if (!isCreatingFile) {
      return
    }

    draftFileInputRef.current?.focus()
    draftFileInputRef.current?.select()
  }, [isCreatingFile])

  const toggleNewFileRow = () => {
    setIsCreatingFile((current) => {
      if (current) {
        return false
      }

      setDraftFileName('filename')
      return true
    })
  }

  return (
    <LeftSection
      title="Files"
      titleClassName="normal-case tracking-normal text-foreground"
      description={
        <>
          Your copy of the repo lives in{' '}
          <span className="text-foreground/55">/tui-app/repo.</span>
        </>
      }
      descriptionClassName="mt-2 text-sm text-muted-foreground/90"
      addActionLabel="Add file view"
      actions={
        <div className="-mr-1 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="New file"
            title="New file"
            onClick={toggleNewFileRow}
            className={cn(
              'h-7 w-7 text-muted-foreground/85',
              isCreatingFile
                ? 'bg-foreground text-background hover:bg-foreground/90 hover:text-background'
                : 'hover:text-foreground'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Rename file"
            className="h-7 w-7 text-muted-foreground/80 hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Open file actions"
            className="h-7 w-7 text-muted-foreground/80 hover:text-foreground"
          >
            <MoveUpRight className="h-3 w-3" />
          </Button>
        </div>
      }
    >
      <SearchInput
        ariaLabel="Search files"
        value={searchQuery}
        onValueChange={setSearchQuery}
        placeholder="Search files..."
        className="rounded-[min(var(--radius-md),10px)] border-border/70 bg-muted/20 px-2.5 py-1.5 shadow-xs"
        inputClassName="h-6 border-none bg-transparent px-0 py-0 text-sm text-foreground/90 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/80"
        leadingIcon={<Search className="h-3.5 w-3.5 text-muted-foreground/70" />}
      />

      {isCreatingFile ? (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-2 py-1">
          <FileText className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <input
            ref={draftFileInputRef}
            type="text"
            aria-label="New file name"
            value={draftFileName}
            onChange={(event) => setDraftFileName(event.target.value)}
            className="h-6 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/80"
          />
        </div>
      ) : null}

      <ul className="mt-3 grid gap-1.5">
        {filteredFiles.map((node) => (
          <FileTreeNode
            key={node.id}
            node={node}
            expandedPaths={expandedPaths}
            forceExpanded={Boolean(searchQuery.trim())}
            onToggle={(path) => {
              setExpandedPaths((current) => {
                const next = new Set(current)
                if (next.has(path)) {
                  next.delete(path)
                } else {
                  next.add(path)
                }
                return next
              })
            }}
          />
        ))}
      </ul>
    </LeftSection>
  )
}

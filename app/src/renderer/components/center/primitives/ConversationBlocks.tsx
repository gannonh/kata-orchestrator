import type { ToolCallRecord } from '../../../types/chat'
import { CollapsibleSection } from '../../shared/CollapsibleSection'

export type ConversationContextChipRowBlock = {
  id: string
  type: 'contextChipRow'
  chips: string[]
}

export type ConversationToolCallBlockData = {
  id: string
  type: 'toolCall'
  toolCall: ToolCallRecord
}

export type ConversationBlock =
  | ConversationContextChipRowBlock
  | ConversationToolCallBlockData

type ConversationBlocksProps = {
  blocks: ConversationBlock[]
}

type ConversationToolCallBlockProps = {
  toolCall: ToolCallRecord
}

export function ConversationContextChipRow({ chips }: { chips: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip}
          className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
        >
          {chip}
        </span>
      ))}
    </div>
  )
}

export function ConversationToolCallBlock({
  toolCall
}: ConversationToolCallBlockProps) {
  return (
    <CollapsibleSection
      title={`Tool: ${toolCall.name}`}
      defaultOpen={false}
      className="rounded-xl border-border/70 bg-card/60"
    >
      <div className="grid gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Arguments
          </p>
          <pre className="overflow-x-auto rounded-md border bg-card p-3 text-xs text-foreground">
            <code className="language-json">{JSON.stringify(toolCall.args, null, 2)}</code>
          </pre>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Output
          </p>
          <pre className="overflow-x-auto rounded-md border bg-card p-3 text-xs text-foreground">
            <code className="language-text">{toolCall.output}</code>
          </pre>
        </div>
      </div>
    </CollapsibleSection>
  )
}

export function ConversationBlocks({ blocks }: ConversationBlocksProps) {
  return (
    <>
      {blocks.map((block) => {
        if (block.type === 'contextChipRow') {
          return (
            <ConversationContextChipRow
              key={block.id}
              chips={block.chips}
            />
          )
        }

        return (
          <ConversationToolCallBlock
            key={block.id}
            toolCall={block.toolCall}
          />
        )
      })}
    </>
  )
}

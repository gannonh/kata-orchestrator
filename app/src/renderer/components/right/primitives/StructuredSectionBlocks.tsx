import type { ReactNode } from 'react'

import { MarkdownRenderer } from '../../shared/MarkdownRenderer'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'

import type { ParsedSpecSections } from './spec-markdown-types'

type StructuredSectionBlocksProps = {
  sections: ParsedSpecSections
  renderTasks: () => ReactNode
}

type SectionListProps = {
  title: string
  items: string[]
  ordered?: boolean
}

function SectionList({ title, items, ordered = false }: SectionListProps) {
  const ListTag = ordered ? 'ol' : 'ul'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle asChild className="text-sm uppercase tracking-wide">
          <h3>{title}</h3>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <ListTag
            className={[
              'space-y-2 pl-5 text-sm text-muted-foreground',
              ordered ? 'list-decimal' : 'list-disc'
            ].join(' ')}
          >
            {items.map((item, index) => (
              <li key={`${title}-${index}`}>
                <MarkdownRenderer
                  content={item}
                  className="space-y-2 text-inherit"
                />
              </li>
            ))}
          </ListTag>
        ) : (
          <p className="text-sm text-muted-foreground">No items yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

export function StructuredSectionBlocks({ sections, renderTasks }: StructuredSectionBlocksProps) {
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle asChild className="text-sm uppercase tracking-wide">
            <h3>Goal</h3>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sections.goal ? (
            <MarkdownRenderer
              content={sections.goal}
              className="space-y-2"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No goal yet.</p>
          )}
        </CardContent>
      </Card>

      <SectionList
        title="Acceptance Criteria"
        items={sections.acceptanceCriteria}
        ordered
      />
      <SectionList
        title="Non-goals"
        items={sections.nonGoals}
      />
      <SectionList
        title="Assumptions"
        items={sections.assumptions}
      />
      <SectionList
        title="Verification Plan"
        items={sections.verificationPlan}
        ordered
      />
      <SectionList
        title="Rollback Plan"
        items={sections.rollbackPlan}
        ordered
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle asChild className="text-sm uppercase tracking-wide">
            <h3>Tasks</h3>
          </CardTitle>
        </CardHeader>
        <CardContent>{renderTasks()}</CardContent>
      </Card>
    </>
  )
}

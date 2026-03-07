import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { TaskBlockList } from './primitives/TaskBlockList'
import type { ParsedSpecTaskItem } from './primitives/spec-markdown-types'

type VerificationTaskBlockSummaryProps = {
  title: string
  tasks: ParsedSpecTaskItem[]
}

export function VerificationTaskBlockSummary({ title, tasks }: VerificationTaskBlockSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h3>{title}</h3>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TaskBlockList
          tasks={tasks}
          mode="readonly"
        />
      </CardContent>
    </Card>
  )
}

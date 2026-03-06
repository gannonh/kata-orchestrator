import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TaskBlockList } from '../../../../../src/renderer/components/right/primitives/TaskBlockList'

describe('TaskBlockList', () => {
  it('renders empty-state message when tasks array is empty', () => {
    render(<TaskBlockList tasks={[]} />)

    expect(screen.getByText('No tasks yet.')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('renders structured tasks with status badges', () => {
    render(
      <TaskBlockList
        tasks={[{ id: 't1', title: 'Task 1', status: 'not_started', markdownLineIndex: 0 }]}
      />
    )

    expect(screen.getByText('Task 1')).toBeTruthy()
    expect(screen.getByText('Not Started')).toBeTruthy()
  })

  it('invokes toggle callback when interactive checkbox is clicked', () => {
    const onToggleTask = vi.fn()
    const view = render(
      <TaskBlockList
        tasks={[{ id: 't1', title: 'Task 1', status: 'not_started', markdownLineIndex: 0 }]}
        onToggleTask={onToggleTask}
      />
    )

    fireEvent.click(within(view.container).getByRole('checkbox', { name: 'Task 1' }))
    expect(onToggleTask).toHaveBeenCalledWith('t1')
  })
})

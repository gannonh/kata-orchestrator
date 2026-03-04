import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { TaskTrackingSection } from '../../../../src/renderer/components/left/TaskTrackingSection'

describe('TaskTrackingSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders compact rows for no-activity state', () => {
    render(
      <TaskTrackingSection
        snapshot={{
          sessionId: 'session-1',
          runId: 'run-1',
          items: [
            {
              id: 'task-a',
              title: 'Implement parser',
              status: 'not_started',
              activityLevel: 'none',
              updatedAt: '2026-03-04T00:00:00.000Z'
            }
          ],
          counts: {
            not_started: 1,
            in_progress: 0,
            blocked: 0,
            complete: 0
          }
        }}
      />
    )

    expect(screen.getByText('Implement parser')).toBeTruthy()
    expect(screen.queryByText(/starting implementation/i)).toBeNull()
    expect(screen.queryByLabelText('Active specialist')).toBeNull()
  })

  it('renders detail line and specialist badge for high-activity rows', () => {
    render(
      <TaskTrackingSection
        snapshot={{
          sessionId: 'session-1',
          runId: 'run-1',
          items: [
            {
              id: 'task-a',
              title: 'Implement parser',
              status: 'in_progress',
              activityLevel: 'high',
              activityDetail: "I'm starting implementation for the parser task.",
              activeAgentId: 'agent-impl',
              updatedAt: '2026-03-04T00:00:00.000Z'
            }
          ],
          counts: {
            not_started: 0,
            in_progress: 1,
            blocked: 0,
            complete: 0
          }
        }}
      />
    )

    expect(screen.getByText("I'm starting implementation for the parser task.")).toBeTruthy()
    expect(screen.getByLabelText('Active specialist')).toBeTruthy()
    expect(screen.getByText('agent-impl')).toBeTruthy()
  })

  it('renders summary rollup text from snapshot counts', () => {
    render(
      <TaskTrackingSection
        snapshot={{
          sessionId: 'session-1',
          runId: 'run-1',
          items: [
            {
              id: 'task-a',
              title: 'Task A',
              status: 'in_progress',
              activityLevel: 'high',
              activityDetail: 'Working',
              updatedAt: '2026-03-04T00:00:00.000Z'
            },
            {
              id: 'task-b',
              title: 'Task B',
              status: 'complete',
              activityLevel: 'none',
              updatedAt: '2026-03-04T00:00:00.000Z'
            }
          ],
          counts: {
            not_started: 2,
            in_progress: 1,
            blocked: 1,
            complete: 1
          }
        }}
      />
    )

    expect(screen.getByText('1 in progress · 1 done · 3 waiting')).toBeTruthy()
  })

  it('omits "0 waiting" from summary when all tasks are active or complete', () => {
    render(
      <TaskTrackingSection
        snapshot={{
          sessionId: 'session-1',
          runId: 'run-1',
          items: [
            {
              id: 'task-a',
              title: 'Task A',
              status: 'complete',
              activityLevel: 'none',
              updatedAt: '2026-03-04T00:00:00.000Z'
            },
            {
              id: 'task-b',
              title: 'Task B',
              status: 'in_progress',
              activityLevel: 'low',
              updatedAt: '2026-03-04T00:00:00.000Z'
            }
          ],
          counts: {
            not_started: 0,
            in_progress: 1,
            blocked: 0,
            complete: 1
          }
        }}
      />
    )

    expect(screen.getByText('1 in progress · 1 done')).toBeTruthy()
    expect(screen.queryByText(/waiting/)).toBeNull()
  })

  it('renders blocked status icon for blocked tasks', () => {
    render(
      <TaskTrackingSection
        snapshot={{
          sessionId: 'session-1',
          runId: 'run-1',
          items: [
            {
              id: 'task-a',
              title: 'Blocked task',
              status: 'blocked',
              activityLevel: 'none',
              updatedAt: '2026-03-04T00:00:00.000Z'
            }
          ],
          counts: {
            not_started: 0,
            in_progress: 0,
            blocked: 1,
            complete: 0
          }
        }}
      />
    )

    expect(screen.getByText('Blocked task')).toBeTruthy()
    expect(screen.getByText('1 waiting')).toBeTruthy()
  })

  it('returns null when snapshot has no items', () => {
    const { container } = render(
      <TaskTrackingSection
        snapshot={{
          sessionId: 'session-1',
          runId: 'run-1',
          items: [],
          counts: {
            not_started: 0,
            in_progress: 0,
            blocked: 0,
            complete: 0
          }
        }}
      />
    )

    expect(container.querySelector('[data-testid="task-tracking-section"]')).toBeNull()
  })
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LeftPanel } from '../../../../src/renderer/components/layout/LeftPanel'
import { mockAgents } from '../../../../src/renderer/mock/agents'
import { LEFT_STATUS_SCENARIO_KEY } from '../../../../src/renderer/mock/project'

const mockUseSessionAgentRoster = vi.fn<
  [string | null, string | null],
  {
    agents: typeof mockAgents
    isLoading: boolean
    error: string | null
  }
>()
const mockUseCoordinatorSidebarData = vi.fn<
  [string | null],
  {
    agentItems: Array<{
      id: string
      name: string
      role: string
      kind: 'coordinator' | 'specialist' | 'system'
      status: 'idle' | 'queued' | 'delegating' | 'running' | 'blocked' | 'completed' | 'failed'
      avatarColor: string
      delegatedBy?: string
      currentTask?: string
      activeRunId?: string
      waveId?: string
      groupLabel?: string
      lastActivityAt?: string
      sortOrder: number
      createdAt: string
      updatedAt: string
    }>
    contextItems: Array<{
      id: string
      kind: 'spec' | 'note' | 'workspace-file' | 'manual'
      label: string
      sourcePath?: string
      description?: string
      sortOrder: number
      createdAt: string
      updatedAt: string
    }>
    promptPreview: string | null
    isLoading: boolean
    error: string | null
  }
>()
const BUILD_TASK_ACTIVITY_SNAPSHOT = {
  sessionId: 'session-1',
  runId: 'run-build',
  items: [],
  counts: {
    not_started: 0,
    in_progress: 0,
    blocked: 0,
    complete: 0
  }
} as const

vi.mock('../../../../src/renderer/hooks/useSessionAgentRoster', () => ({
  useSessionAgentRoster: (...args: [string | null, string | null]) => mockUseSessionAgentRoster(...args)
}))

vi.mock('../../../../src/renderer/hooks/useCoordinatorSidebarData', () => ({
  useCoordinatorSidebarData: (sessionId: string | null) => mockUseCoordinatorSidebarData(sessionId)
}))

function renderBuildLeftPanel(props: Parameters<typeof LeftPanel>[0] = {}) {
  return render(
    <LeftPanel
      {...props}
      taskActivitySnapshot={props.taskActivitySnapshot ?? BUILD_TASK_ACTIVITY_SNAPSHOT}
    />
  )
}

describe('LeftPanel', () => {
  beforeEach(() => {
    mockUseSessionAgentRoster.mockReturnValue({
      agents: mockAgents,
      isLoading: false,
      error: null
    })
    mockUseCoordinatorSidebarData.mockReturnValue({
      agentItems: [
        {
          id: 'agent-coordinator',
          name: 'Coordinator',
          role: 'Coordinates the session',
          kind: 'coordinator',
          status: 'idle',
          avatarColor: '#0f766e',
          sortOrder: 0,
          createdAt: '2026-03-06T00:00:00.000Z',
          updatedAt: '2026-03-06T00:01:00.000Z'
        }
      ],
      contextItems: [
        {
          id: 'resource-spec',
          kind: 'spec',
          label: 'Spec',
          sortOrder: 0,
          createdAt: '2026-03-06T00:00:00.000Z',
          updatedAt: '2026-03-06T00:00:00.000Z'
        }
      ],
      promptPreview: 'I would like to build the following product...',
      isLoading: false,
      error: null
    })
  })

  afterEach(() => {
    window.localStorage.removeItem(LEFT_STATUS_SCENARIO_KEY)
    vi.clearAllMocks()
    cleanup()
  })

  it('hides the left status section and renders the coordinator agents surface in coordinator mode', () => {
    render(<LeftPanel activeSpaceId="space-1" activeSessionId="session-1" taskActivitySnapshot={undefined} />)

    expect(screen.getByRole('tablist', { name: 'Left panel modules' })).toBeTruthy()
    expect(screen.queryByLabelText('Left panel status')).toBeNull()
    expect(screen.getByText('Agents write code, maintain notes, and coordinate tasks.')).toBeTruthy()
    expect(screen.getByText('Coordinator')).toBeTruthy()
    expect(screen.getByText('I would like to build the following product...')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Collapse sidebar navigation' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Agents' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create new agent' }).textContent).toBe('+ Create new agent')
  })

  it('uses session roster hook with activeSpaceId and derives the Agents tab count from loaded roster length', () => {
    const roster = [mockAgents[0], ...(mockAgents[0].children ?? [])]
    mockUseSessionAgentRoster.mockReturnValue({
      agents: roster,
      isLoading: false,
      error: null
    })

    renderBuildLeftPanel({ activeSpaceId: 'space-42' })

    expect(mockUseSessionAgentRoster).toHaveBeenCalledWith('space-42', null)
    expect(screen.getByRole('tab', { name: 'Agents' }).getAttribute('title')).toBe(`Agents (${roster.length})`)
  })

  it('renders status section above tab content', () => {
    renderBuildLeftPanel()

    const statusSection = screen.getByLabelText('Left panel status')
    const agentsHeading = screen.getByRole('heading', { name: 'Agents' })

    expect(
      statusSection.compareDocumentPosition(agentsHeading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('supports overflow state scenario with rollup chips', () => {
    window.localStorage.setItem(LEFT_STATUS_SCENARIO_KEY, 'overflow')
    renderBuildLeftPanel()

    expect(screen.getAllByText('25 done')).toHaveLength(2)
    expect(screen.getByText('50 of 60 complete.')).toBeTruthy()
  })

  it('toggles to busy preview when clicking the status section', () => {
    renderBuildLeftPanel()

    const cyclePreviewStateButton = screen.getByRole('button', { name: 'Cycle status preview state' })
    const statusSection = screen.getByLabelText('Left panel status')

    expect(screen.getByText('Tasks ready to go.')).toBeTruthy()
    fireEvent.click(cyclePreviewStateButton)
    expect(screen.getByText('2 of 5 complete.')).toBeTruthy()
    fireEvent.click(cyclePreviewStateButton)
    expect(screen.getByText('3 of 5 complete.')).toBeTruthy()
    fireEvent.click(cyclePreviewStateButton)
    expect(screen.getByText('4 of 5 complete.')).toBeTruthy()
    expect(statusSection.querySelectorAll('[data-segment-status="done"]')).toHaveLength(4)
    expect(statusSection.querySelectorAll('[data-segment-status="in_progress"]')).toHaveLength(1)
    fireEvent.click(cyclePreviewStateButton)
    expect(screen.getByText('Tasks ready to go.')).toBeTruthy()
  })

  it('supports direct preview selection using the 0-1-2-3 controls', () => {
    renderBuildLeftPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Show preview state 2' }))

    expect(screen.getByText('3 of 5 complete.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show preview state 0' }))
    expect(screen.getByText('Tasks ready to go.')).toBeTruthy()
  })

  it('keeps the context tab count aligned to the context tab content when preview is active', () => {
    renderBuildLeftPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Cycle status preview state' }))
    const contextTab = screen.getByRole('tab', { name: 'Context' })

    expect(contextTab.getAttribute('title')).toBe('Context (6)')
  })

  it('switches to the context tab and renders the baseline context hierarchy', () => {
    renderBuildLeftPanel()

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Context' }), { button: 0 })

    expect(screen.getByRole('heading', { name: 'Context' })).toBeTruthy()
    expect(screen.getByText('Project specs, tasks, and notes are stored as markdown files in')).toBeTruthy()
    const notesPath = screen.getByText('./notes')
    expect(notesPath.tagName).toBe('CODE')
    expect(notesPath.closest('p')?.textContent).toContain('in ./notes')
    expect(screen.getByTestId('context-spec-section')).toBeTruthy()
    expect(screen.queryByText('/tui-app/.workspace.')).toBeNull()
    expect(screen.getByText('Spec')).toBeTruthy()
    expect(screen.getByText('Create contracts and shared baseline components')).toBeTruthy()
    expect(screen.getByText('Implement left panel tabs')).toBeTruthy()
  })

  it('feeds the preview cycle into the context tab states', () => {
    renderBuildLeftPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Cycle status preview state' }))

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Context' }), { button: 0 })
    expect(screen.getByText('Notes')).toBeTruthy()
    expect(screen.getByText('Team Brainstorm - 2/22/26')).toBeTruthy()
    expect(screen.getByText('Scratchpad')).toBeTruthy()
    const teamNoteRow = screen.getByTestId('context-note-row-team-brainstorm-2-22-26')
    const scratchpadRow = screen.getByTestId('context-note-row-scratchpad')
    expect(teamNoteRow.querySelector('svg')).toBeNull()
    expect(scratchpadRow.querySelector('svg')).toBeNull()
  })

  it('switches to changes and files tabs', () => {
    renderBuildLeftPanel()

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Changes' }), { button: 0 })
    expect(screen.getByRole('heading', { name: 'Changes' })).toBeTruthy()
    expect(screen.getByText('View and accept file changes.')).toBeTruthy()
    expect(screen.getByText('Your code lives in:')).toBeTruthy()
    expect(screen.getByText('UNSTAGED / NEW')).toBeTruthy()

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Files' }), { button: 0 })
    expect(screen.getByRole('heading', { name: 'Files' })).toBeTruthy()
    expect(screen.getByText(/Your copy of the repo lives in/)).toBeTruthy()
    expect(screen.getByLabelText('Search files')).toBeTruthy()
  })

  it('feeds the preview cycle into the changes tab click-through states', () => {
    renderBuildLeftPanel()

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Changes' }), { button: 0 })
    expect(screen.getByText('No changes yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Archive and start new space' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show preview state 1' }))
    expect(screen.getByText('COMMITS')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create PR' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Merge' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Connect Remote' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show preview state 2' }))
    expect(screen.getByText('3 files changed in Space')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Unstage all' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show preview state 3' }))
    expect(screen.getByText('3 files changed in Space')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Unstage all' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show preview state 0' }))
    expect(screen.getByText('No changes yet')).toBeTruthy()
  })

  it('collapses and expands the sidebar content area from the top toggle', () => {
    render(<LeftPanel />)

    const content = screen.getByTestId('left-panel-content')
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar navigation' }))

    expect(content.getAttribute('aria-hidden')).toBe('true')
    expect(content.className).toContain('opacity-0')
    expect(screen.getByRole('button', { name: 'Expand sidebar navigation' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar navigation' }))

    expect(content.getAttribute('aria-hidden')).toBe('false')
    expect(content.className).toContain('opacity-100')
  })

  it('respects controlled collapsed state and only emits onCollapsedChange', () => {
    const onCollapsedChange = vi.fn()
    const { rerender } = render(
      <LeftPanel
        collapsed
        onCollapsedChange={onCollapsedChange}
      />
    )

    const content = screen.getByTestId('left-panel-content')
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar navigation' }))

    expect(onCollapsedChange).toHaveBeenCalledWith(false)
    expect(content.getAttribute('aria-hidden')).toBe('true')

    rerender(
      <LeftPanel
        collapsed={false}
        onCollapsedChange={onCollapsedChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar navigation' }))
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
  })

  it('does not render the theme toggle when theme is provided without onToggleTheme', () => {
    render(<LeftPanel theme="dark" />)

    expect(screen.queryByRole('button', { name: 'Switch to light theme' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Switch to dark theme' })).toBeNull()
  })

  it('does not render the theme toggle when theme prop is omitted', () => {
    render(<LeftPanel />)

    expect(screen.queryByRole('button', { name: 'Switch to light theme' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Switch to dark theme' })).toBeNull()
  })

  it('renders dark theme toggle label and icon', () => {
    render(<LeftPanel theme="dark" onToggleTheme={() => {}} />)

    const button = screen.getByRole('button', { name: 'Switch to light theme' })
    expect(button.querySelector('svg')).toBeTruthy()
    expect(button.querySelector('svg')?.classList.contains('lucide-sun')).toBe(true)
  })

  it('renders light theme toggle label and icon', () => {
    render(<LeftPanel theme="light" onToggleTheme={() => {}} />)

    const button = screen.getByRole('button', { name: 'Switch to dark theme' })
    expect(button.querySelector('svg')).toBeTruthy()
    expect(button.querySelector('svg')?.classList.contains('lucide-moon')).toBe(true)
  })

  it('calls onToggleTheme when clicking the theme toggle', () => {
    const onToggleTheme = vi.fn()

    render(<LeftPanel theme="dark" onToggleTheme={onToggleTheme} />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }))

    expect(onToggleTheme).toHaveBeenCalledTimes(1)
  })

  it('calls onOpenHome when the home action is clicked', () => {
    const onOpenHome = vi.fn()
    render(<LeftPanel onOpenHome={onOpenHome} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Open Home spaces view' })[0])
    expect(onOpenHome).toHaveBeenCalledTimes(1)
  })

  it('does not throw when home action is clicked without onOpenHome wired', () => {
    render(<LeftPanel />)

    expect(() => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Open Home spaces view' })[0])
    }).not.toThrow()
  })

  it('renders conversation entry index in agents tab and forwards jump events', () => {
    const onJumpToMessage = vi.fn()
    renderBuildLeftPanel({
      conversationEntries: [
        {
          id: 'entry-m-1',
          messageId: 'm-1',
          label: 'Spec Updated',
          timestamp: '10:00 AM',
          role: 'agent'
        }
      ],
      onJumpToMessage
    })

    expect(screen.getByRole('heading', { name: 'Conversation Entries' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Jump to message: Spec Updated at 10:00 AM' }))
    expect(onJumpToMessage).toHaveBeenCalledWith('m-1')
  })

  it('renders task tracking rows when runtime task activity snapshot is provided', () => {
    render(
      <LeftPanel
        taskActivitySnapshot={{
          sessionId: 'session-1',
          runId: 'run-1',
          items: [
            {
              id: 'task-a',
              title: 'Implement parser',
              status: 'in_progress',
              activityLevel: 'high',
              activityDetail: 'Starting parser implementation',
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

    expect(screen.getByLabelText('Task tracking')).toBeTruthy()
    expect(screen.getByText('Implement parser')).toBeTruthy()
    expect(screen.getByText('Starting parser implementation')).toBeTruthy()
  })

  it('does not render conversation entry index when jump callback is not provided', () => {
    renderBuildLeftPanel({
      conversationEntries: [
        {
          id: 'entry-m-1',
          messageId: 'm-1',
          label: 'Spec Updated',
          timestamp: '10:00 AM',
          role: 'agent'
        }
      ]
    })

    expect(screen.queryByRole('heading', { name: 'Conversation Entries' })).toBeNull()
  })
})

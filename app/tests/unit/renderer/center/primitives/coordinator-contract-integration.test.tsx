import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { SessionAgentRecord } from '../../../../../src/shared/types/space'
import {
  ConversationMessageCard
} from '../../../../../src/renderer/components/center/primitives/ConversationMessageCard'
import {
  toCoordinatorStatusBadgeState
} from '../../../../../src/renderer/components/center/primitives/adapters'
import { ConversationStatusBadge } from '../../../../../src/renderer/components/center/primitives/ConversationStatusBadge'

describe('coordinator primitive contract integration', () => {
  it('renders using a real SessionAgentRecord-derived label', () => {
    const coordinator: SessionAgentRecord = {
      id: 'agent-1',
      sessionId: 'session-1',
      name: 'Coordinator',
      role: 'Coordinator',
      kind: 'coordinator',
      status: 'running',
      avatarColor: '#60d394',
      sortOrder: 0,
      createdAt: '2026-03-06T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z'
    }

    render(
      <ConversationMessageCard
        message={{ id: 'm1', role: 'agent', content: 'Draft ready.' }}
        agentLabel={coordinator.name}
      />
    )

    expect(screen.getByText('Coordinator')).toBeTruthy()
  })

  it('maps running SessionAgentRecord status to running badge state', () => {
    const coordinator: SessionAgentRecord = {
      id: 'agent-1',
      sessionId: 'session-1',
      name: 'Coordinator',
      role: 'Coordinator',
      kind: 'coordinator',
      status: 'running',
      avatarColor: '#60d394',
      sortOrder: 0,
      createdAt: '2026-03-06T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z'
    }

    render(<ConversationStatusBadge state={toCoordinatorStatusBadgeState({ activeAgent: coordinator })} />)

    expect(screen.getByRole('status', { name: 'Running' })).toBeTruthy()
  })
})

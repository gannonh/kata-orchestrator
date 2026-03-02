import fs from 'node:fs/promises'

import { expect, test } from './fixtures/electron'
import { ensureWorkspaceShell } from './helpers/shell-view'

type PersistedAgentRecord = {
  id: string
  sessionId: string
  name: string
}

type PersistedState = {
  activeSessionId: string | null
  agentRoster?: Record<string, PersistedAgentRecord>
}

test.describe('KAT-185: Agent roster sidebar integration @ci', () => {
  test('renders seeded roster entries and persists them in app state @ci', async ({
    appWindow,
    managedStateFilePath
  }) => {
    await ensureWorkspaceShell(appWindow)

    await expect(appWindow.getByRole('heading', { name: 'Agents' })).toBeVisible()
    await expect(appWindow.getByText('Kata Agents')).toBeVisible()
    await expect(appWindow.getByText('MVP Planning Coordinator')).toBeVisible()

    await appWindow.screenshot({
      path: 'test-results/kat-185-agent-roster-sidebar.png',
      fullPage: true
    })

    const persisted = JSON.parse(await fs.readFile(managedStateFilePath, 'utf8')) as PersistedState
    const rosterEntries = Object.values(persisted.agentRoster ?? {})
    const activeSessionId = persisted.activeSessionId

    expect(activeSessionId).toBeTruthy()
    expect(rosterEntries).toHaveLength(2)
    expect(rosterEntries.every((record) => record.sessionId === activeSessionId)).toBe(true)
    expect(rosterEntries.map((record) => record.name).sort()).toEqual([
      'Kata Agents',
      'MVP Planning Coordinator'
    ])
  })
})

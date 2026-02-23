export type MockSpace = {
  id: string
  name: string
  repo: string
  branch: string
  elapsed: string
  archived: boolean
  status: 'active' | 'idle' | 'archived'
}

export const mockSpaces: MockSpace[] = [
  {
    id: 'space-wave-1',
    name: 'Unblock Wave 1 verification',
    repo: 'gannonh/kata-cloud',
    branch: 'main',
    elapsed: '2h',
    archived: false,
    status: 'active'
  },
  {
    id: 'space-left-panel',
    name: 'Left panel parity follow-ups',
    repo: 'gannonh/kata-cloud',
    branch: 'feature/left-panel',
    elapsed: '48m',
    archived: false,
    status: 'idle'
  },
  {
    id: 'space-docs-sync',
    name: 'Docs and release sync',
    repo: 'gannonh/kata-orchestrator',
    branch: 'main',
    elapsed: '15m',
    archived: false,
    status: 'idle'
  },
  {
    id: 'space-archived-migration',
    name: 'Archived migration notes',
    repo: 'gannonh/kata-orchestrator',
    branch: 'archive/notes',
    elapsed: '1d',
    archived: true,
    status: 'archived'
  }
]

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SpacesListPanel } from '../../../../src/renderer/components/home/SpacesListPanel'

describe('SpacesListPanel repo grouping', () => {
  afterEach(() => cleanup())

  it('renders repo group headers as h3 headings distinct from space items', () => {
    render(<SpacesListPanel
      groups={[
        { repo: 'gannonh/kata-cloud', spaces: [
          { id: '1', name: 'kata-cloud-x7k2', repoUrl: '', rootPath: '', branch: 'main', orchestrationMode: 'team', createdAt: '', status: 'active', repo: 'gannonh/kata-cloud', elapsed: '', archived: false },
          { id: '2', name: 'kata-cloud-m3p9', repoUrl: '', rootPath: '', branch: 'develop', orchestrationMode: 'team', createdAt: '', status: 'idle', repo: 'gannonh/kata-cloud', elapsed: '', archived: false }
        ]},
        { repo: 'gannonh/kata-tui', spaces: [
          { id: '3', name: 'kata-tui-j4n1', repoUrl: '', rootPath: '', branch: 'main', orchestrationMode: 'single', createdAt: '', status: 'active', repo: 'gannonh/kata-tui', elapsed: '', archived: false }
        ]}
      ]}
      selectedSpaceId="1"
      searchQuery=""
      groupByRepo={true}
      showArchived={false}
      onSearchChange={() => {}}
      onToggleGroupByRepo={() => {}}
      onToggleShowArchived={() => {}}
      onSelectSpace={() => {}}
    />)

    // Repo headers should be h3 elements
    const headers = screen.getAllByRole('heading', { level: 3 })
    expect(headers.length).toBe(2)
    expect(headers[0].textContent).toBe('gannonh/kata-cloud')
    expect(headers[1].textContent).toBe('gannonh/kata-tui')

    // Space items should be listed below their headers
    expect(screen.getByText('kata-cloud-x7k2')).toBeTruthy()
    expect(screen.getByText('kata-cloud-m3p9')).toBeTruthy()
    expect(screen.getByText('kata-tui-j4n1')).toBeTruthy()
  })

  it('does not render a top separator on the first visible group when earlier groups are empty', () => {
    render(<SpacesListPanel
      groups={[
        { repo: 'empty/repo', spaces: [] },
        { repo: 'visible/repo', spaces: [
          { id: '1', name: 'visible-space', repoUrl: '', rootPath: '', branch: 'main', orchestrationMode: 'team', createdAt: '', status: 'active', repo: 'visible/repo', elapsed: '', archived: false }
        ]}
      ]}
      selectedSpaceId="1"
      searchQuery=""
      groupByRepo={true}
      showArchived={false}
      onSearchChange={() => {}}
      onToggleGroupByRepo={() => {}}
      onToggleShowArchived={() => {}}
      onSelectSpace={() => {}}
    />)

    const heading = screen.getByRole('heading', { level: 3, name: 'visible/repo' })
    const groupContainer = heading.parentElement?.parentElement
    expect(groupContainer?.className).not.toContain('border-t')
    expect(groupContainer?.className).not.toContain('pt-4')
  })
})

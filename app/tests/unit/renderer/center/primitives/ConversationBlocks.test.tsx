import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ConversationBlocks } from '../../../../../src/renderer/components/center/primitives/ConversationBlocks'

describe('ConversationBlocks', () => {
  it('renders context chips and tool call blocks', () => {
    render(
      <ConversationBlocks
        blocks={[
          {
            id: 'chips-1',
            type: 'contextChipRow',
            chips: ['# Kata Cloud', '## Context']
          },
          {
            id: 'tool-1',
            type: 'toolCall',
            toolCall: {
              id: 'tc-1',
              name: 'read_file',
              args: { path: 'foo.md' },
              output: 'done'
            }
          }
        ]}
      />
    )

    expect(screen.getByText('# Kata Cloud')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tool: read_file' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Tool: read_file' }))
    expect(screen.getByText((text) => text.includes('"path": "foo.md"'))).toBeTruthy()
    expect(screen.getByText('done')).toBeTruthy()
  })
})

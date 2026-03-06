import { describe, expect, it } from 'vitest'

import {
  normalizeMarkdownForRender
} from '../../../../src/renderer/components/shared/normalize-markdown-for-render'

describe('normalizeMarkdownForRender', () => {
  it('returns settled markdown unchanged', () => {
    const content = ['## Summary', '', '> stable quote', '', '```ts', 'const ready = true', '```'].join('\n')

    expect(normalizeMarkdownForRender(content, 'settled')).toBe(content)
  })

  it('closes an unterminated fenced block only for streaming mode', () => {
    const content = ['## Summary', '', '```ts', 'const ready = true'].join('\n')

    expect(normalizeMarkdownForRender(content, 'streaming')).toBe(
      ['## Summary', '', '```ts', 'const ready = true', '```'].join('\n')
    )
  })

  it('preserves blockquote line breaks while streaming', () => {
    const content = ['> first line', '> second line'].join('\n')

    expect(normalizeMarkdownForRender(content, 'streaming')).toBe(content)
  })

  it('does not append a closing fence when the markdown is already balanced', () => {
    const content = ['```md', '- item', '```'].join('\n')

    expect(normalizeMarkdownForRender(content, 'streaming')).toBe(content)
  })

  it('closes unterminated quoted fences while preserving the quote prefix', () => {
    const content = ['> ```ts', '> const ready = true'].join('\n')

    expect(normalizeMarkdownForRender(content, 'streaming')).toBe(
      ['> ```ts', '> const ready = true', '> ```'].join('\n')
    )
  })

  it('closes unterminated indented fences using the matching fence length', () => {
    const content = ['  ````ts', '  const ready = true'].join('\n')

    expect(normalizeMarkdownForRender(content, 'streaming')).toBe(
      ['  ````ts', '  const ready = true', '  ````'].join('\n')
    )
  })

  it('does not append a closing fence for balanced quoted fences with longer markers', () => {
    const content = ['> ````md', '> - item', '> ````'].join('\n')

    expect(normalizeMarkdownForRender(content, 'streaming')).toBe(content)
  })
})

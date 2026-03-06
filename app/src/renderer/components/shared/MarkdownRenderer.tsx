import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '../../lib/cn'
import {
  normalizeMarkdownForRender,
  type MarkdownRenderMode
} from './normalize-markdown-for-render'

type MarkdownRendererProps = {
  content: string
  className?: string
  renderMode?: MarkdownRenderMode
}

const HEADING_BASE = 'font-semibold tracking-tight text-foreground'

const REMARK_PLUGINS = [remarkGfm]

const MD_COMPONENTS: Components = {
  h1: ({ children }) => <h1 className={`text-2xl ${HEADING_BASE}`}>{children}</h1>,
  h2: ({ children }) => <h2 className={`text-xl ${HEADING_BASE}`}>{children}</h2>,
  h3: ({ children }) => <h3 className={`text-lg ${HEADING_BASE}`}>{children}</h3>,
  h4: ({ children }) => <h4 className={`text-lg ${HEADING_BASE}`}>{children}</h4>,
  h5: ({ children }) => <h5 className={`text-lg ${HEADING_BASE}`}>{children}</h5>,
  h6: ({ children }) => <h6 className={`text-lg ${HEADING_BASE}`}>{children}</h6>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border/80 pl-4 text-foreground/90">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => <ul className="list-inside list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-inside list-decimal space-y-1">{children}</ol>,
  li: ({ children, className }) => (
    <li className={cn('leading-6 marker:text-muted-foreground', className)}>{children}</li>
  ),
  input: ({ checked, className, node: _node, ...props }) => {
    if (props.type !== 'checkbox') {
      return <input {...props} checked={checked} className={className} readOnly />
    }

    return (
      <input
        {...props}
        checked={checked}
        aria-label={checked ? 'Completed task' : 'Incomplete task'}
        className={cn('mr-2 translate-y-[1px]', className)}
        disabled
        readOnly
      />
    )
  },
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-md border bg-card p-3 font-mono text-xs text-foreground">
      {children}
    </pre>
  ),
  code: ({ className: codeClassName, children }) => (
    <code
      className={cn(
        !codeClassName &&
          'rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground',
        codeClassName
      )}
    >
      {children}
    </code>
  ),
  p: ({ children }) => <p>{children}</p>
}

export function MarkdownRenderer({
  content,
  className,
  renderMode = 'settled'
}: MarkdownRendererProps) {
  const normalizedContent = normalizeMarkdownForRender(content, renderMode)

  return (
    <div className={cn('space-y-3 text-sm text-muted-foreground', className)}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MD_COMPONENTS}>
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '../../lib/cn'

type MarkdownRendererProps = {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn('space-y-3 text-sm text-muted-foreground', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-lg font-semibold tracking-tight text-foreground">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-lg font-semibold tracking-tight text-foreground">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-lg font-semibold tracking-tight text-foreground">
              {children}
            </h6>
          ),
          ul: ({ children }) => (
            <ul className="list-inside list-disc space-y-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-inside list-decimal space-y-1">
              {children}
            </ol>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md border bg-card p-3 font-mono text-xs text-foreground">
              {children}
            </pre>
          ),
          code: ({ className: codeClassName, children }) => (
            <code className={codeClassName}>
              {children}
            </code>
          ),
          p: ({ children }) => <p>{children}</p>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

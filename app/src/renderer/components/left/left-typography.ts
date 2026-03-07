const LEFT_LIST_TEXT = 'text-sm leading-5 text-muted-foreground'

export const LEFT_PANEL_TYPOGRAPHY = {
  sectionTitle: 'text-sm font-medium uppercase tracking-wide text-muted-foreground',
  sectionDescription: 'text-sm text-muted-foreground',
  sectionInlineAction:
    'focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border border-transparent bg-clip-padding text-sm font-medium text-muted-foreground transition-all outline-none hover:text-foreground focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  body: 'text-sm text-foreground',
  bodyMuted: 'text-sm text-muted-foreground',
  meta: 'text-xs text-muted-foreground',
  listHeading: LEFT_LIST_TEXT,
  listItem: LEFT_LIST_TEXT,
  listItemStrong: 'text-sm leading-5 text-foreground/95'
} as const

export type PrimitiveMessageRole = 'user' | 'agent' | 'system'
export type PrimitiveRunState = 'empty' | 'pending' | 'idle' | 'error'
export type CoordinatorStatusBadgeState =
  | 'ready'
  | 'thinking'
  | 'running'
  | 'stopped'
  | 'error'
export type PrimitiveMessageVariant = 'default' | 'collapsed'

export type PrimitiveMessage = {
  id: string
  role: PrimitiveMessageRole
  content: string
  createdAt?: string
  summary?: string
}

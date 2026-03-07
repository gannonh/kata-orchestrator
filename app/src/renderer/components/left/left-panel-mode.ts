import type { TaskActivitySnapshot } from '@shared/types/task-tracking'

export type LeftPanelMode = 'coordinator' | 'build'

export function resolveLeftPanelMode(input: {
  taskActivitySnapshot?: TaskActivitySnapshot
}): LeftPanelMode {
  return input.taskActivitySnapshot ? 'build' : 'coordinator'
}

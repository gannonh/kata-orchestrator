import fs from 'node:fs'
import path from 'node:path'
import { createDefaultAppState } from '@shared/types/space'
import type { AppState } from '@shared/types/space'

export type StateStore = {
  load(): AppState
  save(state: AppState): void
}

export function createStateStore(filePath: string): StateStore {
  return {
    load(): AppState {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(raw) as AppState
      } catch {
        return createDefaultAppState()
      }
    },

    save(state: AppState): void {
      const dir = path.dirname(filePath)
      const tmpPath = path.join(dir, `.state-${Date.now()}.tmp`)
      fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2))
      fs.renameSync(tmpPath, filePath)
    }
  }
}

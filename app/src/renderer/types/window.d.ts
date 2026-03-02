import type {
  CreateSessionInput,
  CreateSpaceInput,
  SessionRecord,
  SpaceRecord
} from '@shared/types/space'
import type { RunRecord } from '@shared/types/run'
import type { SessionRuntimeEvent } from './session-runtime-adapter'

type Repo = { name: string; nameWithOwner: string; url: string }
type ModelInfo = { provider: string; modelId: string; name: string; authStatus: string }

declare global {
  interface Window {
    kata?: {
      openExternalUrl?: (url: string) => Promise<boolean>
      spaceCreate?: (input: CreateSpaceInput) => Promise<SpaceRecord>
      spaceList?: () => Promise<SpaceRecord[]>
      spaceGet?: (id: string) => Promise<SpaceRecord | null>
      sessionCreate?: (input: CreateSessionInput) => Promise<SessionRecord>
      dialogOpenDirectory?: () => Promise<{ path: string } | { error: string; path: string } | null>
      gitListBranches?: (repoPath: string) => Promise<string[] | { error: string }>
      githubListRepos?: () => Promise<Repo[] | { error: string }>
      githubListBranches?: (owner: string, repo: string) => Promise<string[] | { error: string }>
      runSubmit?: (input: { sessionId: string; prompt: string; model: string; provider: string }) => Promise<{ runId: string }>
      runAbort?: (input: { runId: string }) => Promise<boolean>
      runList?: (sessionId: string) => Promise<RunRecord[]>
      onRunEvent?: (callback: (event: SessionRuntimeEvent) => void) => () => void
      authStatus?: (provider: string) => Promise<'oauth' | 'api_key' | 'none'>
      authLogin?: (provider: string) => Promise<boolean>
      authLogout?: (provider: string) => Promise<boolean>
      modelList?: () => Promise<ModelInfo[]>
    }
  }
}

export {}

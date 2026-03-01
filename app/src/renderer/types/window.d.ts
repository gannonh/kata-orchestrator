import type {
  CreateSessionInput,
  CreateSpaceInput,
  SessionRecord,
  SpaceRecord
} from '@shared/types/space'

type Repo = { name: string; nameWithOwner: string; url: string }

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
    }
  }
}

export {}

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
      dialogOpenDirectory?: () => Promise<{ path: string } | null>
      gitListBranches?: (repoPath: string) => Promise<string[]>
      githubListRepos?: () => Promise<Repo[]>
      githubListBranches?: (owner: string, repo: string) => Promise<string[]>
    }
  }
}

export {}

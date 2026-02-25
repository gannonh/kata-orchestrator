import type {
  CreateSessionInput,
  CreateSpaceInput,
  SessionRecord,
  SpaceRecord
} from '@shared/types/space'

declare global {
  interface Window {
    kata?: {
      openExternalUrl?: (url: string) => Promise<boolean>
      spaceCreate?: (input: CreateSpaceInput) => Promise<SpaceRecord>
      spaceList?: () => Promise<SpaceRecord[]>
      spaceGet?: (id: string) => Promise<SpaceRecord | null>
      sessionCreate?: (input: CreateSessionInput) => Promise<SessionRecord>
    }
  }
}

export {}

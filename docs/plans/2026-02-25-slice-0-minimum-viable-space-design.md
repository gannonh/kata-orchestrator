# Slice 0: Minimum Viable Space

## Context

The Kata Desktop App pivoted from a UI-baseline-first execution model to vertical slices (2026-02-25). Every slice requires a persisted space context to scope orchestrator runs, sessions, and git operations. No space persistence infrastructure exists today: the app uses hardcoded mock data and local component state.

This slice builds the minimum persistence layer so subsequent slices start from a real, persisted space.

## Scope

A user can create a space, see it persist across app restarts, and navigate into a coordinator session scoped to that space.

## Data Types

```typescript
// src/shared/types/space.ts

type SpaceRecord = {
  id: string              // uuid
  name: string            // derived from prompt or user input
  repoUrl: string         // git remote URL
  rootPath: string        // local filesystem path
  branch: string          // git branch
  orchestrationMode: 'team' | 'single'
  createdAt: string       // ISO-8601
  status: 'active' | 'idle' | 'archived'
}

type SessionRecord = {
  id: string              // uuid
  spaceId: string         // FK to SpaceRecord.id
  label: string           // display name (e.g., "Coordinator")
  createdAt: string       // ISO-8601
}

type AppState = {
  spaces: Record<string, SpaceRecord>
  sessions: Record<string, SessionRecord>
  activeSpaceId: string | null
  activeSessionId: string | null
}
```

Types live in `src/shared/` so both main and renderer can import them.

## Persistence

JSON file in the Electron `userData` directory. Main process owns reads and writes.

- Load on app startup
- Atomic writes (write temp file, rename)
- Graceful handling of missing file (first launch) and corrupt JSON

Migration to SQLite can happen later if needed.

## IPC Channels

| Channel | Direction | Payload | Returns |
|---------|-----------|---------|---------|
| `space:create` | renderer -> main | `{ name, repoUrl, rootPath, branch, orchestrationMode }` | `SpaceRecord` |
| `space:list` | renderer -> main | none | `SpaceRecord[]` |
| `space:get` | renderer -> main | `{ id }` | `SpaceRecord \| null` |
| `session:create` | renderer -> main | `{ spaceId, label }` | `SessionRecord` |

Deferred: `space:update`, `space:archive`, `space:delete`, session listing/deletion, real-time state sync.

## Main Process

### state-store.ts
- Loads `app-state.json` on startup
- Exposes typed read/write methods
- Atomic writes (temp file + rename)

### ipc-handlers.ts
- Registers handlers for each channel
- Validates input, delegates to state-store
- Returns typed responses

## Preload Bridge

```typescript
// src/preload/index.ts additions
spaceCreate: (input: CreateSpaceInput) => ipcRenderer.invoke('space:create', input),
spaceList: () => ipcRenderer.invoke('space:list'),
spaceGet: (id: string) => ipcRenderer.invoke('space:get', { id }),
sessionCreate: (input: CreateSessionInput) => ipcRenderer.invoke('session:create', input),
```

## UI Wiring

### CreateSpacePanel
- On "Create space" click: call `window.api.spaceCreate()` with form values
- Derive `name` from prompt via existing logic
- Derive `repoUrl`/`rootPath` from repo selector (hardcoded to current repo for now)
- On success: set `activeSpaceId`, navigate to coordinator session view

### HomeSpacesScreen
- On mount: call `window.api.spaceList()` instead of reading `mockSpaces`
- Replace `MockSpace` references with `SpaceRecord`
- Space click: set `activeSpaceId`, navigate to coordinator session view

### App.tsx navigation
```
Home (no activeSpaceId)
  -> User creates space or clicks existing
  -> activeSpaceId set
  -> View switches to workspace (coordinator session)
```

## Explicitly Deferred

- Orchestrator types/logic (Slice A)
- Chat/message infrastructure (Slice A)
- Git operations beyond storing repoUrl/branch as strings (Slice A/C)
- Context retrieval ("+ Add context" stays inert)
- Spec panel data wiring (continues showing mock data)
- Repo/branch picker UI (hardcode to current repo)
- Space archive/delete/rename UI
- Modal layout transformation (keep current panel grid layout)
- Setup options bar (rapid fire, env config)

## Test Strategy

### Unit tests (main process)
- `state-store.ts`: read/write/atomic save, missing file on first launch, corrupt JSON recovery
- IPC handlers: input validation, reject malformed payloads, return correct types

### Unit tests (renderer)
- `CreateSpacePanel`: calls `spaceCreate` with correct payload on submit, navigates on success
- `HomeSpacesScreen`: calls `spaceList` on mount, renders real data, handles empty state

### E2E test
- Create a space, quit app, relaunch, verify space appears in list

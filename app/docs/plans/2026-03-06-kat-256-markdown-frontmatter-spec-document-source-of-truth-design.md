# KAT-256 Markdown Frontmatter Spec Document as Source of Truth Design

**Issue:** KAT-256  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-256/038-markdown-frontmatter-spec-document-as-source-of-truth  
**Parent Epic:** KAT-164 (Post-Slice A - Spec & Notes Panel Parity / Spec 03)  
**Branch target:** `feature/kat-256-038-markdown-frontmatter-spec-document-as-source-of-truth`  
**Primary spec:** `_plans/design/specs/03-spec-notes-panel.md`  
**Relevant mocks:** `08-spec-panel-overview-initial.png`, `09-spec-panel-goal-and-tasks.png`  
**Dependent tickets kept out of scope:** `KAT-257`, `KAT-258`, `KAT-181`

## Scope and Outcome

Make a real markdown artifact the canonical source of truth for the right-panel spec.

Required outcome:

- The canonical spec for an active session is a file logically named `notes/spec.md`.
- The right panel renders from that artifact, not from a renderer-only markdown cache or transient draft state.
- The artifact uses a minimal YAML frontmatter contract for spec status and trace metadata.
- Direct edits to the artifact remain safe and deterministic for renderer reload/session-restore behavior.
- Invalid frontmatter and malformed task references are surfaced as explicit diagnostics instead of silently corrupting the rendered spec.

This ticket establishes the markdown-first artifact model only. It does not define the conversational authoring workflow, task-pointer semantics, or the final task-sync ownership model.

## Context Loaded

From Linear/project workflow:

- `KAT-256` is now `In Progress` and unblocked because `KAT-178` is `Done` as of March 6, 2026.
- The desktop workflow contract requires spec-state evidence before `Done`.
- The project execution model treats design specs as acceptance authority and expects vertical slices to build on already-landed renderer contracts.

From the parent epic and downstream issue chain:

- `KAT-164` defines Spec 03 parity as an epic beyond Slice A minimums.
- `KAT-257` depends on this ticket for incremental conversational authoring into the same artifact.
- `KAT-258` depends on this ticket for task-pointer references stored alongside the spec in `notes/`.
- `KAT-181` depends on this ticket for final checkbox/task-store semantics.

From the current codebase:

- `RightPanel` already has a deterministic four-state spec UI: generating, draft_ready, structured_view, editing.
- `useSpecDocument` persists markdown through IPC-backed `spec:get`, `spec:save`, and `spec:applyDraft`.
- `parseSpecMarkdown` and task-block utilities already define the canonical section/task rendering substrate.
- The main process persists `specDocuments` in `AppState`, but today that markdown blob is itself the primary store rather than a projection of a real file.
- `session:create` already seeds a durable `Spec` context resource, but it has no `sourcePath` yet.

## Problem Statement

Today the app behaves as if the spec is a session-scoped markdown document, but the actual source of truth is still an app-state record:

- canonical data lives in `AppState.specDocuments[spaceId:sessionId]`
- the right panel reads that state through IPC
- `Apply Draft to Spec` writes directly into that stored markdown record

That model is good enough for renderer persistence, but it does not satisfy `KAT-256` because:

1. There is no real artifact a user can open and edit directly.
2. The app state, not `notes/spec.md`, is still authoritative.
3. Invalid metadata cannot be isolated cleanly from the markdown body because there is no explicit frontmatter contract.
4. Future work (`KAT-257`, `KAT-258`) needs a stable filesystem artifact to mutate and reference.

## Constraints and Assumptions

- The existing structured renderer and task parsing from `KAT-178` stay authoritative for section/task extraction.
- The body of the file remains flexible markdown; only frontmatter is constrained.
- The artifact path must be session-scoped to avoid multi-session collisions within one space.
- The user-facing logical artifact name remains `notes/spec.md`.
- The renderer may keep a last-known-good parsed snapshot for continuity, but that snapshot is cache only and never becomes the write authority.
- `Apply Draft to Spec` may remain temporarily as a compatibility action, but its only job after this ticket is to write `notes/spec.md`.

## Approaches Considered

### Approach 1 (Recommended): File-backed canonical artifact with main-process mediation and cached projection

Make `notes/spec.md` the only write authority. Main process APIs read/write the file, strip/validate frontmatter, update a cached parsed projection, and expose deterministic diagnostics to renderer consumers.

Pros:

- Satisfies the ticket literally: real markdown file is canonical.
- Keeps filesystem access in main/preload rather than renderer.
- Preserves most of the current `useSpecDocument` and `RightPanel` flow.
- Gives `KAT-257` and `KAT-258` a stable artifact contract without reopening renderer fundamentals.

Cons:

- Requires a new artifact-resolution layer and file-watch/reload semantics.
- Introduces a cache/projection layer that must be kept clearly non-canonical.

### Approach 2: Keep app-state canonical and mirror changes to `notes/spec.md`

Continue to treat `specDocuments` as the authoritative store and write the file as a side effect.

Pros:

- Lowest immediate implementation churn.
- Smaller changes to current tests and IPC surfaces.

Cons:

- Fails the core requirement because the file is not actually the source of truth.
- Makes direct user edits inherently second-class and conflict-prone.
- Forces future tickets to keep reasoning about two primary stores.

### Approach 3: File-only renderer flow with direct re-read and no persisted projection

Remove spec markdown from app state entirely and force every consumer to read and parse the file directly each time.

Pros:

- Very pure source-of-truth model.

Cons:

- Poor failure recovery for invalid frontmatter.
- Harder reload/session-restore behavior when the file is temporarily malformed.
- Repeated parse/read work leaks filesystem concerns into too many code paths.

## Recommendation

Use **Approach 1**.

`notes/spec.md` becomes the canonical artifact, while the main process owns:

- path resolution
- file creation
- file reads/writes
- frontmatter parsing/validation
- cached last-known-good projection
- change notifications / deterministic refresh

That keeps the architectural pivot tight while letting the existing structured spec renderer survive mostly intact.

## Proposed Design

## 1) Artifact Model and Path Resolution

Define a logical session artifact path:

- logical path: `notes/spec.md`
- resolved absolute path: session-scoped, not shared across sessions

Recommended rule:

- resolve a session artifact root first
- place the spec at `<sessionArtifactRoot>/notes/spec.md`
- store the absolute resolved path in the seeded `Spec` context resource `sourcePath`

This design intentionally separates:

- the user-facing logical name (`notes/spec.md`)
- the absolute filesystem location needed for safe session scoping

Reasoning:

- one space can have multiple sessions
- a single repo-root `notes/spec.md` would create collisions
- `KAT-258` will later need additional task artifacts stored alongside the same spec

## 2) Canonical File Shape

The canonical file is a markdown document with YAML frontmatter:

```md
---
status: drafting
updatedAt: 2026-03-06T19:33:00.000Z
sourceRunId: run-123
---

## Goal
Ship markdown-first spec persistence.

## Acceptance Criteria
1. Render from the file.
```

### Minimal frontmatter contract

Required:

- `status: drafting | ready`
- `updatedAt: <ISO-8601 string>`

Optional:

- `sourceRunId: <run id string>`

Contract notes:

- `status` is the only renderer-facing state machine field owned here.
- `updatedAt` supports deterministic freshness comparisons and reload behavior.
- `sourceRunId` preserves current traceability without making draft/apply the primary model.
- No task metadata is stored in frontmatter in this ticket.
- No completeness policy is encoded here; `KAT-257` owns readiness transition semantics beyond the basic `drafting | ready` contract.

## 3) Persistence Ownership

After this ticket:

- file is canonical
- app state is projection/cache

Recommended persisted projection shape:

```ts
type PersistedSpecDocument = {
  sourcePath: string
  raw: string
  markdown: string
  frontmatter: {
    status: 'drafting' | 'ready'
    updatedAt: string
    sourceRunId?: string
  }
  diagnostics: SpecArtifactDiagnostic[]
  lastGoodMarkdown?: string
  lastGoodFrontmatter?: {
    status: 'drafting' | 'ready'
    updatedAt: string
    sourceRunId?: string
  }
  updatedAt: string
}
```

Important ownership rule:

- `raw`, `markdown`, `frontmatter`, and diagnostics are derived from the file.
- The store may cache the last valid parse for continuity.
- The store never wins over the file on conflict.

## 4) Main-Process Spec Artifact Service

Introduce a focused main-process service, for example:

- `src/main/spec-artifact-service.ts`

Responsibilities:

- resolve the session-scoped spec path
- ensure parent `notes/` directory exists
- create a default `spec.md` when the session has no artifact yet
- read the file and split frontmatter/body
- validate frontmatter
- normalize the renderer-facing body markdown
- persist a cached projection into `AppState.specDocuments`
- update `SessionContextResourceRecord.sourcePath` for the `Spec` resource

Recommended invariant:

- every successful `spec:get`, `spec:save`, and `spec:applyDraft` reads the file first or writes the file first, then updates the projection

That keeps the IPC contract file-first instead of state-first.

## 5) IPC and Preload Contract Changes

Keep the channel names if possible to minimize renderer churn:

- `spec:get`
- `spec:save`
- `spec:applyDraft`

Change their semantics:

- `spec:get`
  - resolves `notes/spec.md`
  - reads the file
  - returns derived projection + diagnostics
- `spec:save`
  - takes markdown body plus frontmatter fields
  - writes canonical file contents
  - re-reads/parses and returns derived projection
- `spec:applyDraft`
  - converts the latest draft into canonical file contents
  - writes the file
  - returns the resulting projection

Compatibility note:

- `spec:applyDraft` remains allowed during the transitional UI, but it no longer writes transient app state only.
- `Apply Draft to Spec` becomes a convenience write into the canonical file.

## 6) Renderer Model

Renderer continues to treat `useSpecDocument` as the right-panel entry point, but the hook changes from "persist markdown blob" to "edit file-backed artifact projection."

Renderer-facing rules:

- parse structured sections from `projection.markdown` only, never from the raw frontmatter-bearing text
- render status badges and edit state using `projection.frontmatter.status`
- keep `sourceRunId` available for the existing "Applied from ..." style traceability
- surface diagnostics in a stable error region above the structured sections/editor

Suggested state behavior:

- `generating`
  - no artifact body yet, or only default scaffold
- `draft_ready`
  - latest draft exists and differs materially from artifact
- `structured_view`
  - artifact body parsed successfully
- `editing`
  - user edits the markdown body and allowed frontmatter controls through the app

Direct external edits:

- the renderer should refresh from main-process file reads on:
  - session activation
  - app bootstrap / reload
  - successful explicit save/apply operations
  - filesystem change notifications if available in this ticket

If watch-based updates are added, they are an optimization over the same canonical read path, not a second sync model.

## 7) Invalid Frontmatter and Malformed Reference Handling

Diagnostics must be explicit and deterministic.

Recommended diagnostic categories:

- `invalid_frontmatter_yaml`
- `invalid_frontmatter_shape`
- `invalid_task_reference`

Behavior:

- invalid frontmatter
  - do not treat the current raw file as a valid structured document
  - keep and display last-known-good structured view if available
  - show an error banner with the file path and parse message
- malformed task references
  - keep rendering the rest of the document
  - flag only the affected task rows/Tasks section

This ticket does not define the final task-pointer grammar, but it should reserve the error path now because `KAT-258` depends on it.

## 8) Default Scaffold

When a new session has no spec artifact yet, create a minimal scaffold:

```md
---
status: drafting
updatedAt: <now>
---

## Goal

## Acceptance Criteria

## Non-goals

## Assumptions

## Verification Plan

## Rollback Plan

## Tasks
```

Why:

- it keeps the artifact always present
- it gives the renderer a deterministic empty-state body
- it makes the seeded `Spec` context resource point to a real file immediately

## 9) Interaction Semantics

### Manual editing in-app

- editing markdown in the right panel writes back to the canonical file
- app updates `updatedAt` in frontmatter on every successful save
- structured renderer refreshes from the saved file result

### Manual editing outside the app

- file changes become visible after refresh/reload/session restore at minimum
- if a watcher is added, the panel updates in-place through the same parse pipeline

### Draft apply

- apply action writes the draft into the file body
- frontmatter `sourceRunId` is updated
- frontmatter `updatedAt` is updated
- right panel re-renders from the file-derived projection

## 10) Boundary With Downstream Tickets

`KAT-256` owns:

- canonical file-backed spec artifact
- minimal frontmatter contract
- file-first IPC semantics
- invalid-frontmatter diagnostics
- session-scoped artifact path resolution

`KAT-257` owns:

- conversational incremental authoring into the same file
- the transition from `drafting` to `ready`
- removal of the apply-draft step as the normal authoring flow

`KAT-258` owns:

- task-pointer syntax and resolution rules
- artifact layout for task files alongside the spec in `notes/`

`KAT-181` owns:

- final checkbox/task status ownership and sync semantics once file-backed storage exists

## 11) Testing Strategy

### Unit tests

- frontmatter parser:
  - valid YAML with required fields
  - missing required fields
  - invalid enum for `status`
  - malformed YAML
- artifact serializer:
  - writes deterministic frontmatter ordering
  - preserves body markdown exactly
- spec path resolver:
  - session-scoped path is deterministic
  - no collisions between sessions in one space

### Main-process tests

- `spec:get` creates default scaffold when file absent
- `spec:save` writes file, refreshes projection, and updates cached state
- `spec:applyDraft` writes file and stamps `sourceRunId`
- invalid frontmatter returns diagnostics without erasing last-known-good projection
- seeded `Spec` context resource receives a `sourcePath`

### Renderer tests

- `useSpecDocument` consumes projection with frontmatter + diagnostics
- right panel renders diagnostics cleanly
- structured sections still parse from body markdown after frontmatter stripping
- editing and save flows update renderer state from returned projection

### E2E / restart evidence

- create session -> verify `notes/spec.md` exists
- edit in panel -> reload app -> same rendered spec appears
- edit file externally -> reload app -> renderer reflects file edits
- corrupt frontmatter -> reload -> diagnostic appears and last good view remains stable

## 12) Non-Goals

- conversational interview flow or incremental agent-authored updates
- task-pointer/task-artifact syntax
- final task checkbox sync policy
- generalized notes-file system for arbitrary user notes beyond the seeded spec
- moving filesystem access into renderer

## 13) Risks and Mitigations

- **Risk:** ambiguity around `notes/spec.md` path causes multi-session collisions.  
  **Mitigation:** treat `notes/spec.md` as a logical session artifact path and persist the resolved absolute `sourcePath`.

- **Risk:** malformed frontmatter blanks the panel.  
  **Mitigation:** persist last-known-good projection and render diagnostics instead of destructive fallback.

- **Risk:** keeping channel names while changing semantics hides a source-of-truth shift.  
  **Mitigation:** document file-first ownership in code comments, tests, and updated shared types.

- **Risk:** direct external edits race with in-app edits.  
  **Mitigation:** main-process read/write pipeline always re-reads after writes and treats filesystem mtime/frontmatter `updatedAt` as freshness signals.

## Brainstorming Summary

- Explored current Linear context, project workflow docs, Spec 03 mocks, and the landed renderer/persistence code.
- Compared three persistence models and rejected state-first mirroring because it fails the ticket's core requirement.
- Chose a file-backed canonical artifact with main-process mediation and cached projection as the lowest-risk architecture that still makes `notes/spec.md` truly authoritative.

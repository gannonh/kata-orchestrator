# KAT-103 Design: Managed Workspace Git Provisioning (clone/fetch/worktree)

Date: 2026-02-26
Issue: KAT-103

## Goal
Implement managed workspace git provisioning so space creation can reliably provision a working tree at `<space>/repo` with explicit branch behavior, while keeping external mode fully pass-through and preserving power-user git/worktree workflows.

## Confirmed Scope
- Deliver all three creation paths in this ticket:
  - Copy local repo
  - Clone from GitHub
  - Create new repo
- Managed mode:
  - Create or reuse repo source
  - Provision workspace at `<space>/repo`
  - Resolve explicit branch behavior (existing branch vs remote-tracking create)
- External mode:
  - No repo move, rewrite, or mutation by managed provisioning flow
- Naming model:
  - Default name derived from repo/branch context
  - Prompt is intent/context text only
  - User override supported and persisted
  - Deterministic collision handling for default names

## Approaches Considered
1. Per-space full clone
- Simplest implementation, but duplicates disk/network and weakens reuse.

2. Global cache repo + per-space worktree (selected)
- Canonical reusable repo source plus isolated per-space working trees.
- Best aligns with issue requirement to create or reuse repo source and preserve native git workflows.

3. Hybrid staged migration
- Lower immediate implementation complexity, but creates known rework and migration overhead.

## Architecture
Use a dedicated main-process provisioning service called by `space:create`.

- Add `src/main/workspace-provisioning.ts` as the orchestration point for provisioning.
- Keep the canonical managed repo cache under `~/.kata/repos/<repo-key>`.
- For each managed space, provision an isolated working tree at `<space-root>/repo`.
- Update `space:create` in `src/main/ipc-handlers.ts` to:
  - Validate an explicit provisioning input contract
  - Call provisioning service
  - Persist resulting `SpaceRecord` with resolved repo/branch metadata

External mode continues to route through existing path validation and returns user-supplied root path without managed provisioning side effects.

## Components and Data Flow
### Shared Types
Extend `src/shared/types/space.ts` with:
- Provisioning method discriminator:
  - `copy-local | clone-github | new-repo`
- Method-specific fields:
  - Local copy source path
  - Remote URL
  - New repo parent directory + folder name
- Branch selection input model (existing/local vs remote tracking create)
- Space naming metadata (`derived` vs `override`)

### Preload Bridge
Keep API surface consistent between:
- `src/preload/index.ts`
- `src/preload/index.d.ts`

`spaceCreate` takes the extended payload and returns the persisted `SpaceRecord`.

### Renderer
Update:
- `src/renderer/components/home/CreateSpacePanel.tsx`
- `src/renderer/components/home/HomeSpacesScreen.tsx`

Planned behavior:
- Repo source selector UI supports all 3 paths (copy/clone/new) and branch input.
- Space name input is editable and prefilled from derived default.
- Prompt remains context text and is not used as canonical name unless user explicitly sets override to matching value.
- Existing external-mode flow remains pass-through.

### Main Provisioning Flow (managed)
1. Parse and validate provisioning payload.
2. Resolve canonical cache repo key/location.
3. Prepare source repo by method:
   - Copy local repo into cache (or refresh if already present)
   - Clone remote into cache (or fetch if already present)
   - Initialize new repo in cache
4. Resolve branch semantics:
   - Use existing local branch if present
   - Else create local branch tracking selected remote branch when requested
5. Provision per-space worktree at `<space>/repo`.
6. Return structured result used to persist `SpaceRecord`.

## Error Handling
Normalize provisioning failures into actionable IPC errors with:
- Category
- Message
- Remediation hint

Examples:
- Invalid/non-absolute path
- Missing git executable
- Clone/auth/fetch failure
- Branch does not exist
- Worktree path conflict

Renderer displays these in the create flow alert area; no silent fallback to local-only behavior.

## Testing Strategy (Mandatory TDD)
Write failing tests first, then implementation.

### Unit Tests
- Main:
  - `tests/unit/main/ipc-handlers.test.ts`
  - New provisioning service tests under `tests/unit/main/`
- Renderer:
  - `tests/unit/renderer/home/HomeSpacesScreen.test.tsx`
  - `CreateSpacePanel` tests for method selection and name override behavior

Coverage requirements:
- Happy path for each provisioning method (copy local, clone GitHub, new repo)
- Branch strategy resolution (existing local, remote-tracking create)
- Name derivation + override + deterministic collision handling
- External mode pass-through remains unchanged
- Actionable error propagation and UI surfacing

### End-to-End Tests (Robust Matrix)
Add/extend E2E coverage in `tests/e2e`:
1. Copy local repo -> managed space provisioning to `<space>/repo` with expected branch/worktree.
2. Clone from GitHub -> managed provisioning and branch tracking behavior.
3. New repo -> repo creation and managed provisioning with expected initial git state.
4. Name default derived from repo/branch and override persists.
5. External mode pass-through does not mutate/move source repo.
6. Provisioning failures surface actionable errors in UI.

Execution guidance:
- Prefer deterministic local fixtures (local bare repos + temp directories) to reduce network flake.
- Keep one optional remote smoke test if needed.
- Tag core path for quality gate and full matrix for CI (`@quality-gate`, `@ci`).
- Capture screenshot/video artifacts for completion evidence.

## Out of Scope
- PR workflow expansion beyond required provisioning data handoff
- Commit UX redesign in Changes tab
- Non-space-creation UI redesign outside `KAT-103` scope
- New database migration work (current state persistence contract remains)

## Expected Outcome
`KAT-103` ships managed provisioning that is explicit, reusable, and workflow-safe: users can create spaces from local copy, GitHub clone, or new repo; each managed space gets an isolated `<space>/repo` working tree; external mode remains untouched; naming and error handling are deterministic and test-backed.

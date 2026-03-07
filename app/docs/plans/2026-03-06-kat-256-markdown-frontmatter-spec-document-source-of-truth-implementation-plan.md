# KAT-256 Markdown Frontmatter Spec Document as Source of Truth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `notes/spec.md` the canonical persisted spec artifact and make the right panel render that markdown document directly, with frontmatter used only for metadata and diagnostics.

**Architecture:** Keep the file-backed artifact service introduced for `notes/spec.md`, but remove the old structured-spec product model from the primary Spec panel path. The renderer should consume a persisted markdown artifact projection and render the markdown body as markdown, not as a fixed `Goal / Acceptance Criteria / Tasks` dataset. The `Apply Draft to Spec` / `draft_ready` flow must be removed from the normal Spec panel path. External edits to `notes/spec.md` should be reflected deterministically on reload/session restore. Task-pointer resolution remains out of scope for this ticket; task lines render as plain markdown for now.

**Tech Stack:** TypeScript, Electron IPC, Node `fs/promises` + `path`, React 19, `react-markdown`, `remark-gfm`, Vitest, Playwright

---

## Execution Notes

- Use `@superpowers:test-driven-development` on every task.
- Run commands from `/Volumes/EVO/kata/kata-orchestrator.worktrees/wt-d/app`.
- Do not preserve `draft_ready` / `Apply Draft to Spec` behavior in the primary Spec panel path.
- Do not preserve structured-section projection as the main Spec panel representation.
- Frontmatter is metadata only for this ticket: status, timestamps, trace/source ids, and diagnostics.
- Markdown body remains flexible and should render as a document.
- Task-pointer semantics belong to KAT-258. For KAT-256, task lines remain markdown content.

## Task 1: Lock the corrected product contract with failing tests

**Files:**
- Modify: `tests/unit/renderer/components/layout/RightPanel.*`
- Modify: `tests/unit/renderer/components/right/SpecTab.*`
- Create/Modify: focused renderer tests as needed
- Modify: `tests/e2e/kat-256-spec-artifact-source-of-truth.spec.ts`

**Intent:**

Capture the corrected acceptance criteria before changing implementation:

- Spec panel renders markdown document content from `notes/spec.md`
- `Apply Draft to Spec` is not shown in the normal Spec panel flow
- External file edits are visible on reload in the rendered document
- Invalid frontmatter surfaces diagnostics without replacing the visible last-good markdown document with a draft gate

**Required failing cases:**

1. Right panel does not enter `draft_ready` when a persisted `spec.md` exists.
2. Spec tab shows rendered markdown body content rather than only structured section blocks.
3. External edit to `notes/spec.md` changes visible rendered markdown on reload.
4. Invalid frontmatter shows diagnostics and preserves last-good visible markdown body.
5. E2E asserts the absence of `Apply Draft to Spec` in the normal file-backed Spec flow.

**Run:**

```bash
npm run test -- tests/unit/renderer/right/SpecTab*.test.tsx tests/unit/renderer/right/SpecSections*.test.tsx tests/unit/renderer/right/RightPanel*.test.tsx
npm run test:e2e -- tests/e2e/kat-256-spec-artifact-source-of-truth.spec.ts
```

Expected: FAIL on old structured/draft behavior.

## Task 2: Replace the primary renderer model with markdown-first artifact rendering

**Files:**
- Modify: `src/renderer/types/spec-document.ts`
- Modify: `src/renderer/hooks/useSpecDocument.ts`
- Modify: `src/renderer/components/right/SpecTab.tsx`
- Modify: `src/renderer/components/right/SpecSections.tsx`
- Create or modify markdown rendering primitive component(s)

**Intent:**

Stop projecting the markdown body into a fixed structured document for the main Spec tab. The persisted artifact should be represented primarily as:

- `sourcePath`
- `raw`
- `markdown`
- `frontmatter`-derived metadata
- `diagnostics`

The right panel should render `markdown` as markdown using the existing markdown stack.

**Implementation requirements:**

1. Remove the primary dependency on `parseSpecMarkdown(...)` from `useSpecDocument`.
2. Keep `raw`/`markdown` and metadata in renderer state without converting to fixed sections.
3. Replace section-block rendering in the main Spec path with markdown rendering.
4. Keep frontmatter diagnostics visible above the document.
5. Preserve edit mode as markdown editing of the same artifact.

**Run:**

```bash
npm run test -- tests/unit/renderer/hooks/useSpecDocument.test.ts tests/unit/renderer/right/SpecTab*.test.tsx tests/unit/renderer/right/SpecSections*.test.tsx
```

Expected: PASS

## Task 3: Remove draft/apply behavior from the normal Spec panel path

**Files:**
- Modify: `src/renderer/components/layout/RightPanel.tsx`
- Modify: `src/renderer/components/right/SpecTab.tsx`
- Modify: `src/renderer/hooks/useSessionConversation.ts`
- Modify: `src/renderer/hooks/useIpcSessionConversation.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc-handlers.ts`

**Intent:**

Eliminate the normal-path `draft_ready` / `Apply Draft to Spec` behavior for this lane so the Spec panel is always a view of `notes/spec.md`, not a draft staging area.

**Implementation requirements:**

1. Remove `latestDraft` gating from `RightPanel` for the Spec tab.
2. Remove `draft_ready` mode from `SpecTab`.
3. Remove `specApplyDraft` usage from the renderer path.
4. Delete dead IPC/preload handlers if they are no longer used.
5. Preserve any non-Spec conversation state that still matters, but do not let it replace the file-backed Spec view.

**Run:**

```bash
npm run test -- tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts tests/unit/renderer/hooks/useIpcSessionConversation.test.ts tests/unit/renderer/right/RightPanel*.test.tsx
```

Expected: PASS

## Task 4: Keep file-backed reload/session-restore behavior and invalid-frontmatter recovery

**Files:**
- Modify: `src/main/spec-artifact-service.ts`
- Modify: `src/main/state-store.ts`
- Modify: `src/renderer/hooks/useSpecDocument.ts`
- Modify: targeted tests

**Intent:**

Preserve the valid parts of the current KAT-256 work:

- file-backed `notes/spec.md`
- deterministic scaffold creation
- reload/session restore
- invalid-frontmatter diagnostics
- last-good artifact recovery

But make recovery feed the markdown-first UI rather than the draft/structured renderer.

**Implementation requirements:**

1. Last-good markdown recovery remains available for invalid frontmatter.
2. Renderer uses last-good markdown for display continuity when current frontmatter is invalid.
3. State-store normalization stays aligned with the persisted artifact shape.
4. No structured task dataset is required for recovery behavior.

**Run:**

```bash
npm run test -- tests/unit/main/spec-artifact-service.test.ts tests/unit/main/state-store.test.ts tests/unit/renderer/hooks/useSpecDocument.test.ts
```

Expected: PASS

## Task 5: End-to-end verification against the corrected ticket scope

**Files:**
- Modify: `tests/e2e/kat-256-spec-artifact-source-of-truth.spec.ts`
- Add screenshots/evidence as needed

**Intent:**

Verify the corrected KAT-256 contract:

1. Opening the Spec tab creates/scaffolds `notes/spec.md` if missing.
2. The right panel renders markdown from the file itself.
3. External edit to the file changes visible rendered markdown after reload.
4. Invalid frontmatter surfaces diagnostics while keeping the last-good document visible.
5. The normal Spec flow does not show `Apply Draft to Spec`.

**Run:**

```bash
npm run test:e2e -- tests/e2e/kat-256-spec-artifact-source-of-truth.spec.ts
```

Expected: PASS

## Task 6: Final verification

Run the focused verification set:

```bash
npm run lint
npm run test -- tests/unit/main/spec-artifact-service.test.ts tests/unit/main/state-store.test.ts tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts tests/unit/renderer/hooks/useSpecDocument.test.ts tests/unit/renderer/hooks/useIpcSessionConversation.test.ts tests/unit/renderer/right/SpecTab*.test.tsx tests/unit/renderer/right/SpecSections*.test.tsx tests/unit/renderer/right/RightPanel*.test.tsx
npm run test:e2e -- tests/e2e/kat-256-spec-artifact-source-of-truth.spec.ts
```

Document any residual risk explicitly. The only acceptable residuals are those intentionally deferred to KAT-257 or KAT-258.

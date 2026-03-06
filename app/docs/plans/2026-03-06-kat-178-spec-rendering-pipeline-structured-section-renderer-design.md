# KAT-178 Spec Rendering Pipeline + Structured Section Renderer Design

**Issue:** KAT-178  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-178/031-spec-rendering-pipeline-structured-section-renderer  
**Parent Epic:** KAT-164 (Post-Slice A - Spec & Notes Panel Parity / Spec 03)  
**Fidelity Role:** Enabler  
**Branch target:** `feature/kat-178-031-spec-rendering-pipeline-structured-section-renderer`  
**Primary spec:** `_plans/design/specs/03-spec-notes-panel.md`  
**Relevant mocks:** `08-spec-panel-overview-initial.png`, `09-spec-panel-goal-and-tasks.png`

## Scope and Outcome

Deliver the spec panel rendering substrate end-to-end for the right panel.

Required outcome:

- Persisted spec markdown renders into the canonical structured sections shown in Spec 03.
- Parser and renderer output remain deterministic across reload and session restore.
- The landed code on `main` defines a stable parser/renderer surface that later tickets consume without reopening `KAT-178` scope.
- Unit and snapshot-style tests freeze the parser/renderer contract for key states and edge cases.

This ticket owns the parser/renderer substrate and its public surface. It does not own task persistence semantics or cross-writer coordination rules.

## Context Loaded

From Linear and project workflow docs:

- `KAT-178` is unblocked as of March 6, 2026 because `KAT-218` is `Done`.
- The desktop workflow contract requires spec-state verification plus linked evidence before `Done`.
- The fidelity classification comment marks `KAT-178` as an **Enabler** for the right-panel spec rendering substrate.
- The ticket comment contract says `KAT-178` owns canonical spec rendering contracts and must keep schema changes explicit if they happen during execution.

From the design spec and mocks:

- Mock 08 requires the onboarding state while no applied structured spec exists.
- Mock 09 requires a rendered right-panel view with Goal, Tasks, Acceptance Criteria, Non-goals, Assumptions, Verification Plan, and Rollback Plan.
- Task items are rendered as checkbox rows in the spec panel, but this ticket is limited to deterministic parse/render behavior and safe renderer contracts.

From the current codebase:

- The renderer already has the first-pass substrate in:
  - `src/renderer/components/right/primitives/parse-spec-markdown.ts`
  - `src/renderer/components/right/primitives/task-block-markdown.ts`
  - `src/renderer/hooks/useSpecDocument.ts`
  - `src/renderer/components/right/SpecTab.tsx`
  - `src/renderer/components/right/SpecSections.tsx`
- Persistence already flows through:
  - `src/preload/index.ts`
  - `src/main/ipc-handlers.ts`
  - `src/main/state-store.ts`
- Existing tests already freeze part of the surface in:
  - `tests/unit/renderer/right/primitives/parse-spec-markdown.test.ts`
  - `tests/unit/renderer/right/primitives/spec-primitives.contract.test.ts`
  - `tests/unit/renderer/right/SpecSections.test.tsx`
  - `tests/unit/renderer/right/SpecTab.structured.test.tsx`
  - `tests/unit/renderer/hooks/useSpecDocument.test.ts`

## Constraints and Assumptions

- Markdown remains the persisted source of truth for the spec document.
- Structured sections are derived from markdown on every load; no separate persisted AST or normalized section store will be introduced in this ticket.
- Task write-back depends on `markdownLineIndex`, so the parser must keep source-line mapping stable.
- Task IDs must remain deterministic because left/right task parity and future consumers rely on the same `task.id`.
- `blocked` may appear as a runtime display overlay elsewhere, but persisted structured spec task status remains a three-state parser/renderer contract.
- This ticket must stay inside renderer-contract ownership and must not absorb:
  - checkbox persistence semantics
  - write conflict rules
  - store sync policy
  - fallback behavior that belongs to a later task-sync ticket

## Approaches Considered

### Approach 1 (Recommended): Contract-first refinement of the existing parser/render substrate

Keep the existing parser, hook, and right-panel rendering architecture, but explicitly freeze the public parser/renderer contract inside this design and tighten tests around it.

Pros:

- Lowest risk because it builds on already-landed substrate from `KAT-218`.
- Matches the actual code path that persists and restores spec markdown today.
- Produces a clear landed contract on `main` without introducing a new persistence model.

Cons:

- Requires careful separation between renderer invariants and future task-sync semantics.
- Existing parser duplication elsewhere remains a risk until follow-up cleanup happens.

### Approach 2: Replatform onto a richer markdown AST pipeline

Replace the current line-oriented parser with a full markdown AST and custom section/task extraction.

Pros:

- More flexible for future markdown features.

Cons:

- Over-scoped for `KAT-178`.
- High regression risk against the current persisted markdown and task-line write-back behavior.
- Does not improve the acceptance criteria enough to justify the migration.

### Approach 3: Expand the ticket to define persistence and task-sync semantics too

Use this ticket to define parsing, rendering, persistence, and task store conflict rules together.

Pros:

- One place to discuss all task-related behavior.

Cons:

- Violates the issue boundary.
- Pulls `KAT-178` into behavior ownership that belongs to later tickets.
- Makes the parser/renderer contract harder to land and verify cleanly.

## Recommendation

Use **Approach 1**.

`KAT-178` should land a stable parser/renderer surface, document the owned contract in this design, and freeze it with tests. Once this is on `main`, later tickets should treat the landed code and tests as the authoritative contract rather than expecting `KAT-178` to define broader task-sync behavior.

## Proposed Design

## 1) Owned Parser and Renderer Contract

`KAT-178` owns the following renderer-facing contract surface.

### Canonical section keys

The structured document exposes these section keys only:

- `goal`
- `acceptanceCriteria`
- `nonGoals`
- `assumptions`
- `verificationPlan`
- `rollbackPlan`

Tasks are exported separately as `document.tasks`.

### Task object shape

The canonical task shape is:

```ts
type SpecTaskItem = {
  id: string
  title: string
  status: 'not_started' | 'in_progress' | 'complete'
  markdownLineIndex: number
}
```

Contract notes:

- `id` is the stable cross-surface identity and must be deterministic for the same markdown task title sequence.
- `markdownLineIndex` exists to support source-line updates and is part of the parser contract for this ticket.
- No additional persistence or sync metadata is part of the owned parser contract.

### Structured document shape

```ts
type StructuredSpecDocument = {
  markdown: string
  sections: {
    goal: string
    acceptanceCriteria: string[]
    nonGoals: string[]
    assumptions: string[]
    verificationPlan: string[]
    rollbackPlan: string[]
  }
  tasks: SpecTaskItem[]
  updatedAt: string
  appliedRunId?: string
}
```

### Parser invariants

`parseSpecMarkdown(markdown)` must guarantee:

- deterministic heading normalization for the canonical headings above
- stable output field ordering regardless of source heading order
- empty strings or empty arrays for missing sections
- stable task ordering matching source order
- stable `task.id` generation from task title plus duplicate-order disambiguation
- preserved `markdownLineIndex` for each parsed task row
- no thrown errors for malformed or partial markdown; the parser must degrade to partial output with defaults

### Renderer invariants

The structured renderer must guarantee:

- the right panel renders the canonical sections in fixed display order
- missing sections render stable empty states rather than disappearing unpredictably
- task rows consume `SpecTaskItem` without redefining task identity or status values
- reload and session restore produce the same structured output for the same persisted markdown
- runtime overlays may decorate task display, but they do not redefine the persisted parser contract

### Stable example

Input markdown:

```md
## Goal
Ship deterministic spec rendering.

## Acceptance Criteria
1. Render canonical sections.

## Assumptions
- Parser input is markdown.

## Tasks
- [ ] Parse persisted markdown
- [/] Render canonical sections
- [x] Keep ids stable
```

Expected parsed output shape:

```ts
{
  sections: {
    goal: 'Ship deterministic spec rendering.',
    acceptanceCriteria: ['Render canonical sections.'],
    nonGoals: [],
    assumptions: ['Parser input is markdown.'],
    verificationPlan: [],
    rollbackPlan: []
  },
  tasks: [
    {
      id: 'task-parse-persisted-markdown',
      title: 'Parse persisted markdown',
      status: 'not_started',
      markdownLineIndex: 9
    },
    {
      id: 'task-render-canonical-sections',
      title: 'Render canonical sections',
      status: 'in_progress',
      markdownLineIndex: 10
    },
    {
      id: 'task-keep-ids-stable',
      title: 'Keep ids stable',
      status: 'complete',
      markdownLineIndex: 11
    }
  ]
}
```

The exact `updatedAt` value is runtime-generated and not part of the parser contract.

### Contract change policy

Until `KAT-178` lands, this design document is the owned description of the parser/renderer surface.

After `KAT-178` lands on `main`, the contract is defined by the landed code, exported types, and the freezing tests in:

- `tests/unit/renderer/right/primitives/parse-spec-markdown.test.ts`
- `tests/unit/renderer/right/primitives/spec-primitives.contract.test.ts`
- `tests/unit/renderer/right/SpecSections.test.tsx`
- `tests/unit/renderer/right/SpecTab.structured.test.tsx`
- `tests/unit/renderer/hooks/useSpecDocument.test.ts`

If the parser/renderer contract must change before merge:

- update this design doc
- update the freezing tests in the same change
- post the contract change explicitly in the `KAT-178` ticket thread

If the contract must change after `KAT-178` is already on `main`, it should happen in a new issue that treats the existing landed code and tests as the baseline contract being revised.

## 2) Architecture and File Ownership

The implementation should keep the current architecture but tighten ownership boundaries.

### Parser and task primitives

- `src/renderer/components/right/primitives/parse-spec-markdown.ts`
  - remains the single parser entry point for canonical section and task extraction
- `src/renderer/components/right/primitives/task-block-markdown.ts`
  - remains the single source for task status cycling and markdown line updates
- `src/renderer/components/right/primitives/spec-markdown-types.ts`
  - continues to expose the renderer-facing type aliases for the structured parser contract

### Document state and persistence bridge

- `src/renderer/hooks/useSpecDocument.ts`
  - owns markdown-to-structured-document derivation and persistence calls
  - must preserve deterministic reparse behavior after edit, draft apply, reload, and session restore
- `src/preload/index.ts`, `src/main/ipc-handlers.ts`, `src/main/state-store.ts`
  - remain persistence transport only for this ticket
  - no new conflict-resolution or task-sync semantics are introduced here

### Right-panel composition

- `src/renderer/components/layout/RightPanel.tsx`
  - continues to own the four right-panel states:
    - `generating`
    - `draft_ready`
    - `structured_view`
    - `editing`
- `src/renderer/components/right/SpecTab.tsx`
  - remains the mode-switch boundary for those states
- `src/renderer/components/right/SpecSections.tsx`
  - remains the structured section renderer that consumes `StructuredSpecDocument`
- `src/renderer/components/right/primitives/StructuredSectionBlocks.tsx`
  - remains the canonical section presentation primitive for section cards and empty states

## 3) Implementation Rules

Implementation under `KAT-178` should follow these rules:

- Prefer tightening and extending the current substrate over replacing it.
- Treat `parse-spec-markdown.ts` and `task-block-markdown.ts` as canonical utilities; do not create new parallel parser contracts in renderer code.
- Keep the parser contract line-oriented and deterministic because task updates rely on source-line markers.
- Keep display-only runtime overlays separate from persisted parser output.
- When behavior is ambiguous, choose deterministic output over markdown feature richness.

## 4) Determinism, Reload, and Session-Restore Requirements

To satisfy the ticket acceptance, the implementation must prove:

- persisted markdown restored through `specGet` parses into the same structured document shape on reload
- `specApplyDraft` followed by reload restores the same rendered sections and task rows
- task marker updates (`[ ]`, `[/]`, `[x]`) round-trip through save and reparse without changing task identity unexpectedly
- empty or malformed content degrades to stable empty structured sections instead of crashing or changing shape

These are `KAT-178` requirements because they validate the rendering substrate itself, not later task-sync behavior.

## 5) Testing Strategy

### Unit tests

Parser coverage:

- canonical heading normalization
- section extraction with missing sections
- ordered and unordered list normalization
- task marker parsing for `[ ]`, `[/]`, `[x]`
- duplicate task titles preserving deterministic ids
- malformed markdown returning stable empty defaults

Task utility coverage:

- full status cycle behavior
- marker conversion
- single-line markdown updates for LF and CRLF inputs
- out-of-range line index returning unchanged markdown

### Renderer tests

- `SpecTab` state tests for generating, draft-ready, editing, and structured-view modes
- `SpecSections` rendering of canonical sections and empty states
- snapshot overlay merge behavior where newer runtime task display can decorate, but not redefine, persisted task structure
- structured rendering parity for the key right-panel state represented by Mock 09

### Hook and persistence tests

- `useSpecDocument` restoring persisted markdown through `specGet`
- `setMarkdown`, `applyDraft`, and task marker toggles reparsing into the same shape expected by the structured renderer
- session-key isolation for document caches

## 6) Explicit Non-Goals

`KAT-178` does not define or own:

- checkbox persistence semantics beyond line-marker rewrite support already required for parser determinism
- write conflict rules between runtime overlays, user edits, and persisted markdown
- task store sync behavior across multiple writers
- fallback behavior for later task-sync tickets
- broader markdown richness such as tables, arbitrary nested block models, comments, or non-canonical section exports
- reworking orchestrator draft generation itself beyond consuming the markdown it provides

## 7) Risks and Mitigations

- Risk: parser logic drifts because task parsing exists in multiple places today.
  - Mitigation: treat `parse-spec-markdown.ts` as the canonical renderer contract and add tests that make drift obvious.
- Risk: later tickets infer behavior that `KAT-178` does not own.
  - Mitigation: keep non-goals explicit in this design and point later work at the landed code and tests on `main`.
- Risk: task identity breaks when titles or duplicates are handled inconsistently.
  - Mitigation: freeze deterministic `task.id` behavior with focused tests and stable examples.
- Risk: runtime snapshot overlays obscure the persisted parser contract.
  - Mitigation: keep overlay behavior documented as renderer decoration only, not parser output.

## 8) Acceptance Mapping

This design satisfies `KAT-178` by defining a stable parser/renderer substrate that:

- renders structured sections from persisted spec state
- restores stable output across reload and session restore
- freezes parser and renderer behavior with unit coverage and deterministic examples
- stays inside `KAT-178` ownership boundaries instead of expanding into later task-sync behavior

## Brainstorming Summary

- Reviewed the issue, parent epic, workflow docs, Spec 03 requirements, and mocks 08-09.
- Inspected the existing parser, task-block utilities, right-panel composition, persistence bridge, and current unit coverage.
- Evaluated broader alternatives and selected contract-first refinement of the existing substrate.
- Chose a single `KAT-178` design doc instead of a separate consumer contract artifact because later work will start from landed `main`.

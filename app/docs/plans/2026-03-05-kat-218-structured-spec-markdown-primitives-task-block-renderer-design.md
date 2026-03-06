# KAT-218 Structured Spec Markdown Primitives + Task Block Renderer Design

**Issue:** KAT-218  
**Parent Epic:** KAT-167 (Foundations — Shared Orchestrator UI/Data Primitives)  
**Fidelity Role:** Enabler  
**Branch:** `feature/kat-218-f5-structured-spec-markdown-primitives-task-block-renderer`  
**Specs:**
- `_plans/design/specs/03-spec-notes-panel.md`
- `_plans/design/specs/04-build-session.md`
- `_plans/design/specs/06-wave-execution.md`
- `_plans/design/specs/07-completion-verification.md`
**Mocks reviewed:** `08-09`, `10-14`, `18-25`, `26-29`

## Scope and Outcome

Create reusable, deterministic markdown and task-block primitives that can be used by both spec and verification surfaces, while staying within this worktree boundary:

- Owned scope:
  - `src/renderer/components/right/*`
  - Structured spec markdown primitives and task block renderer contracts
- Out of scope:
  - `src/renderer/components/center/*` (KAT-214)
  - shared agent/state schema plumbing in `src/shared/types/*` and `src/main/state-store.ts` (KAT-215)

Ticket outcome:

1. Extract and standardize markdown/spec primitives from right-panel implementations.
2. Expose task block rendering and task state mapping as reusable primitives.
3. Keep right-panel behavior parity with current spec/mocks while enabling downstream verification-surface reuse.
4. Provide tests that prove deterministic parse/render/toggle behavior.

## Constraints and Context

- Existing right-panel implementation already has working foundations (`spec-parser.ts`, `spec-task-markdown.ts`, `SpecSections.tsx`, `TaskList.tsx`), but contracts are right-panel-local and not explicitly reusable.
- Mock/spec parity requires stable section rendering for: Goal, Acceptance Criteria, Non-goals, Assumptions, Verification Plan, Rollback Plan, Tasks.
- Task markers must remain deterministic and round-trippable:
  - `[ ]` -> `not_started`
  - `[/]` -> `in_progress`
  - `[x]` -> `complete`
  - snapshot overlays may show `blocked` as display-only state.

## Approaches Considered

### Approach 1 (Recommended): Extract Shared Primitives from Existing Right-Panel Implementation

Refactor existing right-panel parsing and task-toggle logic into shared primitive modules and composable UI primitives, then consume them from `SpecSections` and future verification surfaces.

Pros:
- Lowest delivery risk; builds directly on already-shipped behavior.
- Preserves current right-panel UX and storage flow.
- Produces concrete reuse contracts without introducing new parser dependencies.

Cons:
- Requires careful API design to avoid coupling primitives to right-panel presentation.

### Approach 2: Replace with a Generic Markdown Library Pipeline (remark/rehype)

Replatform section/task parsing using a full markdown AST ecosystem and custom plugins.

Pros:
- Strong long-term flexibility for broader markdown features.

Cons:
- High migration and regression risk for this ticket.
- Over-scoped for enabler goal; unnecessary dependency churn.

### Approach 3: Duplicate Current Right-Panel Logic into Verification Surface and Normalize Later

Keep right implementation unchanged, copy the logic where needed later.

Pros:
- Fastest short-term path.

Cons:
- Violates foundation goal in KAT-167.
- Guarantees drift and duplicated bugs.

## Recommendation

Proceed with **Approach 1**.

This satisfies KAT-218’s foundation objective with minimal risk and keeps future verification integration straightforward.

## Proposed Design

## 1) Primitive Module Boundaries

Create a reusable primitive layer under right-owned UI scope:

- `src/renderer/components/right/primitives/spec-markdown-types.ts`
  - shared renderer-facing types for section keys, task item contract, and parsed document shape.
- `src/renderer/components/right/primitives/parse-spec-markdown.ts`
  - deterministic parser for structured section extraction and task list capture.
- `src/renderer/components/right/primitives/task-block-markdown.ts`
  - task marker conversion, status cycling, and markdown line update operations.
- `src/renderer/components/right/primitives/TaskBlockList.tsx`
  - reusable task block list renderer with optional display overlay (`blocked`, activity metadata).
- `src/renderer/components/right/primitives/StructuredSectionBlocks.tsx`
  - reusable section-card rendering primitives for ordered/unordered section content.

Notes:
- Existing files (`spec-parser.ts`, `spec-task-markdown.ts`, `TaskList.tsx`) can be kept as compatibility shims during migration, then reduced to re-exports.
- Keep primitives presentation-light and data-contract-heavy so verification surfaces can consume them without inheriting full Spec tab chrome.

## 2) Contract Design

### Parse contract

`parseSpecMarkdown(markdown: string): ParsedSpecMarkdownDocument`

Guarantees:
- Stable heading normalization (case-insensitive) for the six section headings plus Tasks.
- Stable output ordering regardless of source heading order.
- Empty arrays/strings for missing sections.
- Preserves `markdownLineIndex` for each task to support deterministic source updates.

### Task block contract

- `cycleTaskStatus(status)` returns next status in deterministic loop.
- `markerForStatus(status)` returns canonical marker.
- `updateTaskLineInMarkdown(markdown, markdownLineIndex, nextStatus)` performs a single-line marker update without mutating unrelated lines.

### Renderer contract

`TaskBlockList` props:
- `tasks: SpecTaskItem[]` (+ optional display overlay fields)
- `onToggleTask?: (taskId: string) => void`
- `mode?: 'interactive' | 'readonly'`

`StructuredSectionBlocks` props:
- document sections
- task renderer slot (`renderTasks`) so spec and verification can share sections but diverge in task affordances.

## 3) Integration Plan (Within Ticket Scope)

1. Migrate `SpecSections.tsx` to consume `StructuredSectionBlocks` + `TaskBlockList` primitives.
2. Migrate `useSpecDocument` to import from `task-block-markdown` primitive module.
3. Keep `RightPanel` behavior unchanged:
   - generating -> draft_ready -> structured_view -> editing flows remain intact.
4. Provide a lightweight verification-surface adapter component under right scope (e.g. `VerificationTaskBlockSummary.tsx`) that reuses the same task primitive contracts as proof of reusability without touching `center/*`.

## 4) Data Flow

1. Markdown source from `useSpecDocument`.
2. Parser produces `ParsedSpecMarkdownDocument` (sections + tasks with line indexes).
3. `TaskActivitySnapshot` overlays display-only fields (`blocked`, activity detail, active agent).
4. `TaskBlockList` renders merged task state.
5. Toggle action updates markdown line via primitive update utility.
6. `useSpecDocument` persists updated markdown through existing IPC/fallback path.

## 5) Error Handling and Determinism Rules

- Malformed markdown headings:
  - parser returns partial document with empty defaults; no throw.
- Invalid/missing task markers:
  - treat as `not_started` unless explicit marker recognized.
- Out-of-range `markdownLineIndex` on update:
  - no-op return of original markdown.
- Task id collisions:
  - continue to derive ids with stable id utility and preserve first occurrence order.

## 6) Testing Strategy

### Unit tests

- Parser:
  - heading normalization and section extraction
  - missing sections and malformed structure fallback
  - task line capture and marker mapping
- Task markdown utilities:
  - full cycle transitions
  - marker conversion
  - line update correctness with both LF and CRLF inputs

### Component tests

- `TaskBlockList`:
  - status badge/checkbox mapping
  - indeterminate state for in-progress
  - blocked overlay rendering
- `StructuredSectionBlocks`:
  - ordered vs unordered list rendering
  - empty-state rendering consistency

### Regression tests (integration)

- `SpecSections` + `useSpecDocument` round-trip:
  - parse -> render -> toggle -> markdown persisted -> parse again.

## 7) Non-Goals

- Center-panel message rendering changes.
- Agent registry/schema changes.
- Permission dialog implementation.
- Full final verification page buildout from Spec 07.

## 8) Risks and Mitigations

- Risk: Primitive extraction breaks current right-panel behavior.
  - Mitigation: migration via compatibility shims and regression tests before cleanup.
- Risk: Overfitting primitives to current spec-only UI.
  - Mitigation: define slot-based section/task renderer API, include verification adapter proof.
- Risk: Divergence between snapshot status and markdown status semantics.
  - Mitigation: keep snapshot overlay display-only and never write `blocked` into markdown markers.

## 9) Acceptance Mapping

This design satisfies the KAT-218 quality bar by defining a deterministic primitive contract reusable across spec and verification contexts, with explicit ownership boundaries and test evidence requirements.

## Brainstorming Summary

- Explored current right-panel/state/doc/mock context and epic/ticket constraints.
- Compared 3 approaches with trade-offs.
- Selected incremental primitive extraction as the recommended path.
- Produced implementation-ready design contracts and validation plan.

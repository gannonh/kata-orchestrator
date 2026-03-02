# KAT-160 Structured Spec Panel Rendering + Interactive Task Toggles Design

**Issue:** KAT-160  
**Parent:** KAT-157 (Slice A - Build Session / Spec 04)  
**Specs:** `_plans/design/specs/03-spec-notes-panel.md`, `_plans/design/specs/04-build-session.md`

## Scope and Outcome

Deliver the minimum Spec 03 behavior needed for Prompt-to-Spec demo quality in the right panel:

- Render structured spec sections: Goal, Acceptance Criteria, Non-goals, Assumptions, Verification Plan, Rollback Plan, Tasks
- Support draft-apply from the latest completed run into editable spec content
- Add interactive task toggles with deterministic markdown/state mapping and local persistence
- Keep existing right-panel note-tab behavior intact
- Define explicit disposition for comment/thread behavior (preserve or defer)
- Add tests and screenshot evidence for render parity and task transitions

This ticket intentionally focuses on right-panel structured spec behavior. Left-sidebar task parity and full session resume remain in dependent tickets.

## Assumptions and Constraints

- KAT-159 established run lifecycle behavior in the center panel, but the right panel is still `mockProject`-driven and requires explicit wiring for latest-run draft consumption.
- KAT-160 provides local persistence for spec/task interactions in the active session UI scope.
- KAT-161 remains responsible for broader "resume across app relaunch" guarantees and integration-level persistence hardening.
- Current app baseline has no active comment-thread implementation in `app/src/renderer`; therefore KAT-160 must either preserve existing behavior (none) or defer explicitly.

## Approaches Considered

### Approach 1 (Recommended): Incrementally Extend Existing RightPanel + SpecTab with a Structured Spec State Layer

Add a focused spec state model and parser in renderer, wire latest run draft into that model, and keep existing panel/tab scaffolding.

Pros:
- Lowest migration risk; reuses current `RightPanel`/`SpecTab` structure and tests
- Fits current queue sequencing (KAT-160 before KAT-161/KAT-188)
- Enables visible demo behavior quickly without replatforming

Cons:
- Requires careful compatibility handling between legacy `ProjectSpec` shape and new structured spec model
- Needs explicit contracts for bridging center run output to right panel

### Approach 2: Generic Markdown-First Rendering Engine in Right Panel

Drive the right panel from raw markdown plus rich markdown rendering and task-item custom renderers.

Pros:
- Flexible for future section additions
- Minimal section-specific UI components

Cons:
- Harder to enforce exact section ordering and demo parity
- More fragile task-state mapping and persistence behavior

### Approach 3: Port Full Legacy SpecNotePanel Architecture into Current Renderer

Introduce a full feature module with comments, thread trees, draft cards, and store logic as a larger transplant.

Pros:
- Closer to full Spec 03 long-term target
- Could reduce later parity work if fully completed

Cons:
- Too large for KAT-160 scope and sequencing
- High risk of churn against the active app architecture

## Recommendation

Proceed with **Approach 1**.

It delivers the required minimum for KAT-160 while preserving current app structure and keeping follow-up tickets (KAT-161/KAT-188/KAT-187) cleanly separable.

## Proposed Design

## 1) UI States for Right Spec Panel

Implement three deterministic right-panel states:

1. **Generating Spec (mock-08 aligned):** no applied structured spec yet; show onboarding/status copy and latest run status.
2. **Draft Ready:** latest run has a draft payload; show draft metadata + `Apply Draft to Spec` action.
3. **Structured Spec Applied (mock-09 aligned):** render section blocks and interactive tasks; support inline editing mode.

Editing model:
- Default to rendered structured mode once draft is applied.
- Provide an explicit `Edit markdown` toggle in-panel.
- Save edits to the same spec document state and re-parse on save.

## 2) Data Contracts

Add a right-panel-specific model in renderer types:

```ts
type SpecTaskStatus = 'not_started' | 'in_progress' | 'complete'

type StructuredSpecSections = {
  goal: string
  acceptanceCriteria: string[]
  nonGoals: string[]
  assumptions: string[]
  verificationPlan: string[]
  rollbackPlan: string[]
}

type SpecTaskItem = {
  id: string
  title: string
  status: SpecTaskStatus
  markdownLineIndex: number
}

type StructuredSpecDocument = {
  markdown: string
  sections: StructuredSpecSections
  tasks: SpecTaskItem[]
  updatedAt: string
  appliedRunId?: string
}

type LatestRunDraft = {
  runId: string
  generatedAt: string
  content: string
}
```

State source of truth for KAT-160:
- `StructuredSpecDocument` in renderer state
- `LatestRunDraft` derived from latest completed run in active session context

## 3) Parsing and Rendering Strategy

Implement `parseStructuredSpec(markdown)` with deterministic heading extraction for:
- `## Goal`
- `## Acceptance Criteria`
- `## Non-goals`
- `## Assumptions`
- `## Verification Plan`
- `## Rollback Plan`
- `## Tasks`

Rules:
- Preserve section order in render regardless of source ordering
- Missing sections render with empty-state copy
- Task parsing accepts checkbox list items under `Tasks`:
  - `- [ ] Task` -> `not_started`
  - `- [/] Task` -> `in_progress`
  - `- [x] Task` -> `complete`

Render composition:
- `SpecSectionCard` reusable component per section
- `SpecTaskChecklist` renders task rows with shadcn `Checkbox`
- Existing `MarkdownRenderer` is extended only where required (ordered list + inline code span support) for content fidelity

## 4) Draft Apply Flow

Flow:

1. Center runtime marks a run as completed with a draft payload.
2. Right panel receives/derives `latestRunDraft`.
3. User clicks `Apply Draft to Spec`.
4. System writes `draft.content` into `StructuredSpecDocument.markdown`, parses sections/tasks, and stamps `appliedRunId`.
5. UI switches to rendered structured mode.

Behavior guarantees:
- Applying a new draft replaces structured content but preserves user mode preference (render/edit).
- Last-applied run metadata is visible for traceability.

## 5) Task Toggle Mapping and Persistence

Toggle behavior:
- Clicking a task checkbox cycles states in this order:
  - `not_started -> in_progress -> complete -> not_started`
- Status updates both:
  - in-memory task model
  - source markdown checkbox marker on the corresponding task line

Persistence (KAT-160 scope):
- Save `StructuredSpecDocument` to localStorage per active session key:
  - `kata.spec-panel.v1:<spaceId>:<sessionId>`
- Persist on apply, edit save, and checkbox toggle (debounced write)

KAT-161 handoff:
- Keep storage shape stable so KAT-161 can migrate to stronger app-state resume guarantees without changing UI contracts.

## 6) Comment/Thread Behavior Decision

**Decision: intentionally defer comment/thread implementation; preserve current behavior.**

Rationale:
- Current `app/src/renderer` baseline does not implement comment/thread UI in the right panel.
- KAT-160 acceptance is focused on structured render + draft-apply + task toggles.
- Introducing full threaded comments here would materially expand scope and overlap post-slice parity work.

Preservation contract:
- Existing right-panel tab behavior (Spec + user-created note tabs) remains intact.
- No regression in current note-tab creation/rename/close interactions.

## 7) Testing and Evidence Plan

Unit/component coverage:

- `parseStructuredSpec` extracts all required sections with stable ordering.
- Task checkbox mapping round-trips markdown <-> task state.
- Task toggle transitions update both UI state and markdown markers.
- `Apply Draft to Spec` replaces content and renders structured sections.
- Right panel note-tab behavior remains unchanged.

Suggested test files:
- `tests/unit/renderer/right/spec-parser.test.ts`
- `tests/unit/renderer/right/SpecTab.structured.test.tsx`
- `tests/unit/renderer/right/RightPanel.spec-draft-flow.test.tsx`

Screenshot parity evidence:
- Add KAT-160 e2e evidence capture with explicit states:
  - generating/onboarding state (mock-08 parity)
  - structured applied state (mock-09 parity)
- Save artifacts under:
  - `test-results/kat-160/state-generating.png`
  - `test-results/kat-160/state-structured.png`

## 8) Non-Goals

- Left-sidebar task checklist parity and cross-panel sync with left lane (KAT-188)
- Approval action buttons in conversation (KAT-187)
- Full app-relaunch resume guarantees and broader persistence migration (KAT-161)
- Full comment/thread collaboration feature parity

## 9) Risks and Mitigations

- **Risk:** parser brittleness with malformed drafts  
  **Mitigation:** enforce tolerant parsing + fallback empty states + parser unit tests for malformed inputs.

- **Risk:** state divergence between markdown and task model  
  **Mitigation:** single writer utility that updates markdown and derived tasks atomically.

- **Risk:** regressions in right-panel tab UX  
  **Mitigation:** keep existing `RightPanel` tab orchestration unchanged and add regression tests.

## Approval Gate

If this design is approved, next step is to switch to `writing-plans` and draft:

- `docs/plans/2026-03-02-kat-160-structured-spec-panel-rendering-task-toggles-implementation-plan.md`

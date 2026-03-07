# KAT-170 [02.2] Sidebar sections/nav with collapse-expand behavior Design

**Issue:** KAT-170  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-170/022-sidebar-sectionsnav-with-collapse-expand-behavior  
**Branch target:** `feature/kat-170-022-sidebar-sectionsnav-with-collapse-expand-behavior`  
**Parent epic:** KAT-163 Post-Slice A - Coordinator Session Parity (Spec 02)  
**Specs:** `_plans/design/specs/02-coordinator-session.md`  
**Relevant mocks:** `04-coordinator-session-initial-state.png`, `05-coordinator-session-pasted-context.png`, `06-coordinator-session-spec-context-reading.png`, `07-coordinator-session-spec-analyzing.png`

## Scope and Outcome

Implement the left coordinator-session sidebar surface so it matches the Spec 02 mock family for the scoped behaviors this ticket owns:

- stacked `Agents` and `Context` sections in the expanded sidebar
- icon-rail navigation affordances that remain visible when the sidebar is collapsed
- collapse and expand behavior that preserves the selected mode
- coordinator-row and context-row presentation aligned with the mock states

This ticket is classified as **Final fidelity (scoped)** for the left sidebar surface. It owns shippable UX quality for the sidebar states shown in mocks `04` through `07`, with regression-safe tests. It does **not** own:

- message-card and status badge primitives in the center column (`KAT-171`, `KAT-172`)
- right-panel workflow/spec fidelity (`KAT-175`, `KAT-178`)
- cross-surface parity evidence package (`KAT-176`)
- agent/context persistence contracts (`KAT-169`)

Required outcome:

- coordinator sessions render a sidebar whose default expanded state visually reads like the mocks, not like the current tabbed workspace sidebar
- the left rail remains reusable for future `Changes` and `Files` views instead of forcing a one-off fork
- the implementation consumes the KAT-169 coordinator selectors rather than inventing new renderer-only data parsing
- top-level left-rail affordances remain mutually exclusive for now; selecting one should not expand multiple top-level surfaces at once

## Context Loaded

Sources reviewed for this design:

- Linear:
  - `KAT-170` issue, comments, blocker chain, and parent epic `KAT-163`
  - blocker `KAT-169`, which is `Done` as of **March 6, 2026**
- Linear documents:
  - `Execution Model: UI Baseline then Parallel Functional Vertical Slices`
  - `Desktop App Linear Workflow Contract`
  - `UI Ticket Fidelity Contract (Desktop App)`
- Specs and mocks:
  - `AGENTS.md`
  - `_plans/design/specs/README.md`
  - `_plans/design/specs/02-coordinator-session.md`
  - `_plans/design/mocks/README.md`
  - local mock images `04` through `07`
- Current implementation:
  - `src/renderer/components/layout/AppShell.tsx`
  - `src/renderer/components/layout/LeftPanel.tsx`
  - `src/renderer/components/left/AgentsTab.tsx`
  - `src/renderer/components/left/AgentCard.tsx`
  - `src/renderer/components/left/ContextTab.tsx`
  - `src/renderer/components/left/LeftSection.tsx`
  - `src/renderer/hooks/useSessionAgentRoster.ts`
  - `src/renderer/features/coordinator-session/domain/contracts.ts`
  - `src/renderer/features/coordinator-session/domain/selectors.ts`
  - `src/renderer/components/center/ChatPanel.tsx`
  - `src/renderer/components/layout/RightPanel.tsx`
- Existing tests and nearby docs:
  - `tests/unit/renderer/left/LeftPanel.test.tsx`
  - `tests/e2e/kat-185-agent-roster-sidebar.spec.ts`
  - `docs/plans/2026-03-06-kat-169-agentcontext-sidebar-domain-model-state-contracts-design.md`
  - `docs/plans/2026-03-06-kat-171-conversation-message-primitives-coordinator-status-design.md`

## Current State Summary

The foundation for this ticket is already present, but it currently resolves to the wrong user experience for Spec 02:

- `AppShell` already owns left-column width, collapse state, and the rail/content split.
- `LeftPanel` already has a persistent icon rail and working collapse/expand controls.
- KAT-169 has already established canonical coordinator selectors for:
  - prompt preview text
  - session context resources
  - active-run context chips and summary
- `AgentsTab` and `ContextTab` are still shaped for the broader workspace shell, not the coordinator mock:
  - `AgentsTab` shows card-style summaries and background-agent rollups
  - `ContextTab` is still driven by project tasks and `./notes` copy, not session context resources
  - `LeftPanel` shows one active tab at a time and includes `LeftStatusSection`, which the coordinator mocks do not show

The result is close in infrastructure but wrong in composition. The current sidebar is a general workspace navigator. Spec 02 needs a coordinator-focused sidebar that is visibly simpler: a narrow rail, then one stacked content column containing `Agents` and `Context`.

## Clarifications and Assumptions

- Use the KAT-169 coordinator selectors as the only source for sidebar-specific data semantics. This ticket should not parse run prompts or context resources directly inside JSX.
- Reuse the existing `LeftPanel` rail, collapse state, and `AppShell` plumbing unless that reuse directly blocks mock parity.
- Keep top-level affordances mutually exclusive for now. `Agents`, `Context`, `Changes`, and `Files` should each continue to map to one active surface at a time.
- Preserve `Changes` and `Files` as selectable rail destinations for later specs, but do not let those surfaces distort the default coordinator experience in mocks `04` through `07`.
- The `+ Create new agent` and `+ Add context` affordances are presentation-only in this ticket unless backing flows already exist. Their interactive behavior can remain stubbed or callback-driven.
- Width tuning needed for sidebar parity is in scope for this ticket when it is necessary to land the left-surface fidelity, but full three-column balancing still belongs to downstream parity verification.

## Approaches Considered

### Approach 1 (Recommended): Coordinator-specific tab content on top of the existing `LeftPanel` shell

Keep `LeftPanel` as the owner of the rail and collapse mechanics, but introduce coordinator-session variants for the `Agents` and `Context` tabs so each top-level affordance remains exclusive while its selected content becomes Spec 02 faithful.

Pros:

- Reuses the tested collapse/expand mechanics already present in `LeftPanel`.
- Preserves one left-sidebar architecture for coordinator, build, changes, and files flows.
- Keeps the top-level interaction model aligned with the current shell and your clarification.
- Fits naturally with the KAT-169 selector model.

Cons:

- Requires targeted refactoring of `AgentsTab` and `ContextTab` so they present the Spec 02 content model rather than the current workspace-shell defaults.
- Introduces a small mode concept into `LeftPanel` and `AppShell`.

### Approach 2: Stack `Agents` and `Context` into one coordinator-only content view

Leave the rail in place but make both top-level affordances point to the same expanded coordinator composition containing both sections.

Pros:

- Closest structural match to a literal reading of the mocks.
- Produces a very focused coordinator sidebar.

Cons:

- Conflicts with the clarified interaction requirement that top-level affordances should not stack for now.
- Makes the rail semantics ambiguous because two icons would map to the same active content surface.
- Adds complexity around focus and selection without clear product value today.

### Approach 3: Keep the current tabbed `LeftPanel` and only restyle it to look closer to the mock

Leave the one-tab-at-a-time structure in place and try to mimic the mock via typography, spacing, and narrower widths.

Pros:

- Lowest code churn.
- Reuses almost all current test coverage.

Cons:

- Keeps too much of the current workspace-shell content model, especially the `ContextTab` task tree and left status block.
- Risks landing a cosmetic change instead of the scoped Spec 02 fidelity work.
- Still needs coordinator-specific copy and selector-backed rows, so the savings are smaller than they appear.

### Approach 4: Fork a dedicated `CoordinatorSidebar` separate from `LeftPanel`

Create a new standalone sidebar for Spec 02 and leave the existing `LeftPanel` untouched.

Pros:

- Fastest path to strict visual matching for the current mocks.
- Avoids threading mode flags through current sidebar code.

Cons:

- Duplicates collapse, rail, and panel infrastructure that already exists.
- Increases merge risk with future sidebar work in Specs 04-07.
- Makes long-term maintenance worse because left-column behavior would diverge by surface instead of sharing primitives.

## Recommendation

Proceed with **Approach 1**.

This ticket should treat the current `LeftPanel` as a shell primitive, not as the final coordinator UX. The rail, collapse button, and one-active-affordance selection state are worth preserving. The selected `Agents` and `Context` bodies need to be recomposed around Spec 02 rather than forced through the current workspace-shell content.

## Proposed Design

## 1) Sidebar Ownership Boundary

Keep responsibilities split like this:

- `AppShell`
  - owns left-column width and cross-column layout
  - passes the active session/space context into the left panel
- `LeftPanel`
  - owns the icon rail
  - owns expanded vs collapsed state
  - owns which rail destination is active
  - chooses which coordinator-specific content body to render for the active surface
- new coordinator-sidebar content layer
  - renders a Spec 02 faithful `Agents` body and a Spec 02 faithful `Context` body
  - consumes selector-backed data
  - owns coordinator-specific copy and section spacing

Recommended renderer additions:

- `src/renderer/components/left/CoordinatorAgentsSection.tsx`
- `src/renderer/components/left/CoordinatorContextSection.tsx`
- `src/renderer/components/left/CoordinatorSidebarMode.ts`

These should be compositional wrappers around existing left-panel building blocks, not a parallel design system.

## 2) Content Model: Exclusive Top-Level Affordances, Coordinator-Specific Bodies

In coordinator mode, the expanded content area should still render one active top-level destination at a time.

Rail selection behavior:

- `agents` icon:
  - opens the coordinator-specific `Agents` content
- `context` icon:
  - opens the coordinator-specific `Context` content
- `changes` / `files` icons:
  - continue to render their dedicated single-surface panels

This preserves a clear top-level interaction model while still allowing the `Agents` and `Context` surfaces themselves to be redesigned to match the coordinator mocks more closely.

## 3) Coordinator Data Inputs

The coordinator sidebar content should consume the KAT-169 selector outputs, not raw store maps:

```ts
selectCoordinatorAgentList(state, sessionId)
selectCoordinatorContextItems(state, sessionId)
selectCoordinatorPromptPreview(state, sessionId)
```

Recommended view-model assembly:

- `Agents` surface:
  - list items from `selectCoordinatorAgentList`
  - coordinator preview subtitle from `selectCoordinatorPromptPreview`
- `Context` surface:
  - items from `selectCoordinatorContextItems`

Display rules:

- the coordinator row subtitle should prefer the prompt preview string from the latest run
- non-coordinator agents can fall back to `currentTask` or role copy when present
- the `Spec` context resource should always render first when seeded by session creation

This keeps the sidebar aligned with the data contract already stabilized by KAT-169.

## 4) Surface Presentation

The mock’s copy and row treatment are lighter than the current workspace-shell left content. Each selected coordinator surface should read as:

- semibold section label
- muted explanatory copy
- inline text affordance such as `+ Create new agent` or `+ Add context`
- simple row list underneath

Design implication:

- extend `LeftSection` so it can render either:
  - the current icon-button action style, or
  - a mock-faithful inline text action style
- do not force coordinator surfaces to use the current top-right plus-icon pattern

Surface-specific rules:

### Agents

- Description copy should remain: `Agents write code, maintain notes, and coordinate tasks.`
- The primary coordinator row should use the compact mock style:
  - small colored status/icon marker
  - name
  - truncated preview subtitle
- Background/delegated agent grouping from the current `AgentsTab` should remain supported, but the default mock path should render cleanly when only the coordinator is present.

### Context

- Replace the current `./notes` guidance with the Spec 02 copy about shared context and notes location.
- Rows should be simple text items, not nested task-state lists.
- `Spec` should be rendered as the baseline seeded resource.

## 5) Collapse and Expand Behavior

The current collapse model is directionally correct and should be retained with tighter coordinator semantics.

Required behavior:

- collapsing the sidebar hides only the expanded content pane and preserves the rail
- the rail remains fully interactive while collapsed
- expanding restores the last selected destination
- collapse state must remain controllable from `LeftPanel` and from higher-level shell props, as current tests already require

Accessibility requirements:

- keep explicit `aria-label`s for collapse and expand buttons
- keep `aria-hidden` on the content pane while collapsed
- preserve visible focus state for rail buttons when the content pane is hidden

## 6) Width and Layout Tuning

The current `AppShell` defaults are too wide for the coordinator mock family:

- `LEFT_MIN = 320`
- `LEFT_DEFAULT = 390`

Spec 02 visually needs a narrower sidebar. The design should therefore allow coordinator-mode width presets, for example:

- coordinator left default around `240-260px`
- collapsed rail remains `56px`
- max width lower than the current build-session-oriented shell

Recommended approach:

- keep the existing generic layout math in `AppShell`
- add per-surface width presets rather than globally shrinking the left column for every app mode

This keeps Spec 02 fidelity work isolated from later left-column variants that may want more room.

## 7) Interaction and State Mapping

The sidebar behavior in the four referenced mocks can be mapped like this:

- Mock 04 initial state:
  - expanded coordinator sidebar
  - `Agents` selected
  - coordinator row preview populated from latest run prompt
- Mock 05 pasted context:
  - same `Agents` surface can remain selected
  - no structural sidebar difference; center/right change only
- Mock 06 context reading:
  - same selected top-level surface
  - context item list remains stable while center chips show active run references
- Mock 07 analyzing:
  - same selected top-level surface
  - no special-case left state beyond preserving selection and compactness

That means this ticket should avoid inventing state-specific sidebar branches. The left surface is intentionally stable across `04` through `07`, with the active top-level affordance preserved.

## 8) Suggested Refactor Shape

A pragmatic implementation path is:

1. Refactor `AgentsTab` into a coordinator-friendly `Agents` surface backed by selector data.
2. Refactor `ContextTab` into a coordinator-friendly `Context` surface backed by context resources instead of mock project tasks.
3. Update `LeftPanel` so coordinator mode routes `agents` and `context` to those refined surfaces, while `changes` and `files` remain on their existing paths.
4. Narrow coordinator-mode width presets in `AppShell`.

This sequence keeps the write scope localized and minimizes churn in working `Changes` and `Files` views.

## 9) Testing Strategy (TDD)

Unit coverage should lock the left-surface behavior before implementation:

- `LeftPanel` in coordinator mode renders one active top-level surface at a time
- `agents` rail selection renders the coordinator `Agents` surface
- `context` rail selection renders the coordinator `Context` surface
- coordinator prompt preview is rendered from selector-backed data
- context items are rendered from session context resources rather than mock project tasks
- collapsing hides the content pane and preserves rail interaction
- expanding restores the coordinator content pane
- controlled collapse still emits `onCollapsedChange` without mutating internal state

E2E coverage for this ticket should prove:

- a seeded coordinator session shows the coordinator `Agents` surface by default
- switching to `Context` shows `Spec` in the context surface
- collapse and expand preserve the rail and restore the sidebar content

`KAT-176` will still own the final mock-parity evidence package across the full three-column surface, but this ticket should land regression-safe unit and targeted E2E coverage for its own behavior.

## 10) Risks and Mitigations

### Risk: breaking other left-column flows while narrowing the coordinator sidebar

Mitigation:

- isolate the stacked coordinator composition behind an explicit coordinator surface mode
- keep `Changes` and `Files` on their existing render paths

### Risk: coupling this ticket to unfinished create-agent or add-context flows

Mitigation:

- keep affordances callback-driven and presentation-first
- do not block sidebar parity on full creation flows

### Risk: duplicating KAT-169 contract logic in the renderer

Mitigation:

- consume only selector outputs from `src/renderer/features/coordinator-session/domain`
- forbid prompt-preview derivation inside JSX components

## Recommendation for Approval

Approve this design if the intended implementation direction is:

- reuse the existing rail/collapse shell
- keep one active top-level affordance at a time
- replace the current workspace-shell `Agents` and `Context` bodies with coordinator-specific surfaces
- keep `Changes` and `Files` accessible without letting them define the Spec 02 default view

If that direction looks right, the next step is the implementation plan and TDD task breakdown for the `LeftPanel`/`AppShell` refactor.

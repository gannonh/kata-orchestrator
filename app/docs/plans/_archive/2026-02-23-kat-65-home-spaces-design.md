# KAT-65 Design: Home/Spaces Top-Level Screen

Date: 2026-02-23  
Issue: KAT-65  
Scope: UI fidelity for project management (Spaces) page with representational local interactions

## Goal

Deliver a visually credible Home/Spaces screen that fully replaces the current workspace shell when selected, matching the intended "switch repo/workspace context" mental model.

## Final Decisions

1. Home/Spaces is a dedicated top-level app view, not an overlay.
2. Entering Home replaces all workspace panes; current workspace UI is not shown.
3. This ticket includes representational UI plus local UI interactions.
4. No backend persistence or full CRUD behavior is included in this ticket.

## Approaches Considered

### 1) Dedicated top-level app view (`workspace | home`) — Selected

- Pros: clear ownership boundaries, clean context switch semantics, easiest to prevent stale workspace UI leakage.
- Cons: requires top-level view-state plumbing.

### 2) Keep shell mounted and replace all pane contents

- Pros: fewer top-level changes.
- Cons: weaker boundaries and higher risk of mixing Home and workspace concerns.

### 3) Modal takeover above workspace shell

- Pros: quick to build.
- Cons: not aligned with repo/workspace switch model; harder focus and interaction isolation.

## Architecture

Introduce app-level view state:

- `appView: 'workspace' | 'home'`

Render strategy:

- `appView='workspace'` renders existing `AppShell`
- `appView='home'` renders new `HomeSpacesScreen` full-screen

Transitions:

- Top chrome Home action -> `appView='home'`
- Select/open space in Home -> set selected space context and switch to `appView='workspace'`

## UI Composition

`HomeSpacesScreen` contains:

1. `HomeTopChrome`
- Top app chrome with Home active state and navigation affordance back to workspace.

2. `CreateSpacePanel` (left)
- Heading and dismiss affordance
- Prompt textarea
- Context action row (`+ Add context` and icons)
- Repo/branch row
- Create space button
- Orchestration mode cards (team vs single)
- Setup options row with rapid-fire toggle

3. `SpacesListPanel` (right)
- Controls row (grouped by repo, show archived, search)
- Repo group headers
- Space rows with metadata/status chips and selected/hover states

## Local State Model (Representational)

- `isCreatePanelActive: boolean`
- `spacePrompt: string`
- `selectedMode: 'team' | 'single'`
- `rapidFire: boolean`
- `groupByRepo: boolean`
- `showArchived: boolean`
- `searchQuery: string`
- `selectedSpaceId: string | null`
- `spacesViewModel: in-memory mock list and derived grouped/filtered projections`

## Interaction Contract

- Prompt focus/entry toggles active visual treatment.
- Group/search/archive toggles update list rendering in-memory.
- Space-row selection updates selected state visuals.
- Open/enter space callback transitions back to workspace view.
- Create action may append a mock space row in-memory (session-only).

## Error and Empty States

- Empty list state when no spaces exist.
- Filter/search no-results state: "No spaces match your filters."
- Lightweight create action guard (for example disabled action on empty prompt when enabled).
- No network/IPC error flows in this ticket.

## Testing Strategy (for implementation phase)

Unit:

1. Top-level view switching (`home <-> workspace`)
2. Home control toggles update rendered rows
3. Search + grouped/archive derivation logic
4. Row selection and open callback behavior
5. Create-panel active-state and mode toggle rendering

E2E (`@quality-gate` relevant coverage):

1. Open Home and verify full-screen takeover
2. Exercise grouped/archive/search controls and verify visible rows
3. Select/open a space and verify return to workspace shell
4. Confirm no residual workspace pane content is visible while Home is active

## Out of Scope

- Persistent storage for Home interactions
- Real space CRUD integration and IPC write paths
- Repo/branch picker implementation details beyond representational UI
- Backend-driven status data

## Acceptance Mapping

- "Visually credible and strong UI foundation": addressed via dedicated full-screen Home fidelity surface.
- "Core representational states": addressed through local stateful interactions and explicit empty/filter/selected states.
- "Sizing, alignment, controls, styling": addressed by componentized layout and interaction contract.


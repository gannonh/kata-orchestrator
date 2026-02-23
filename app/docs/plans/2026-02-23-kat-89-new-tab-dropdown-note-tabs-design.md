# KAT-89 Design: New Tab Dropdown + Note Tab Creation/Rename (UI Fidelity)

Date: 2026-02-23
Issue: KAT-89

## Goal
Match the updated UI fidelity requirements for:
- New-tab `+` affordance in center and right panels
- Dropdown menu styling and affordances
- New Note tab creation in the panel where `+` is clicked
- New Note tab rename/close interactions

## Confirmed Scope
- `+` exists in both center and right panel tab strips.
- Dropdown includes: `New Agent`, `New Note`, `New Terminal`, `New Browser`.
- Only `New Note` is functional in KAT-89.
- Other dropdown items remain enabled and clickable, but are no-op for now.
- New note tabs are created in the same panel where `+` is clicked.
- New note tabs auto-focus when created.
- New note tabs are closable.
- New note tabs are renamable.
- Rename starts from `New Note` default label.
- State is in-memory only (no persistence across reload).
- Base tabs (`Coordinator`, `Spec`) remain fixed and are not closable/renamable in this ticket.

## Approaches Considered
1. Per-panel ad hoc implementation
- Fastest short-term but duplicates behavior and increases future refactor cost.

2. Shared dynamic tab-strip primitive (selected)
- One reusable tab/dropdown/rename/close pattern used by center and right panels.
- Keeps this ticket scoped while aligning with future arbitrary tab/pane goals.

3. Full global pane/tab layout engine now
- Best long-term model, but oversized and risky for current fidelity scope.

## Architecture
Implement a shared dynamic tab-strip component used by both panels with panel-local state.

- Center panel state:
  - Base tab: `Coordinator`
  - Dynamic tabs: user-created `New Note`
- Right panel state:
  - Base tab: `Spec`
  - Dynamic tabs: user-created `New Note`

Each panel independently manages:
- tab list
- active tab
- rename editing state

No global tab graph and no IPC changes in KAT-89.

## Interaction Design
### Create Note Tab
- Click `+` -> open dropdown.
- Click `New Note` -> append new tab labeled `New Note` in that panel.
- Newly created tab becomes active.

### Rename Note Tab
- Trigger: double-click on note tab label.
- Inline edit rules:
  - `Enter` saves
  - blur saves
  - `Esc` cancels
- Empty/whitespace-only rename keeps prior label.

### Close Note Tab
- `x` shown only for dynamic note tabs.
- Close removes tab.
- If closed tab was active, focus moves to nearest sibling (prefer left, then right, then base tab).

### Non-functional Menu Items (Current Ticket)
- `New Agent`, `New Terminal`, `New Browser`:
  - menu closes
  - no new tab created

## State Model
Per panel:
- `tabs: Array<{ id: string; label: string; kind: 'base' | 'note'; closable: boolean; renamable: boolean }>`
- `activeTabId: string`
- `editingTabId: string | null`
- `editingValue: string`

Key transitions:
- `createNoteTab()`
- `beginRename(tabId)`
- `commitRename(tabId, value)`
- `cancelRename()`
- `closeTab(tabId)`

## Content Rendering Rules
- Base tab renders existing panel content (`Coordinator` or `Spec`).
- Dynamic note tab renders the note scaffold text matching the mocks.

## Error Handling and Edge Cases
- Ignore rename/close attempts on base tabs.
- Ignore actions for missing tab IDs.
- Closing a tab while editing exits edit mode cleanly.
- Opening dropdown while editing allows rename commit-on-blur behavior.

## Testing Strategy (TDD)
Unit tests (renderer):
- Dropdown opens from both panel tab strips.
- `New Note` creates and auto-activates a tab in the same panel.
- `New Agent/New Terminal/New Browser` are no-op.
- Note tab double-click enters edit mode.
- Rename save/cancel behavior (`Enter`, blur, `Esc`).
- Close behavior and active-tab fallback.
- Base tabs cannot be renamed/closed.

Visual/behavior checks:
- Verify compact dark tab strip and dropdown parity against updated screenshots.
- Confirm panel-scoped creation (center vs right).

## Out of Scope
- Functional Agent/Terminal/Browser tab creation.
- Persisted tab state.
- Arbitrary pane creation/removal engine.

## Follow-up Intent
Future tickets can extend the same shared tab system toward arbitrary tab/pane management (tmux/Ghostty-style model) without replacing KAT-89 primitives.

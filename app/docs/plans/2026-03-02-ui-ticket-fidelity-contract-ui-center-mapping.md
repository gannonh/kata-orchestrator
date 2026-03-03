# UI Ticket Fidelity Contract (Desktop App)

Date: 2026-03-02  
Project: Kata Desktop App  
Lane focus: `lane:ui-center`

## Purpose

Define a repeatable closure contract for UI tickets so "scope complete" and "quality ready" are never ambiguous.

## Contract (Required on Every UI Ticket)

### 1) Fidelity role (must be explicit)

- `Final fidelity`: this ticket is responsible for shippable UX/UI quality for its scoped surface/states.
- `Enabler`: this ticket provides plumbing/partial UX and intentionally defers final polish.

### 2) Required fields in ticket description

- `Fidelity role:` `Final fidelity` or `Enabler`
- `UI surface:` left / center / right + named states/mocks
- `Acceptance quality bar:` visual parity, interaction parity, and test evidence expectations
- `Fidelity owner ticket(s):` required if role is `Enabler`
- `MVP ship owner:` ticket that closes shippable readiness for this surface

### 3) Completion gate

- If `Final fidelity`: do not close until scoped states meet parity/usability bar with tests + screenshots.
- If `Enabler`: do not close unless all deferred quality work is linked to concrete owner tickets.

### 4) Deferment rule

Allowed deferment format in completion evidence:

- `Deferred:` <specific gap>
- `Owned by:` <ticket id>
- `Why safe now:` <non-blocking rationale>

No owner ticket = no deferment. Create follow-up before closing.

---

## Applied Mapping: Current `lane:ui-center` Backlog

### Parent

- `KAT-163` Post-Slice A — Coordinator Session Parity (Spec 02)
  - Classification: `Final fidelity` (parent/umbrella)
  - Scope: center session parity for states 04-07
  - Role: final readiness owner at epic level

### Child tickets

- `KAT-169` [02.1] Agent/context sidebar domain model + state contracts
  - Classification: `Enabler`
  - Fidelity owner(s): `KAT-170`, `KAT-171`, `KAT-172`, `KAT-174`, `KAT-163`

- `KAT-170` [02.2] Sidebar sections/nav with collapse-expand behavior
  - Classification: `Final fidelity` (for sidebar/nav behavior in scoped states)

- `KAT-171` [02.3] Conversation message primitives + coordinator status badges
  - Classification: `Enabler` (UI primitives and status foundation)
  - Fidelity owner(s): `KAT-219`, `KAT-163`

- `KAT-172` [02.4] Pasted-content badge with expand/collapse interaction
  - Classification: `Final fidelity` (for pasted-content interaction in scoped states)

- `KAT-173` [02.5] Model selector UX wired to provider model list
  - Classification: `Enabler` (integration-heavy)
  - Fidelity owner(s): `KAT-163` (plus any future model-selector parity ticket if needed)

- `KAT-174` [02.6] Input bar @context mention and quick-insert flow
  - Classification: `Final fidelity` (for mention flow in scoped states)

---

## Gap Found + Follow-up Created

Gap: center-panel markdown output fidelity/streaming readability was not explicitly owned by a dedicated `lane:ui-center` fidelity ticket.

Created:

- `KAT-219` [02.7] Coordinator chat markdown rendering parity + streaming-safe output
  - URL: https://linear.app/kata-sh/issue/KAT-219/027-coordinator-chat-markdown-rendering-parity-streaming-safe-output
  - Role: explicit fidelity owner for center markdown quality

## Working Rule Going Forward

For any UI-oriented ticket, classify it at start (`Final fidelity` vs `Enabler`) and enforce linked fidelity ownership before closure. This prevents end-of-ticket ambiguity and makes iteration decisions deterministic.

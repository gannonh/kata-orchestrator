# KAT-101 Design: Integration Verification and Quality Gate

Date: 2026-02-27
Issue: KAT-101

## Goal
Establish a reliable Slice 0 integration gate that proves the desktop app starts on Home, can create a space, persists that space across relaunch, and writes persisted state to `app-state.json` with valid space data.

## Confirmed Scope
- Run and keep green: `npm run test:ci:local` (lint, coverage, quality-gate E2E, full UAT E2E).
- Add automated E2E assertions (not manual-only checks) for:
  - Home view on startup
  - create space flow
  - quit and relaunch
  - persistence after relaunch
  - state file existence with expected space data
- Capture machine-readable evidence artifacts for successful runs.
- Fix any blocking integration issues discovered while implementing this gate.

## Approaches Considered
1. Extend existing managed provisioning E2E suite (selected)
- Reuse existing Electron fixture, Home helpers, and relaunch coverage.
- Lowest risk and least duplication while still enabling stronger assertions and artifacts.

2. Add a separate integration verifier script outside Playwright
- Single-purpose script could be explicit, but would duplicate fixture/bootstrap logic and increase maintenance surface.

3. Manual smoke verification with minimal automation
- Fastest to author, but insufficient for regression prevention and does not satisfy the required automated-evidence bar.

## Architecture
Keep `npm run test:ci:local` as the top-level quality gate. Strengthen the Playwright integration path so KAT-101 is enforced by automation, not runbook-only checks.

Use two persistence validation paths:
1. Controlled-path validation (CI-stable): launch Electron with `KATA_STATE_FILE=<tmp>/state.json` and assert file existence plus JSON space payload.
2. Default userData-path validation: launch Electron without `KATA_STATE_FILE`, resolve `app.getPath('userData')`, and assert `<userData>/app-state.json` exists and includes created space.

This dual-path strategy verifies both deterministic CI behavior and production-default persistence behavior.

## Components and Data Flow
- `tests/e2e/managed-provisioning.spec.ts` (or a dedicated integration file if separation improves readability):
  - Add/upgrade a `@quality-gate @ci` integration test for startup -> create -> relaunch -> persistence.
  - Add filesystem JSON assertions for state persistence.
- `tests/e2e/fixtures/electron.ts`:
  - Keep isolated temp paths for managed workspace/repo/state fixtures.
  - Support launching without `KATA_STATE_FILE` for default-path assertions.
- New E2E helper for evidence capture under `tests/e2e/helpers/`:
  - Persist JSON artifacts to `test-results/kat-101/` with state path and key persistence facts.

## Evidence Model
For each integration test run, record a small JSON artifact that includes:
- state file path used
- created space name/id
- pre-relaunch and post-relaunch space counts
- persisted space snapshot (`name`, `rootPath`, `branch`, `workspaceMode`)
- timestamp and test title

Playwright trace/video/screenshot on failure remain enabled via existing config. The added JSON artifact provides positive evidence for successful runs.

## Error Handling and Remediation Policy
Any defect that blocks KAT-101 assertions is in scope to fix now, including:
- startup routing regressions (Home not shown)
- create-space UI or IPC path failures
- state-store write/read mismatches
- relaunch persistence regressions

Each remediation follows mandatory TDD:
1. add/adjust failing test
2. implement minimal fix
3. rerun targeted test
4. rerun `npm run test:ci:local`

## Testing Strategy
### Required gate
- `npm run test:ci:local`

### Focused integration runs during implementation
- `npm run test:e2e:quality-gate -- --grep "persist|integration|managed provisioning"`
- `npm run test:e2e:ci -- --grep "persist|integration|managed provisioning"`

### Assertion targets
- Home heading visible on startup.
- Newly created space visible before and after relaunch.
- `window.kata.spaceList()` includes created space on both launches.
- State file exists and JSON includes persisted space record.
- Default `userData/app-state.json` persistence path is verified when env override is absent.

## Out of Scope
- Orchestrator functional slices (A/B/C) implementation work.
- PR workflow changes.
- Non-persistence UI redesign.
- Broad refactors unrelated to integration verification.

## Expected Outcome
KAT-101 becomes a reliable integration gate for Slice 0 completion: CI and local quality gate runs prove startup behavior, end-to-end space persistence, and persisted state-file correctness with concrete, machine-readable evidence artifacts.

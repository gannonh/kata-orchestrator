# KAT-169 Contract Evidence

## Verification

- Date: 2026-03-06
- Command:

```bash
npx vitest run \
  tests/unit/shared/types/space.test.ts \
  tests/unit/shared/types/run.test.ts \
  tests/unit/main/state-store.test.ts \
  tests/unit/main/orchestrator.test.ts \
  tests/unit/main/ipc-handlers.test.ts \
  tests/unit/preload/index.test.ts \
  tests/unit/renderer/features/coordinator-session/domain/selectors.test.ts \
  tests/unit/renderer/hooks/useSessionAgentRoster.test.ts \
  tests/unit/renderer/center/mockChatPresentation.test.ts
```

- Result: PASS
- Suite summary: 9 files passed, 196 tests passed

## Implemented Contract Surface

- Persisted `AppState.contextResources`
- Persisted `RunRecord.contextReferences`
- `session:create` seeds the baseline `Spec` context resource
- `session-context-resources:list` exposes sorted session resources over IPC/preload
- `createRun(...)` initializes `contextReferences` to `[]`
- `replaceRunContextReferences(...)` persists run-scoped references

## Exported Contract Surface

- `CoordinatorAgentListItem`
- `CoordinatorContextListItem`
- `CoordinatorRunContextChip`
- `CoordinatorRunContextSummary`
- `selectCoordinatorAgentList(...)`
- `selectCoordinatorContextItems(...)`
- `selectCoordinatorActiveRunContextChips(...)`
- `selectCoordinatorActiveRunContextSummary(...)`
- `selectCoordinatorPromptPreview(...)`

## Downstream Reminder

- `KAT-171` should consume these exports as read-only inputs.
- This ticket did not move renderer presentation logic into the selector layer beyond defining the pure contract surface.

# Wire activeSessionId into ChatPanel

## Context

ChatPanel receives `sessionId={null}` from AppShell. The `useIpcSessionConversation` hook early-returns on null sessionId, so every prompt is silently dropped. All the plumbing exists (session:create IPC, preload bridge, state persistence) but the renderer never creates a session when opening a space, and never passes the resulting ID to ChatPanel.

## Changes

### 1. App.tsx — create session when opening a space

**File:** `app/src/renderer/App.tsx`

- Add `activeSessionId` state (alongside existing `activeSpaceId`)
- In `handleOpenSpace(spaceId)`: call `window.kata.sessionCreate({ spaceId, label: 'Chat' })`, store the returned `session.id` in state
- Pass `activeSessionId` to `AppShell` as a new prop

### 2. AppShell.tsx — pass sessionId through to ChatPanel

**File:** `app/src/renderer/components/layout/AppShell.tsx`

- Add `activeSessionId?: string | null` to `AppShellProps`
- Replace `<ChatPanel sessionId={null} />` with `<ChatPanel sessionId={activeSessionId ?? null} />`
- Remove both TODO comments (KAT-65 and KAT-159)

### 3. window.d.ts — add sessionCreate type

**File:** `app/src/renderer/types/window.d.ts`

- Add `sessionCreate` to the `kata` interface (it's already in the preload bridge but missing from the renderer type declarations)

### 4. Tests

- **Unit test for App.tsx**: verify `sessionCreate` is called with the space ID when `handleOpenSpace` fires, and that the returned session ID reaches AppShell
- **Unit test for AppShell**: verify `activeSessionId` prop flows to ChatPanel
- **Update existing tests** that render App or AppShell to account for the new prop/async behavior

### 5. E2E sanity

- Run existing E2E quality-gate suite to confirm nothing breaks
- The KAT-159 E2E test (`kat-159-run-lifecycle.spec.ts`) already checks that ChatPanel renders — no new E2E tests needed

## Files touched

| File | Change |
|---|---|
| `app/src/renderer/App.tsx` | Add session creation on space open |
| `app/src/renderer/components/layout/AppShell.tsx` | Accept + forward activeSessionId prop |
| `app/src/renderer/types/window.d.ts` | Add sessionCreate type |
| `app/tests/unit/renderer/App.test.tsx` | New or updated test |
| `app/tests/unit/renderer/layout/AppShell.test.tsx` | Updated test |

## Verification

```bash
npm run -w app lint
npm run -w app test
KATA_E2E_HEADLESS=1 npm run -w app test:e2e:quality-gate
```

Then manually: open a space, type a message, send it. The message should dispatch to the orchestrator (visible as a pending run state or error if no API key is configured — but no longer silently dropped).

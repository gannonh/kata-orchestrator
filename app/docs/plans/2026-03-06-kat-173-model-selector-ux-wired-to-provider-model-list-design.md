# KAT-173 [02.5] Model selector UX wired to provider model list Design

**Issue:** KAT-173  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-173/025-model-selector-ux-wired-to-provider-model-list  
**Branch target:** `feature/kat-173-025-model-selector-ux-wired-to-provider-model-list`  
**Parent epic:** KAT-163 Post-Slice A - Coordinator Session Parity (Spec 02)  
**Specs:** `_plans/design/specs/02-coordinator-session.md`  
**Relevant mocks:** `04-coordinator-session-initial-state.png`, `05-coordinator-session-pasted-context.png`, `06-coordinator-session-spec-context-reading.png`, `07-coordinator-session-spec-analyzing.png`

## Scope and Outcome

Wire the center-panel model selector to the real provider model list and give the session input a deterministic, persisted active-model policy.

Required outcome:

- mount the existing renderer `ModelSelector` into the session input surface
- load the auth-aware curated model list from `model:list`
- resolve one effective selected model per session from persisted state plus live availability
- submit and retry runs with the resolved provider/model pair instead of hardcoded defaults
- persist the session's chosen model through `SessionRecord.activeModelId`
- keep fallback behavior deterministic when the persisted model is missing, unauthenticated, or model loading fails

This ticket is an **Enabler**.

It does not own final mock-polish of the selector row, settings affordance parity, or full screenshot evidence. Those remain with `KAT-176` and the Spec 02 parent umbrella `KAT-163`.

## Context Loaded

Sources reviewed for this design:

- Linear issues:
  - `KAT-173`
  - parent epic `KAT-163`
- Linear comments on `KAT-173`:
  - fidelity role = `Enabler`
  - UI surface = model selector wiring/integration in center input
  - acceptance bar = correct provider-model wiring and fallback behavior
- Linear project documents:
  - `Execution Model: UI Baseline then Parallel Functional Vertical Slices`
  - `Desktop App Linear Workflow Contract`
  - `UI Ticket Fidelity Contract (Desktop App)`
- Local specs and mock indexes:
  - `AGENTS.md`
  - `_plans/design/specs/README.md`
  - `_plans/design/specs/02-coordinator-session.md`
  - `_plans/design/mocks/README.md`
- Relevant prior local design docs:
  - `docs/plans/2026-03-01-kat-159-orchestrator-run-lifecycle-design.md`
  - `docs/plans/2026-03-05-kat-214-shared-conversation-ui-primitives-design.md`
  - `docs/plans/2026-03-06-kat-169-agentcontext-sidebar-domain-model-state-contracts-design.md`
  - `docs/plans/2026-03-06-kat-171-conversation-message-primitives-coordinator-status-design.md`
- Current implementation:
  - `src/renderer/components/center/ModelSelector.tsx`
  - `src/renderer/components/center/ChatInput.tsx`
  - `src/renderer/components/center/ChatPanel.tsx`
  - `src/renderer/hooks/useIpcSessionConversation.ts`
  - `src/preload/index.ts`
  - `src/main/ipc-handlers.ts`
  - `src/main/orchestrator.ts`
  - `src/main/agent-runner.ts`
  - `src/main/state-store.ts`
  - `src/shared/types/space.ts`
  - `src/shared/types/run.ts`

## Current State Summary

The repo already has almost all of the raw pieces this ticket needs, but they are disconnected:

- `src/renderer/components/center/ModelSelector.tsx` exists and already renders an auth-aware dropdown.
- `src/renderer/components/center/ChatInput.tsx` already exposes a `modelSlot`, so the input shell can host the selector without a layout rewrite.
- `src/main/ipc-handlers.ts` already exposes `model:list` and returns the curated `SUPPORTED_MODELS` array with `authStatus`.
- `run:submit` already accepts `{ sessionId, prompt, model, provider }`, and `RunRecord` already persists the chosen provider/model for each run.
- `SessionRecord.activeModelId` already exists in `src/shared/types/space.ts`, so session-level persistence was planned earlier.

What is still missing:

- `ChatPanel` never mounts `ModelSelector`.
- `useIpcSessionConversation` still hardcodes `openai-codex` + `gpt-5.3-codex` for both submit and retry.
- there is no renderer hook that loads and resolves the model list for the active session.
- there is no IPC path to persist a changed `activeModelId`.
- there is no explicit fallback policy for stale or unavailable selections.

## Clarifications and Assumptions

- As of **March 6, 2026**, Linear shows `KAT-173` with no blockers and classified as an `Enabler`.
- The curated model list in `src/main/ipc-handlers.ts` is the canonical ordering for fallback resolution in this ticket.
- `activeModelId` remains the persisted session preference for this ticket because the current curated `SUPPORTED_MODELS` set uses unique `modelId` values. If implementation finds duplicate `modelId` values in the shipped registry, this ticket should widen persistence before merging.
- A model with `authStatus === 'none'` is visible in the selector but should not win the "best available" fallback when an authenticated model exists.
- Final auth UX polish such as a settings icon or explicit login CTA in the footer is out of scope here; the acceptance bar is correct wiring and deterministic selection behavior.

## Approaches Considered

### Approach 1 (Recommended): Session model-selection hook + explicit `session:setActiveModel` IPC

Introduce a focused renderer hook that loads `model:list`, resolves the effective selection for the current session, and persists user changes through a dedicated session IPC update.

Pros:

- finishes the half-implemented `activeModelId` contract instead of bypassing it
- keeps selection logic deterministic and centralized
- lets submit and retry both use the same resolved model source
- preserves clean ownership boundaries: main owns persistence, renderer owns presentation and resolution

Cons:

- adds one small IPC seam
- requires a little more cross-layer wiring than a pure renderer patch

### Approach 2: Renderer-local selection state only, persisted indirectly on `run:submit`

Keep model state inside the center panel, and update `activeModelId` only when a run is submitted.

Pros:

- smallest code change
- no new IPC channel

Cons:

- selected model is lost on reload if the user changes it before submitting
- `activeModelId` stays underutilized
- retry semantics become harder to keep correct after a failed run plus selector change

### Approach 3: Expand session persistence to store a full `{ provider, modelId, name }` object

Treat model selection as a richer persisted structure and avoid lookups against the canonical model list.

Pros:

- reduces renderer lookup work
- can preserve display metadata even if the model list is temporarily unavailable

Cons:

- unnecessary schema churn for an enabler ticket
- duplicates canonical data already owned by `model:list`
- raises migration and compatibility cost before it is justified

## Recommendation

Proceed with **Approach 1**.

This is the smallest design that actually completes the intended architecture. It uses the existing selector UI, the existing `activeModelId` field, and the existing `model:list` + `run:submit` contracts, while adding only the missing session persistence seam and a deterministic resolver.

## Proposed Design

## 1) Ownership Boundary

This ticket should own:

- active-model resolution for the current session
- selector mounting in the center input
- persistence of `SessionRecord.activeModelId`
- submit/retry using the resolved selection
- deterministic fallback rules

This ticket should not own:

- redesigning the selector visuals beyond what the existing component already provides
- auth dialog or provider-login UX changes
- right-panel workflow/sidebar behavior
- final parity evidence screenshots

## 2) Canonical Model Descriptor and Resolver

Use the existing renderer-facing descriptor shape from `ModelSelector.tsx`:

```ts
type ModelInfo = {
  provider: string
  modelId: string
  name: string
  authStatus: 'oauth' | 'api_key' | 'none'
}
```

Add a pure resolver helper in the renderer:

```ts
type ResolveSelectedModelInput = {
  models: ModelInfo[]
  persistedModelId?: string
}
```

Resolution rules, in order:

1. If `persistedModelId` matches a model whose `authStatus !== 'none'`, use it.
2. Otherwise use the first authenticated model in canonical `model:list` order.
3. Otherwise use the first model in canonical `model:list` order.
4. If `model:list` fails or returns empty, fall back to the existing hardcoded default:
   - provider: `openai-codex`
   - modelId: `gpt-5.3-codex`
   - name: `GPT-5.3 Codex`

This makes the effective selection deterministic across reloads, missing credentials, and cold-start failures.

## 3) Persistence Contract

Keep `SessionRecord.activeModelId?: string` as the persisted field for this ticket.

Constraint:

- this is valid only while the curated model inventory keeps `modelId` unique across providers
- if that invariant changes during implementation, the persistence contract must be widened before ship

Add a new IPC contract:

```ts
// preload/main
sessionSetActiveModel(input: {
  sessionId: string
  activeModelId: string
}): Promise<SessionRecord>
```

Main-process rules:

- validate that the target session exists
- validate that `activeModelId` is a string
- update only `SessionRecord.activeModelId`
- return the updated session record

Renderer rules:

- persist immediately when the user selects a model from the dropdown
- after the first successful `model:list` load, if the resolver must fall back away from an invalid persisted id, persist the resolved id once so subsequent loads are stable

This preserves session continuity without introducing a broader session-update API.

## 4) Renderer Integration Shape

Add a focused hook, for example:

```ts
useSessionModelSelection(sessionId: string | null, spaceId: string | null)
```

Responsibilities:

- load the current session record
- load `model:list`
- expose:
  - `models`
  - `currentModel`
  - `isLoading`
  - `loadError`
  - `setCurrentModel(model: ModelInfo)`

Data source options:

- preferred: add a `session:get` preload/main method for direct session lookup
- acceptable minimal fallback: derive the current session from `sessionListBySpace({ spaceId })`

Recommendation:

- add `session:get` if no existing parent component already has the active `SessionRecord`
- avoid forcing `ChatPanel` to scan all sessions in a space just to resolve one field

## 5) Center-Panel Wiring

`ChatPanel` should:

- call `useSessionModelSelection(sessionId, spaceId)`
- pass a `ModelSelector` into `ChatInput.modelSlot`
- submit prompts with the hook's current resolved model

`ChatInput` should remain mostly unchanged. Its existing `modelSlot` seam is already the right integration point.

`ModelSelector` should be reused, not replaced. Any visual parity gaps remain follow-up work for fidelity/evidence tickets.

## 6) Submit and Retry Semantics

Change `useIpcSessionConversation` so submit/retry consume a model selection input instead of internal constants.

Recommended API evolution:

```ts
submitPrompt(prompt: string, model: ModelInfo): void
retry(model: ModelInfo): void
```

Alternative implementation:

- keep the public methods simple and hold the current model in a ref supplied by the selection hook

Behavioral rule:

- `submitPrompt` always uses the currently resolved model
- `retry` uses the currently resolved model at the moment the user retries, not a stale hardcoded default

This lets a user recover from a failed or unauthenticated model choice by picking a new model and hitting Retry.

## 7) Deterministic Fallback Behavior

The fallback policy should be explicit and test-backed:

- persisted valid + authenticated model -> preserve it
- persisted valid but unauthenticated model -> fall back to first authenticated model
- persisted unknown model id -> fall back to first authenticated model
- no authenticated models available -> fall back to first canonical model so the selector still shows a stable choice
- `model:list` unavailable -> fall back to the current hardcoded Codex default and disable selector interaction until the list loads again

Important product rule:

- fallback is silent but deterministic for this ticket
- final explicit auth/error affordances are deferred to fidelity follow-ups

## 8) Main/Preload Changes

Main process:

- extend `src/main/ipc-handlers.ts`
  - add `SESSION_SET_ACTIVE_MODEL_CHANNEL`
  - optionally add `SESSION_GET_CHANNEL`
  - keep `SUPPORTED_MODELS` as the canonical list source

Preload:

- expose matching bridge methods in `src/preload/index.ts`

Shared types:

- keep `SessionRecord.activeModelId` as-is
- no new shared persisted model type is required for this ticket

## 9) Testing Strategy (TDD)

Required tests:

### Unit

- resolver tests for:
  - valid persisted selection
  - persisted missing from model list
  - persisted unauthenticated
  - no authenticated models
  - empty/failed model list fallback
- `ModelSelector` integration test proving the selected resolved model is rendered through `ChatInput.modelSlot`
- `useIpcSessionConversation` tests proving submit and retry use the provided model instead of hardcoded defaults

### Main / Preload

- `ipc-handlers.test.ts`
  - `session:setActiveModel` validates input
  - persists `activeModelId`
  - optionally `session:get` returns the targeted session
- `preload/index.test.ts`
  - new bridge methods invoke the correct channels

### Integration

- `ChatPanel` tests proving:
  - selector appears when session data is available
  - changing the selector persists the session model
  - send/retry use the current resolved model
  - fallback selection is stable when the persisted id is invalid

E2E note:

- full parity screenshots remain owned by `KAT-176`
- this ticket only needs targeted behavioral proof, not the full fidelity package

## Non-Goals

- adding settings-icon behavior to the selector row
- changing the curated model inventory
- redesigning the auth/login flow
- expanding persistence to a provider+model compound session schema
- final screenshot/video evidence for Spec 02 states 04-07

## Risks and Mitigations

- Risk: the renderer duplicates canonical fallback knowledge.
  - Mitigation: keep one renderer fallback constant for the emergency-empty-list path only; all normal selection comes from `model:list`.

- Risk: `activeModelId` becomes ambiguous if two providers ever ship the same model id.
  - Mitigation: assert uniqueness against the curated list in tests for this ticket, and widen persistence if the invariant no longer holds.

- Risk: silently falling off an unauthenticated persisted model may surprise users.
  - Mitigation: keep the behavior deterministic now and defer explicit UX copy/status affordances to final fidelity work.

- Risk: adding a larger session update API broadens surface area unnecessarily.
  - Mitigation: use a narrowly scoped `session:setActiveModel` channel.

## Approval Gate

If this design is approved, the next step is an implementation plan with a test-first sequence for:

1. session model persistence IPC
2. renderer selection resolver hook
3. `ChatPanel` and `useIpcSessionConversation` wiring
4. regression coverage for fallback behavior

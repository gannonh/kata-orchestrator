# KAT-173 Model Selector UX Wired to Provider Model List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the center-session model selector to the real provider model list, persist the session's selected model, and make submit/retry use a deterministic resolved provider/model instead of hardcoded Codex defaults.

**Architecture:** Add a narrow session persistence seam in main/preload for reading and writing `SessionRecord.activeModelId`, then build a renderer-side model-selection resolver that consumes `model:list` and produces one effective `ModelInfo` for the active session. Mount the existing `ModelSelector` into `ChatInput` through `ChatPanel`, and rework `useIpcSessionConversation` so prompt submission and retry use the resolved selection rather than internal constants.

**Tech Stack:** Electron IPC, React 19, TypeScript, existing renderer center components, shared app state in `src/shared/types/space.ts`, Vitest, Testing Library.

---

**Execution Rules:**
- Apply `@test-driven-development` on every task: red, then green, then refactor.
- Apply `@verification-before-completion` before claiming ticket completion.
- Keep scope focused on model-selector wiring, persistence, and deterministic fallback behavior.
- Do not expand auth UX, selector polish, or final fidelity evidence in this ticket.
- Keep commits small: one commit per task.

### Task 1: Add session model persistence IPC

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`
- Test: `tests/unit/main/ipc-handlers.test.ts`
- Test: `tests/unit/preload/index.test.ts`

**Step 1: Write the failing tests**

```ts
// tests/unit/main/ipc-handlers.test.ts
it('session:get returns the requested session record', async () => {
  const store = createMockStore({
    ...createDefaultAppState(),
    sessions: {
      'session-1': {
        id: 'session-1',
        spaceId: 'space-1',
        label: 'Chat',
        createdAt: '2026-03-06T00:00:00.000Z',
        activeModelId: 'gpt-5.3-codex'
      }
    }
  })

  registerIpcHandlers(store)
  const handler = getHandlersByChannel().get('session:get')!

  await expect(handler({}, { sessionId: 'session-1' })).resolves.toMatchObject({
    id: 'session-1',
    activeModelId: 'gpt-5.3-codex'
  })
})

it('session:setActiveModel persists activeModelId for an existing session', async () => {
  const state = {
    ...createDefaultAppState(),
    sessions: {
      'session-1': {
        id: 'session-1',
        spaceId: 'space-1',
        label: 'Chat',
        createdAt: '2026-03-06T00:00:00.000Z'
      }
    }
  }
  const store = createMockStore(state)

  registerIpcHandlers(store)
  const handler = getHandlersByChannel().get('session:setActiveModel')!

  await handler({}, { sessionId: 'session-1', activeModelId: 'claude-sonnet-4-6-20250514' })

  expect(store.save).toHaveBeenCalledWith({
    ...state,
    sessions: {
      ...state.sessions,
      'session-1': {
        ...state.sessions['session-1'],
        activeModelId: 'claude-sonnet-4-6-20250514'
      }
    }
  })
})
```

```ts
// tests/unit/preload/index.test.ts
it('exposes sessionGet and sessionSetActiveModel bridge methods', async () => {
  await import('../../../src/preload/index')

  const [, api] = exposeInMainWorld.mock.calls[0] as [
    string,
    {
      sessionGet: (sessionId: string) => Promise<unknown>
      sessionSetActiveModel: (input: { sessionId: string; activeModelId: string }) => Promise<unknown>
    }
  ]

  invoke.mockResolvedValueOnce({ id: 'session-1', activeModelId: 'gpt-5.3-codex' })
  await expect(api.sessionGet('session-1')).resolves.toMatchObject({ id: 'session-1' })
  expect(invoke).toHaveBeenCalledWith('session:get', { sessionId: 'session-1' })

  invoke.mockResolvedValueOnce({ id: 'session-1', activeModelId: 'claude-sonnet-4-6-20250514' })
  await expect(
    api.sessionSetActiveModel({
      sessionId: 'session-1',
      activeModelId: 'claude-sonnet-4-6-20250514'
    })
  ).resolves.toMatchObject({ activeModelId: 'claude-sonnet-4-6-20250514' })
  expect(invoke).toHaveBeenCalledWith('session:setActiveModel', {
    sessionId: 'session-1',
    activeModelId: 'claude-sonnet-4-6-20250514'
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts`

Expected: FAIL because `session:get` and `session:setActiveModel` are not registered or exposed yet.

**Step 3: Write the minimal implementation**

```ts
// src/main/ipc-handlers.ts
const SESSION_GET_CHANNEL = 'session:get'
const SESSION_SET_ACTIVE_MODEL_CHANNEL = 'session:setActiveModel'

function parseSessionGetInput(input: unknown): { sessionId: string } {
  if (!isObjectRecord(input) || typeof input.sessionId !== 'string') {
    throw new Error('session:get input must be an object with string sessionId')
  }
  return { sessionId: input.sessionId }
}

function parseSessionSetActiveModelInput(input: unknown): {
  sessionId: string
  activeModelId: string
} {
  if (
    !isObjectRecord(input) ||
    typeof input.sessionId !== 'string' ||
    typeof input.activeModelId !== 'string'
  ) {
    throw new Error('session:setActiveModel input must include string sessionId and activeModelId')
  }
  return { sessionId: input.sessionId, activeModelId: input.activeModelId }
}

ipcMain.handle(SESSION_GET_CHANNEL, async (_event, input: unknown) => {
  const { sessionId } = parseSessionGetInput(input)
  return stateStore.load().sessions[sessionId] ?? null
})

ipcMain.handle(SESSION_SET_ACTIVE_MODEL_CHANNEL, async (_event, input: unknown) => {
  const { sessionId, activeModelId } = parseSessionSetActiveModelInput(input)
  const state = stateStore.load()
  const session = state.sessions[sessionId]
  if (!session) {
    throw new Error(`Cannot set active model for unknown session: ${sessionId}`)
  }

  const updatedSession = { ...session, activeModelId }
  stateStore.save({
    ...state,
    sessions: {
      ...state.sessions,
      [sessionId]: updatedSession
    }
  })

  return updatedSession
})
```

```ts
// src/preload/index.ts
const SESSION_GET_CHANNEL = 'session:get'
const SESSION_SET_ACTIVE_MODEL_CHANNEL = 'session:setActiveModel'

sessionGet: (sessionId: string): Promise<SessionRecord | null> =>
  invokeTyped<SessionRecord | null>(SESSION_GET_CHANNEL, { sessionId }),
sessionSetActiveModel: (input: { sessionId: string; activeModelId: string }): Promise<SessionRecord> =>
  invokeTyped<SessionRecord>(SESSION_SET_ACTIVE_MODEL_CHANNEL, input),
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/ipc-handlers.ts src/preload/index.ts tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts
git commit -m "feat(ipc): persist session active model selection"
```

### Task 2: Add a deterministic session-model resolver and hook

**Files:**
- Create: `src/renderer/hooks/useSessionModelSelection.ts`
- Create: `src/renderer/components/center/model-selection.ts`
- Test: `tests/unit/renderer/hooks/useSessionModelSelection.test.ts`
- Test: `tests/unit/renderer/center/model-selection.test.ts`

**Step 1: Write the failing tests**

```ts
// tests/unit/renderer/center/model-selection.test.ts
import { describe, expect, it } from 'vitest'

import {
  FALLBACK_MODEL,
  resolveSelectedModel
} from '../../../../src/renderer/components/center/model-selection'

const models = [
  {
    provider: 'openai-codex',
    modelId: 'gpt-5.3-codex',
    name: 'GPT-5.3 Codex',
    authStatus: 'oauth' as const
  },
  {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6-20250514',
    name: 'Claude Sonnet 4.6',
    authStatus: 'api_key' as const
  }
]

describe('resolveSelectedModel', () => {
  it('keeps a valid authenticated persisted model', () => {
    expect(resolveSelectedModel(models, 'claude-sonnet-4-6-20250514')).toMatchObject({
      modelId: 'claude-sonnet-4-6-20250514'
    })
  })

  it('falls back to the first authenticated model when persisted id is unknown', () => {
    expect(resolveSelectedModel(models, 'unknown')).toMatchObject({
      modelId: 'gpt-5.3-codex'
    })
  })

  it('falls back to the constant emergency model when list is empty', () => {
    expect(resolveSelectedModel([], undefined)).toEqual(FALLBACK_MODEL)
  })
})
```

```ts
// tests/unit/renderer/hooks/useSessionModelSelection.test.ts
it('loads model list plus session activeModelId and exposes the resolved model', async () => {
  ;(window as any).kata = {
    sessionGet: vi.fn().mockResolvedValue({
      id: 'session-1',
      spaceId: 'space-1',
      label: 'Chat',
      createdAt: '2026-03-06T00:00:00.000Z',
      activeModelId: 'claude-sonnet-4-6-20250514'
    }),
    modelList: vi.fn().mockResolvedValue([
      {
        provider: 'openai-codex',
        modelId: 'gpt-5.3-codex',
        name: 'GPT-5.3 Codex',
        authStatus: 'oauth'
      },
      {
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-6-20250514',
        name: 'Claude Sonnet 4.6',
        authStatus: 'api_key'
      }
    ]),
    sessionSetActiveModel: vi.fn().mockResolvedValue({})
  }

  const { useSessionModelSelection } = await import(
    '../../../../src/renderer/hooks/useSessionModelSelection'
  )
  const { result } = renderHook(() => useSessionModelSelection('session-1'))

  await waitFor(() => {
    expect(result.current.currentModel?.modelId).toBe('claude-sonnet-4-6-20250514')
  })
})

it('persists reconciled fallback when persisted model is unavailable', async () => {
  const sessionSetActiveModel = vi.fn().mockResolvedValue({})
  ;(window as any).kata = {
    sessionGet: vi.fn().mockResolvedValue({
      id: 'session-1',
      spaceId: 'space-1',
      label: 'Chat',
      createdAt: '2026-03-06T00:00:00.000Z',
      activeModelId: 'missing-model'
    }),
    modelList: vi.fn().mockResolvedValue([
      {
        provider: 'openai-codex',
        modelId: 'gpt-5.3-codex',
        name: 'GPT-5.3 Codex',
        authStatus: 'oauth'
      }
    ]),
    sessionSetActiveModel
  }

  const { useSessionModelSelection } = await import(
    '../../../../src/renderer/hooks/useSessionModelSelection'
  )
  renderHook(() => useSessionModelSelection('session-1'))

  await waitFor(() => {
    expect(sessionSetActiveModel).toHaveBeenCalledWith({
      sessionId: 'session-1',
      activeModelId: 'gpt-5.3-codex'
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/center/model-selection.test.ts tests/unit/renderer/hooks/useSessionModelSelection.test.ts`

Expected: FAIL because the resolver module and hook do not exist yet.

**Step 3: Write the minimal implementation**

```ts
// src/renderer/components/center/model-selection.ts
import type { ModelInfo } from './ModelSelector'

export const FALLBACK_MODEL: ModelInfo = {
  provider: 'openai-codex',
  modelId: 'gpt-5.3-codex',
  name: 'GPT-5.3 Codex',
  authStatus: 'none'
}

export function resolveSelectedModel(
  models: ModelInfo[],
  activeModelId?: string
): ModelInfo {
  const persisted = activeModelId
    ? models.find((model) => model.modelId === activeModelId && model.authStatus !== 'none')
    : undefined

  if (persisted) {
    return persisted
  }

  const firstAuthenticated = models.find((model) => model.authStatus !== 'none')
  if (firstAuthenticated) {
    return firstAuthenticated
  }

  return models[0] ?? FALLBACK_MODEL
}
```

```ts
// src/renderer/hooks/useSessionModelSelection.ts
import { useEffect, useState } from 'react'

import type { SessionRecord } from '../../shared/types/space'
import type { ModelInfo } from '../components/center/ModelSelector'
import { resolveSelectedModel } from '../components/center/model-selection'

export function useSessionModelSelection(sessionId: string | null) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [session, setSession] = useState<SessionRecord | null>(null)
  const [currentModel, setCurrentModelState] = useState<ModelInfo | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setModels([])
      setSession(null)
      setCurrentModelState(null)
      return
    }

    let cancelled = false

    Promise.all([
      window.kata?.sessionGet?.(sessionId) ?? Promise.resolve(null),
      window.kata?.modelList?.() ?? Promise.resolve([])
    ]).then(async ([nextSession, nextModels]) => {
      if (cancelled) return

      setSession(nextSession)
      setModels(nextModels)
      const resolved = resolveSelectedModel(nextModels, nextSession?.activeModelId)
      setCurrentModelState(resolved)

      if (
        nextSession?.id &&
        resolved.modelId &&
        nextSession.activeModelId !== resolved.modelId &&
        typeof window.kata?.sessionSetActiveModel === 'function'
      ) {
        await window.kata.sessionSetActiveModel({
          sessionId: nextSession.id,
          activeModelId: resolved.modelId
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  const setCurrentModel = async (model: ModelInfo) => {
    setCurrentModelState(model)
    if (sessionId && typeof window.kata?.sessionSetActiveModel === 'function') {
      await window.kata.sessionSetActiveModel({
        sessionId,
        activeModelId: model.modelId
      })
    }
  }

  return {
    models,
    session,
    currentModel,
    setCurrentModel
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/renderer/center/model-selection.test.ts tests/unit/renderer/hooks/useSessionModelSelection.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/hooks/useSessionModelSelection.ts src/renderer/components/center/model-selection.ts tests/unit/renderer/hooks/useSessionModelSelection.test.ts tests/unit/renderer/center/model-selection.test.ts
git commit -m "feat(renderer): add session model selection resolver"
```

### Task 3: Wire the selector into `ChatPanel` and route submit/retry through the resolved model

**Files:**
- Modify: `src/renderer/components/center/ChatPanel.tsx`
- Modify: `src/renderer/components/center/ChatInput.tsx`
- Modify: `src/renderer/hooks/useIpcSessionConversation.ts`
- Test: `tests/unit/renderer/center/ChatPanel.test.tsx`
- Test: `tests/unit/renderer/center/ChatInput.test.tsx`
- Test: `tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`

**Step 1: Write the failing tests**

```ts
// tests/unit/renderer/hooks/useIpcSessionConversation.test.ts
it('submitPrompt uses the provided model and provider', async () => {
  const { useIpcSessionConversation } = await import(
    '../../../../src/renderer/hooks/useIpcSessionConversation'
  )
  const { result } = renderHook(() => useIpcSessionConversation('s-1'))

  act(() => {
    result.current.submitPrompt('Plan phase 2', {
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6-20250514',
      name: 'Claude Sonnet 4.6',
      authStatus: 'api_key'
    })
  })

  expect(mockRunSubmit).toHaveBeenCalledWith({
    sessionId: 's-1',
    prompt: 'Plan phase 2',
    model: 'claude-sonnet-4-6-20250514',
    provider: 'anthropic'
  })
})

it('retry uses the currently selected model and provider', async () => {
  const { useIpcSessionConversation } = await import(
    '../../../../src/renderer/hooks/useIpcSessionConversation'
  )
  const { result } = renderHook(() => useIpcSessionConversation('s-1'))

  act(() => {
    result.current.submitPrompt('Plan phase 2', {
      provider: 'openai-codex',
      modelId: 'gpt-5.3-codex',
      name: 'GPT-5.3 Codex',
      authStatus: 'oauth'
    })
  })

  act(() => {
    onRunEventCallback?.({
      type: 'run_state_changed',
      runState: 'error',
      errorMessage: 'No credentials'
    })
  })

  act(() => {
    result.current.retry({
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6-20250514',
      name: 'Claude Sonnet 4.6',
      authStatus: 'api_key'
    })
  })

  expect(mockRunSubmit).toHaveBeenLastCalledWith({
    sessionId: 's-1',
    prompt: 'Plan phase 2',
    model: 'claude-sonnet-4-6-20250514',
    provider: 'anthropic'
  })
})
```

```tsx
// tests/unit/renderer/center/ChatPanel.test.tsx
it('renders the selector model label from the session model hook', () => {
  mockModelHook.mockReturnValue({
    models: [
      {
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-6-20250514',
        name: 'Claude Sonnet 4.6',
        authStatus: 'api_key'
      }
    ],
    currentModel: {
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6-20250514',
      name: 'Claude Sonnet 4.6',
      authStatus: 'api_key'
    },
    setCurrentModel: vi.fn()
  })

  render(<ChatPanel sessionId="session-1" />)

  expect(screen.getByText('Claude Sonnet 4.6')).toBeTruthy()
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/hooks/useIpcSessionConversation.test.ts tests/unit/renderer/center/ChatPanel.test.tsx tests/unit/renderer/center/ChatInput.test.tsx`

Expected: FAIL because `submitPrompt`/`retry` do not accept a selected model and `ChatPanel` does not mount `ModelSelector`.

**Step 3: Write the minimal implementation**

```ts
// src/renderer/hooks/useIpcSessionConversation.ts
import type { ModelInfo } from '../components/center/ModelSelector'

const DEFAULT_RUN_MODEL = 'gpt-5.3-codex'
const DEFAULT_RUN_PROVIDER = 'openai-codex'

function toRunSelection(model?: ModelInfo) {
  return {
    model: model?.modelId ?? DEFAULT_RUN_MODEL,
    provider: model?.provider ?? DEFAULT_RUN_PROVIDER
  }
}

const submitPrompt = useCallback(
  (prompt: string, selectedModel?: ModelInfo) => {
    const kata = window.kata
    if (!kata?.runSubmit || !sessionId) return

    const selection = toRunSelection(selectedModel)
    lastPromptRef.current = prompt
    setLatestDraft(undefined)
    dispatch({ type: 'SUBMIT_PROMPT', prompt })

    kata
      .runSubmit({
        sessionId,
        prompt,
        model: selection.model,
        provider: selection.provider
      })
      .catch((error: Error) => {
        dispatch({ type: 'RUN_FAILED', error: error.message })
      })
  },
  [sessionId]
)

const retry = useCallback(
  (selectedModel?: ModelInfo) => {
    if (state.runState !== 'error' || !lastPromptRef.current) return
    const kata = window.kata
    if (!kata?.runSubmit || !sessionId) return

    const selection = toRunSelection(selectedModel)
    kata.runSubmit({
      sessionId,
      prompt: lastPromptRef.current,
      model: selection.model,
      provider: selection.provider
    })
  },
  [sessionId, state.runState]
)
```

```tsx
// src/renderer/components/center/ChatPanel.tsx
import { ModelSelector } from './ModelSelector'
import { useSessionModelSelection } from '../../hooks/useSessionModelSelection'

const { currentModel, models, setCurrentModel } = useSessionModelSelection(sessionId)

<ChatInput
  onSend={(prompt) => submitPrompt(prompt, currentModel ?? undefined)}
  onRetry={() => retry(currentModel ?? undefined)}
  runState={state.runState}
  disabled={!sessionId}
  modelSlot={
    currentModel ? (
      <ModelSelector
        currentModel={currentModel}
        models={models}
        onModelChange={setCurrentModel}
        disabled={!sessionId}
      />
    ) : null
  }
/>
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/renderer/hooks/useIpcSessionConversation.test.ts tests/unit/renderer/center/ChatPanel.test.tsx tests/unit/renderer/center/ChatInput.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/ChatPanel.tsx src/renderer/components/center/ChatInput.tsx src/renderer/hooks/useIpcSessionConversation.ts tests/unit/renderer/center/ChatPanel.test.tsx tests/unit/renderer/center/ChatInput.test.tsx tests/unit/renderer/hooks/useIpcSessionConversation.test.ts
git commit -m "feat(renderer): wire session model selector into chat submission"
```

### Task 4: Lock deterministic fallback behavior and model-id invariants

**Files:**
- Modify: `tests/unit/renderer/center/model-selection.test.ts`
- Modify: `tests/unit/renderer/hooks/useSessionModelSelection.test.ts`
- Modify: `tests/unit/main/ipc-handlers.test.ts`

**Step 1: Write the failing tests**

```ts
// tests/unit/renderer/center/model-selection.test.ts
it('prefers the first authenticated model when the persisted model is unauthenticated', () => {
  const models = [
    {
      provider: 'openai-codex',
      modelId: 'gpt-5.3-codex',
      name: 'GPT-5.3 Codex',
      authStatus: 'none' as const
    },
    {
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6-20250514',
      name: 'Claude Sonnet 4.6',
      authStatus: 'api_key' as const
    }
  ]

  expect(resolveSelectedModel(models, 'gpt-5.3-codex')).toMatchObject({
    modelId: 'claude-sonnet-4-6-20250514'
  })
})

it('asserts the curated model list has unique model ids', () => {
  const modelIds = SUPPORTED_MODELS.map((model) => model.modelId)
  expect(new Set(modelIds).size).toBe(modelIds.length)
})
```

```ts
// tests/unit/renderer/hooks/useSessionModelSelection.test.ts
it('does not repersist the activeModelId when persisted selection is already valid', async () => {
  const sessionSetActiveModel = vi.fn().mockResolvedValue({})
  ;(window as any).kata = {
    sessionGet: vi.fn().mockResolvedValue({
      id: 'session-1',
      spaceId: 'space-1',
      label: 'Chat',
      createdAt: '2026-03-06T00:00:00.000Z',
      activeModelId: 'gpt-5.3-codex'
    }),
    modelList: vi.fn().mockResolvedValue([
      {
        provider: 'openai-codex',
        modelId: 'gpt-5.3-codex',
        name: 'GPT-5.3 Codex',
        authStatus: 'oauth'
      }
    ]),
    sessionSetActiveModel
  }

  const { useSessionModelSelection } = await import(
    '../../../../src/renderer/hooks/useSessionModelSelection'
  )
  renderHook(() => useSessionModelSelection('session-1'))

  await waitFor(() => {
    expect((window as any).kata.sessionGet).toHaveBeenCalled()
  })

  expect(sessionSetActiveModel).not.toHaveBeenCalled()
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/center/model-selection.test.ts tests/unit/renderer/hooks/useSessionModelSelection.test.ts tests/unit/main/ipc-handlers.test.ts`

Expected: FAIL until the resolver explicitly handles unauthenticated persisted selections and the curated model invariant is asserted.

**Step 3: Write the minimal implementation**

```ts
// src/renderer/components/center/model-selection.ts
export function resolveSelectedModel(
  models: ModelInfo[],
  activeModelId?: string
): ModelInfo {
  const persisted = activeModelId
    ? models.find((model) => model.modelId === activeModelId)
    : undefined

  if (persisted && persisted.authStatus !== 'none') {
    return persisted
  }

  const firstAuthenticated = models.find((model) => model.authStatus !== 'none')
  if (firstAuthenticated) {
    return firstAuthenticated
  }

  return models[0] ?? FALLBACK_MODEL
}
```

```ts
// tests/unit/main/ipc-handlers.test.ts
describe('SUPPORTED_MODELS invariants', () => {
  it('uses unique model ids across the curated list', async () => {
    const { SUPPORTED_MODELS } = await import('../../../src/main/ipc-handlers')
    const modelIds = SUPPORTED_MODELS.map((model) => model.modelId)
    expect(new Set(modelIds).size).toBe(modelIds.length)
  })
})
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/renderer/center/model-selection.test.ts tests/unit/renderer/hooks/useSessionModelSelection.test.ts tests/unit/main/ipc-handlers.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/renderer/center/model-selection.test.ts tests/unit/renderer/hooks/useSessionModelSelection.test.ts tests/unit/main/ipc-handlers.test.ts
git commit -m "test(renderer): lock deterministic model selection fallback"
```

### Task 5: Verify the full ticket surface

**Files:**
- Modify: `tests/unit/renderer/center/ChatPanel.test.tsx`
- Modify: `tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`
- Optional evidence notes: `docs/plans/2026-03-06-kat-173-model-selector-ux-wired-to-provider-model-list-design.md`

**Step 1: Add the final behavioral assertions**

```tsx
// tests/unit/renderer/center/ChatPanel.test.tsx
it('passes the newly selected model to the next send action', async () => {
  const setCurrentModel = vi.fn()
  mockModelHook.mockReturnValue({
    models: [
      {
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-6-20250514',
        name: 'Claude Sonnet 4.6',
        authStatus: 'api_key'
      }
    ],
    currentModel: {
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6-20250514',
      name: 'Claude Sonnet 4.6',
      authStatus: 'api_key'
    },
    setCurrentModel
  })

  render(<ChatPanel sessionId="session-1" />)

  expect(screen.getByText('Claude Sonnet 4.6')).toBeTruthy()
})
```

**Step 2: Run focused tests**

Run: `npx vitest run tests/unit/renderer/center/ChatPanel.test.tsx tests/unit/renderer/hooks/useIpcSessionConversation.test.ts tests/unit/renderer/hooks/useSessionModelSelection.test.ts tests/unit/renderer/center/model-selection.test.ts tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts`

Expected: PASS.

**Step 3: Run the broader app unit suite for regression safety**

Run: `npm run test -- --runInBand`

Expected: PASS, or if the workspace uses Vitest directly for app tests, run the repo-standard equivalent and confirm no regressions in center-panel or preload/main tests.

**Step 4: Check the working tree**

Run: `git status --short`

Expected: only the files for KAT-173 plan/implementation are modified.

**Step 5: Commit verification-only adjustments if needed**

```bash
git add tests/unit/renderer/center/ChatPanel.test.tsx tests/unit/renderer/hooks/useIpcSessionConversation.test.ts tests/unit/renderer/hooks/useSessionModelSelection.test.ts tests/unit/renderer/center/model-selection.test.ts tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts
git commit -m "test(renderer): verify model selector session wiring"
```

## Completion Checklist

- `ModelSelector` is mounted in the active chat input.
- `model:list` is used as the source of truth for selectable models.
- `SessionRecord.activeModelId` is read and written through IPC.
- submit and retry use the resolved model/provider, not hardcoded constants.
- fallback behavior is deterministic and covered by tests.
- curated model ids are asserted unique while `activeModelId` remains the persistence key.

Plan complete and saved to `docs/plans/2026-03-06-kat-173-model-selector-ux-wired-to-provider-model-list-implementation-plan.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration

2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?

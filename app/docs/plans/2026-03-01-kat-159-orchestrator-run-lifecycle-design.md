# KAT-159: Real Orchestrator Run Lifecycle Wiring — Design

**Issue:** [KAT-159](https://linear.app/kata-sh/issue/KAT-159)
**Spec anchor:** `app/_plans/design/specs/04-build-session.md`
**Branch:** `feature/kat-159-a2-real-orchestrator-run-lifecycle-wiring-context-provider`
**Approach:** Main-process agent with IPC event bridge

## Decision Record

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent runtime location | Main process | Electron security model — renderer is untrusted. Agent needs Node.js for HTTP, file I/O, env vars. |
| LLM library | `@mariozechner/pi-ai` | Unified multi-provider API. Supports Anthropic + OpenAI with streaming, model registry, OAuth. |
| Agent framework | `@mariozechner/pi-agent-core` | Agent runtime with `getApiKey` callback for dynamic credential resolution. Event-based architecture maps to existing `SessionRuntimeEvent`. |
| Auth — this slice | OAuth (Claude + OpenAI) + env var fallback | Pi-ai provides PKCE OAuth flows for both providers. `CredentialResolver` abstracts the priority chain. |
| Context injection | System prompt only | System prompt includes instructions for the agent to gather further context. No pre-injected workspace files. |
| Model selection | Curated subset, per-session state | Four models (2 Anthropic, 2 OpenAI). Full registry deferred. |

## Data Model

### New types: `app/src/shared/types/run.ts`

```typescript
export const RUN_STATUSES = ['queued', 'running', 'completed', 'failed'] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

export type PersistedMessage = {
  id: string
  role: 'user' | 'agent'
  content: string
  createdAt: string
}

export type RunRecord = {
  id: string
  sessionId: string
  prompt: string
  status: RunStatus
  model: string           // e.g. "claude-sonnet-4-6-20250514"
  provider: string        // e.g. "anthropic"
  createdAt: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  messages: PersistedMessage[]
}
```

### AppState extension

```typescript
export type AppState = {
  spaces: Record<string, SpaceRecord>
  sessions: Record<string, SessionRecord>
  runs: Record<string, RunRecord>           // NEW
  activeSpaceId: string | null
  activeSessionId: string | null
}
```

### SessionRecord extension

```typescript
export type SessionRecord = {
  id: string
  spaceId: string
  label: string
  createdAt: string
  activeModelId?: string  // NEW — persisted model selection
}
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Renderer                                        │
│  ┌──────────────┐    ┌───────────────────────┐  │
│  │ ChatInput     │───▶│ IpcSessionRuntime     │  │
│  │ ModelSelector │    │ Adapter               │  │
│  │ AuthDialog    │    │ (subscribe/submit/    │  │
│  │               │    │  retry via IPC)       │  │
│  └──────────────┘    └──────────┬────────────┘  │
│                                  │               │
├──────────────────────────────────┼───────────────┤
│  Preload                         │               │
│  kata.run.submit()               │               │
│  kata.run.onEvent()              │               │
│  kata.auth.status/login/logout   │               │
│  kata.model.list                 │               │
├──────────────────────────────────┼───────────────┤
│  Main                            ▼               │
│  ┌──────────────────────────────────────────┐   │
│  │  Orchestrator Service                     │   │
│  │  ┌────────────┐   ┌──────────────────┐   │   │
│  │  │ Agent      │   │CredentialResolver│   │   │
│  │  │(pi-agent)  │   │ OAuth > env >    │   │   │
│  │  │            │   │ none             │   │   │
│  │  └─────┬──────┘   └────────┬─────────┘   │   │
│  │        │                    │              │   │
│  │        ▼                    ▼              │   │
│  │  ┌──────────────────────────────────┐    │   │
│  │  │ pi-ai (stream to Anthropic/OpenAI)│    │   │
│  │  └──────────────────────────────────┘    │   │
│  │                                           │   │
│  │  ┌──────────────────────────────────┐    │   │
│  │  │ AuthStorage (~/.kata/auth.json)   │    │   │
│  │  │ StateStore (RunRecord persistence)│    │   │
│  │  └──────────────────────────────────┘    │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `run:submit` | renderer → main | Submit prompt with `{ sessionId, prompt, model, provider }` |
| `run:event` | main → renderer | Stream `SessionRuntimeEvent` (run_state_changed, message_appended) |
| `run:abort` | renderer → main | Cancel active run via `agent.abort()` |
| `run:list` | renderer → main | Fetch persisted `RunRecord[]` for a session (refresh replay) |
| `auth:status` | renderer → main | Get auth state per provider: `'oauth' \| 'api_key' \| 'none'` |
| `auth:login` | renderer → main | Trigger OAuth PKCE flow for provider |
| `auth:logout` | renderer → main | Clear stored credentials for provider |
| `auth:callback` | renderer → main | Forward Anthropic `code#state` paste from dialog |
| `model:list` | renderer → main | Fetch curated model list with auth availability |

## Main Process: Orchestrator Service

**`app/src/main/orchestrator.ts`**

`submitRun(sessionId, prompt, modelConfig)`:
1. Create `RunRecord` with status `queued`, persist to StateStore
2. Send `run_state_changed: queued` event to renderer
3. Resolve credentials via `CredentialResolver.getApiKey(provider)`
4. If no credentials, transition to `failed` with `"No credentials configured for {provider}"`
5. Instantiate pi-agent `Agent` with system prompt, model, and resolved API key
6. Transition to `running`, persist, send event
7. Call `agent.run()` — listen to `agent.listen()` events:
   - `message_update` with `text_delta` → append to partial message, send `message_appended` to renderer
   - `agent_end` → transition to `completed`, persist final messages, send event
   - `error` → transition to `failed`, persist error, send event
8. On abort: `agent.abort()` → transition to `failed` with `"Run aborted"`

## Credential Resolution

**`app/src/main/credential-resolver.ts`**

```typescript
export type CredentialResolver = {
  getApiKey(provider: string): Promise<string | undefined>
  login(provider: string): Promise<void>
  logout(provider: string): Promise<void>
  getAuthStatus(provider: string): Promise<'oauth' | 'api_key' | 'none'>
}
```

Priority chain:
1. OAuth token from `AuthStorage` (auto-refreshed if expired)
2. Env var (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)
3. `undefined` (no credentials)

**`app/src/main/auth-storage.ts`**

JSON file at `~/.kata/auth.json` with `proper-lockfile`. Credential shape:

```typescript
type AuthCredential =
  | { type: 'api_key'; key: string }
  | { type: 'oauth'; refresh: string; access: string; expires: number }
```

OAuth flows use pi-ai's built-in PKCE implementations:
- Anthropic: `claude.ai/oauth/authorize` — manual `code#state` paste
- OpenAI: `auth.openai.com/oauth/authorize` — local callback server on port 1455

## Renderer Wiring

### IPC Session Runtime Adapter

Implements `SessionRuntimeAdapter` contract from KAT-158:

- `subscribe` → `ipcRenderer.on('run:event', handler)`, returns cleanup
- `submitPrompt` → `ipcRenderer.invoke('run:submit', { sessionId, prompt, model })`
- `retry` → re-submits last failed prompt

### Hook: `useIpcSessionConversation`

Replaces `useSessionConversation` (mock). Creates the IPC adapter, feeds events into the existing `sessionConversationReducer`. On mount, fetches persisted runs via `run:list` and replays messages to restore conversation state.

### Component changes

- `MockChatPanel` → `ChatPanel` — uses `useIpcSessionConversation` instead of mock hook
- `ChatInput` — model selector badge becomes `ModelSelector` dropdown
- New `AuthDialog` — OAuth login flow with provider selection
- `AppShell` — swaps `MockChatPanel` for `ChatPanel`

## Model Selection

Curated subset for this slice:

```typescript
const SUPPORTED_MODELS = [
  { provider: 'anthropic', modelId: 'claude-sonnet-4-6-20250514' },
  { provider: 'anthropic', modelId: 'claude-opus-4-6-20250514' },
  { provider: 'openai', modelId: 'gpt-4.1-2025-04-14' },
  { provider: 'openai', modelId: 'o3-2025-04-16' },
]
```

Model list exposed via `model:list` IPC. Each entry annotated with auth availability from `CredentialResolver.getAuthStatus()`. Models without credentials are visible but disabled.

Selected model stored as `activeModelId` on `SessionRecord`.

## Auth UI

Inline in ChatInput footer:
- Provider status indicator next to model selector
- "Log in" link when no credentials for selected provider
- Click opens `AuthDialog` with Claude/OpenAI options
- Anthropic: dialog shows text input for `code#state` paste
- OpenAI: dialog shows spinner during callback server flow, then "Connected"
- Logout via context menu on the status indicator

## Testing Strategy

### Unit tests (TDD)

| Test file | Coverage |
|-----------|----------|
| `run-record.test.ts` | AppState `runs` CRUD, message appending, status validation |
| `orchestrator.test.ts` | Run lifecycle transitions, event forwarding, error propagation, abort. Mock pi-agent `Agent` |
| `credential-resolver.test.ts` | Priority: OAuth > env > none. Token refresh delegation |
| `auth-storage.test.ts` | JSON read/write, credential shape validation, lockfile behavior |
| `ipc-handlers.test.ts` | Extend — `run:*`, `auth:*`, `model:*` channels |
| `sessionConversationState.test.ts` | Extend — run replay from persisted messages |

### Integration tests

| Test file | Coverage |
|-----------|----------|
| `sessionRuntimeAdapter.contract.test.ts` | Extend — IPC adapter satisfies contract |
| `orchestrator-integration.test.ts` | Full flow: submit → mock LLM → events → reducer → persisted |

### E2E tests

| Test file | Coverage |
|-----------|----------|
| `kat-159-run-lifecycle.spec.ts` | Submit prompt → Thinking → response → Stopped. Refresh replay. Error → retry. |

Test doubles: Fake `Agent` emitting canned events. E2E can use a local echo server via pi-ai's custom OpenAI-compatible endpoint support.

## Not in Scope

- Workspace file context injection (deferred — system prompt has instructions to gather context)
- Agent tool calling (pi-agent-core supports it, wired in later tickets)
- Conversation entry index in sidebar (KAT-186)
- Agent roster sidebar (KAT-185)
- Task checklist sync (KAT-188)
- Approval action buttons in conversation (KAT-187)
- Full settings panel for auth management

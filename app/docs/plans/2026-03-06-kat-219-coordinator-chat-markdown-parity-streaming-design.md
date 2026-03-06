# KAT-219 Coordinator Chat Markdown Parity + Streaming-Safe Output Design

**Issue:** KAT-219  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-219/027-coordinator-chat-markdown-rendering-parity-streaming-safe-output  
**Parent epic:** KAT-163 Post-Slice A - Coordinator Session Parity (Spec 02)  
**Branch target:** `feature/kat-219-027-coordinator-chat-markdown-rendering-parity-streaming`  
**Specs:** `_plans/design/specs/02-coordinator-session.md`  
**Relevant mocks:** `04-coordinator-session-initial-state.png`, `05-coordinator-session-pasted-context.png`, `06-coordinator-session-spec-context-reading.png`, `07-coordinator-session-spec-analyzing.png`

## Scope and Outcome

Deliver the final-fidelity markdown rendering layer for the center coordinator conversation so supported markdown elements render predictably during both settled and streaming states.

Required outcome:

- Assistant output in the center panel renders supported markdown instead of degrading to plain text.
- Supported parity-critical markdown matches Spec 02 expectations: headings, ordered lists, unordered lists, inline code, fenced code blocks, blockquotes, and GFM task/checklist text.
- Streaming updates remain readable while `message_updated` events are arriving and stabilize cleanly when the final `message_appended` event lands.
- Unit/component coverage proves renderer behavior for both completed and partial markdown.

Out of scope:

- Rich markdown authoring for user prompts.
- Runtime-loaded markdown plugins or network-dependent renderers.
- Ownership of pasted-content badge behavior, agent/context chips, or right-panel workflow content.

## Context Loaded

Sources reviewed for this design:

- Linear issue `KAT-219`, parent epic `KAT-163`, and the fidelity-classification comments attached to the ticket.
- Linear documents:
  - `Execution Model: UI Baseline then Parallel Functional Vertical Slices`
  - `Desktop App Linear Workflow Contract`
- Local design references:
  - `AGENTS.md`
  - `_plans/design/specs/README.md`
  - `_plans/design/specs/02-coordinator-session.md`
  - `_plans/design/mocks/README.md`
- Existing related design docs:
  - `docs/plans/2026-03-05-kat-214-shared-conversation-ui-primitives-design.md`
  - `docs/plans/2026-03-06-kat-171-conversation-message-primitives-coordinator-status-design.md`
  - `docs/plans/2026-03-02-ui-ticket-fidelity-contract-ui-center-mapping.md`
- Current implementation:
  - `src/renderer/components/shared/MarkdownRenderer.tsx`
  - `src/renderer/components/center/primitives/ConversationMessage.tsx`
  - `src/renderer/components/center/primitives/ConversationMessageCard.tsx`
  - `src/renderer/components/center/MessageBubble.tsx`
  - `src/renderer/components/center/ChatPanel.tsx`
  - `src/renderer/hooks/useIpcSessionConversation.ts`
  - `src/main/agent-runner.ts`
- Existing tests:
  - `tests/unit/renderer/shared/MarkdownRenderer.test.tsx`
  - `tests/unit/renderer/center/MessageBubble.test.tsx`
  - `tests/unit/renderer/center/primitives/ConversationMessage.test.tsx`
  - `tests/unit/renderer/center/sessionConversationState.test.ts`
  - `tests/unit/main/agent-runner.test.ts`

## Clarifications and Assumptions

- User-authored messages remain in the existing plain/card treatment from mocks 04-07. Markdown parity in this ticket applies to assistant/coordinator output, not prompt authoring UX.
- Existing shared conversation primitives from KAT-214 and KAT-171 remain the contract seam. KAT-219 should extend the renderer behavior, not replace the center-panel composition model.
- The live streaming path in the current code uses `message_updated` events from `src/main/agent-runner.ts`, not the older `RUN_STREAM_UPDATED` reducer event as the primary runtime path.
- Final evidence for this ticket will require screenshots against markdown-heavy coordinator states; this design only defines how to achieve that parity.

## Problem Statement

The current renderer stack is close but not yet Spec-02-safe:

- `MarkdownRenderer` already handles headings, basic lists, fenced code, and inline code through `react-markdown` + `remark-gfm`, but it does not define explicit rendering for blockquotes or GFM checklists and does not tune spacing/semantics for streaming partial documents.
- `ConversationMessage` renders user rows as plain text and assistant rows through `MarkdownRenderer`, which is the right composition boundary, but the markdown contract is too minimal for the fidelity bar KAT-219 owns.
- `useIpcSessionConversation` replaces the active assistant message on each `message_updated` event. That keeps message identity stable, but the renderer currently has no stream-aware normalization layer to preserve readable line breaks and incomplete fenced blocks while chunks are still arriving.
- Existing tests prove base markdown rendering and stream event delivery, but they do not yet lock the specific failure modes this ticket cares about: partial fences, partial blockquotes, progressive checklist rendering, and stability between stream and final append.

## Approaches Considered

### Approach 1 (Recommended): Extend the shared markdown renderer and add a stream-normalization seam before render

Keep `ConversationMessage` and `MessageBubble` unchanged as the composition boundary. Improve `MarkdownRenderer` to cover the missing Spec 02 elements and introduce a tiny stream-safe preprocessor for assistant content before passing it to `react-markdown`.

Pros:

- Smallest surface area and lowest merge risk.
- Preserves the enabler work already landed in KAT-214 and KAT-171.
- Centralizes markdown behavior so right-panel and future conversation surfaces can reuse it later if desired.
- Makes streaming and settled rendering share one rendering path.

Cons:

- Requires careful normalization rules so stream-safe fixes do not change completed markdown semantics.

### Approach 2: Add a separate streaming markdown component for center-panel assistant messages

Create a `StreamingMarkdownRenderer` used only while the run is pending and switch back to the existing renderer once the final message arrives.

Pros:

- Allows aggressive streaming-specific formatting without touching settled rendering.

Cons:

- Two render paths for the same content invites parity drift.
- Higher maintenance and higher risk of visual jumps when swapping renderers.

### Approach 3: Keep the current renderer and patch line breaks in the reducer/runtime path only

Leave markdown rendering mostly unchanged and normalize content strings in `agent-runner` or `useIpcSessionConversation`.

Pros:

- Fastest localized patch.

Cons:

- Couples presentation fixes to transport/runtime code.
- Still leaves missing markdown element styling unresolved.
- Harder to reuse and harder to test as a rendering contract.

## Recommendation

Proceed with **Approach 1**.

KAT-219 is a final-fidelity UI ticket, so the cleanest solution is one canonical markdown rendering contract for assistant messages with a narrow pre-render normalization step for streaming safety. That keeps runtime delivery simple and makes the fidelity bar testable at the renderer layer.

## Proposed Design

## 1) Ownership Boundary

KAT-219 should own:

- assistant/coordinator markdown rendering in the center conversation panel
- stream-safe normalization for partial assistant markdown
- center-panel tests that prove the rendering contract
- screenshot/evidence targets for markdown-heavy coordinator output

KAT-219 should not own:

- user prompt markdown authoring or rich-text editing
- pasted-content badge interaction
- context chip population rules
- right-panel markdown/spec parsing
- model selector or input bar behavior

## 2) Rendering Contract

Assistant/coordinator messages continue to flow through:

`MessageBubble` -> `ConversationMessageCard` -> `ConversationMessage` -> `MarkdownRenderer`

User messages continue to render as:

- plain text
- `whitespace-pre-wrap`
- existing card shell and dismiss/footer affordances

Assistant/coordinator messages must support these rendered elements:

- `h1` through `h6`
- unordered lists
- ordered lists
- inline code
- fenced code blocks, including language-tagged fences
- blockquotes
- GFM task/checklist items rendered as readable checklist rows

The renderer must remain deterministic:

- no role-specific fallback to raw `<pre>` or plain text for supported elements
- stable DOM structure for the same markdown input
- no alternate streaming-only component tree

## 3) Stream-Safe Markdown Normalization

Introduce a pure helper in the shared markdown layer, for example:

```ts
type MarkdownRenderMode = 'settled' | 'streaming'

function normalizeMarkdownForRender(content: string, mode: MarkdownRenderMode): string
```

Rules for `streaming` mode:

- Preserve incoming newlines exactly; never collapse line breaks into a single paragraph.
- If a fenced code block is opened but not yet closed, synthetically close it for render only so the remainder of the stream stays in a code block instead of corrupting all following layout.
- If a blockquote line is mid-stream, preserve its prefix and paragraph boundaries rather than flattening it into surrounding text.
- Leave incomplete emphasis/code markers untouched unless normalization is required to avoid catastrophic layout corruption.

Rules for `settled` mode:

- Return the content unchanged.
- The final `message_appended` event becomes the canonical persisted/rendered string.

This normalization must be presentation-only. It must not mutate stored run content or alter the message payload in the runtime adapter.

## 4) Markdown Component Coverage

`MarkdownRenderer` should explicitly define components for the currently missing fidelity-critical nodes:

- `blockquote`
  - muted left border
  - inset padding
  - readable foreground contrast
- task/checklist list items
  - render GFM checkboxes as disabled visual checkboxes or equivalent static markers
  - preserve checked vs unchecked state
- list item spacing
  - nested paragraph/list spacing should not collapse awkwardly during streaming updates
- fenced code blocks
  - keep overflow containment and monospace styling
  - ensure unterminated fences still render as one code block in streaming mode

The goal is not syntax highlighting or rich plugins. The goal is stable structural rendering with the tokens already used by the app shell.

## 5) Center-Panel Integration

Add the mode seam at the assistant message render boundary, not in the reducer:

- `ConversationMessage` detects assistant/coordinator role.
- When the conversation run is pending and the message is the currently streaming assistant message, render the normalized `streaming` form.
- All other assistant messages render in `settled` mode.

This can be passed as a small prop from `ChatPanel` or `MessageBubble`, for example `renderMode="streaming" | "settled"`.

Why here:

- `ChatPanel` already knows the current run state.
- `MessageBubble` already encapsulates user vs assistant composition.
- The runtime adapter and reducer should stay focused on event/state correctness, not visual repair.

## 6) Streaming Stability Rules

The center panel must satisfy these UX invariants during a live run:

- streamed assistant content keeps a stable message id throughout `message_updated` events
- prior rendered content is replaced in place, not duplicated
- line breaks remain readable across updates
- partial markdown may be visually incomplete, but it must not cause surrounding layout corruption
- when the final `message_appended` event arrives, the visual result converges to the exact settled markdown output with no extra wrapper swap or jarring structural reset

This design intentionally accepts that partially streamed markdown may not be semantically perfect at every intermediate character. The bar is readability and convergence, not speculative completion of every incomplete token type.

## 7) Testing Strategy (TDD)

### Renderer unit tests

Add/extend tests in `tests/unit/renderer/shared/MarkdownRenderer.test.tsx` for:

- blockquote rendering
- GFM task/checklist rendering
- ordered + unordered list spacing around paragraphs
- streaming normalization for unterminated fenced code blocks
- streaming normalization preserving multi-line blockquotes

### Center primitive tests

Add/extend tests in:

- `tests/unit/renderer/center/primitives/ConversationMessage.test.tsx`
- `tests/unit/renderer/center/MessageBubble.test.tsx`
- `tests/unit/renderer/center/ChatPanel.test.tsx`

Cover:

- assistant messages render supported markdown elements through the real center-panel path
- user messages remain plain text even when they contain markdown markers
- pending/streaming assistant message uses streaming-safe render mode
- settled assistant message uses canonical render mode
- final append matches the expected final markdown after prior stream updates

### State/runtime tests

Keep the existing reducer/runtime guarantees and extend only where needed:

- `tests/unit/main/agent-runner.test.ts` already proves `message_updated` + `message_appended`
- `tests/unit/renderer/center/sessionConversationState.test.ts` should keep proving in-place replacement and no duplicate assistant messages

## 8) Evidence Plan

To satisfy the workflow contract for a final-fidelity ticket, completion evidence must include:

- passing unit/component tests for the renderer and stream transition cases
- screenshot evidence against coordinator-session mock states using markdown-heavy assistant output
- explicit confirmation that supported markdown elements no longer fall back to plain text

Suggested screenshot targets:

- a markdown-heavy coordinator response while idle/stopped
- the same response during an active stream with a partial fenced block or checklist

## 9) Risks and Mitigations

- Risk: stream normalization changes final markdown semantics.
  - Mitigation: normalization is mode-gated and a no-op in `settled` mode.

- Risk: checklist rendering depends on `remark-gfm` output details.
  - Mitigation: test the actual rendered DOM for checked/unchecked states rather than assuming a specific internal AST shape.

- Risk: adding render-mode props causes primitive API churn.
  - Mitigation: keep the new prop optional and default to `settled`.

- Risk: blockquote/code styles drift from the rest of the shell.
  - Mitigation: reuse existing `border`, `bg-card`, `text-muted-foreground`, and mono token patterns already present in `MarkdownRenderer` and `ConversationMessageCard`.

## Approval Summary

Approved scope decision recorded during brainstorming:

- user messages stay plain/card-like
- assistant/coordinator output gets markdown parity
- streaming safety is handled at render time, not by mutating runtime payloads

## Next Step

Create the implementation plan for KAT-219 with a test-first sequence centered on:

1. markdown renderer contract tests
2. stream normalization helper tests
3. center-panel integration tests
4. implementation updates in shared renderer and center message composition

## Verification Commands

- `npx vitest run tests/unit/renderer/shared/normalize-markdown-for-render.test.ts tests/unit/renderer/shared/MarkdownRenderer.test.tsx tests/unit/renderer/center/primitives/ConversationMessage.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx`
- `npm test`
- `npm run dev -- --remote-debugging-port=9222`

## Screenshot Evidence Targets

- Pending coordinator response with markdown blockquote + checklist
- Final/stopped coordinator response with heading + fenced code block

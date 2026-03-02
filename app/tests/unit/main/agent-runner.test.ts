import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AgentEvent } from '@mariozechner/pi-agent-core'
import type { SessionRuntimeEvent } from '../../../src/renderer/types/session-runtime-adapter'

// Capture the subscribe callback so tests can emit events
let subscribeCallback: ((event: AgentEvent) => void) | null = null
const mockAbort = vi.fn()
const mockPrompt = vi.fn()
const mockSetSystemPrompt = vi.fn()
const mockSetModel = vi.fn()
const mockSubscribe = vi.fn((cb: (event: AgentEvent) => void) => {
  subscribeCallback = cb
  return () => {
    subscribeCallback = null
  }
})

let capturedStreamFn: ((model: unknown, context: unknown, options?: Record<string, unknown>) => unknown) | null = null

vi.mock('@mariozechner/pi-agent-core', () => {
  return {
    Agent: vi.fn().mockImplementation(function (this: Record<string, unknown>, config: { streamFn?: (model: unknown, context: unknown, options?: Record<string, unknown>) => unknown }) {
      if (config?.streamFn) {
        capturedStreamFn = config.streamFn
      }
      this.state = { messages: [], isStreaming: false }
      this.subscribe = mockSubscribe
      this.prompt = mockPrompt
      this.abort = mockAbort
      this.setSystemPrompt = mockSetSystemPrompt
      this.setModel = mockSetModel
    })
  }
})

vi.mock('@mariozechner/pi-ai', () => ({
  getModel: vi.fn(() => ({
    id: 'claude-sonnet-4-6-20250514',
    name: 'Claude Sonnet 4.6',
    api: 'anthropic-messages',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com'
  })),
  streamSimple: vi.fn()
}))

describe('AgentRunner', () => {
  beforeEach(() => {
    subscribeCallback = null
    capturedStreamFn = null
    mockAbort.mockReset()
    mockSetSystemPrompt.mockReset()
    mockSetModel.mockReset()
    mockSubscribe.mockClear()
    mockPrompt.mockReset().mockImplementation(async () => {
      // Simulate agent lifecycle via the subscribe callback
      if (subscribeCallback) {
        subscribeCallback({ type: 'agent_start' })
        subscribeCallback({
          type: 'message_end',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Draft ready for review.' }],
            usage: {
              input: 100,
              output: 50,
              totalTokens: 150,
              cacheRead: 0,
              cacheWrite: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.001 }
            },
            stopReason: 'stop',
            api: 'anthropic-messages',
            provider: 'anthropic',
            model: 'claude-sonnet-4-6-20250514',
            timestamp: Date.now()
          }
        } as AgentEvent)
        subscribeCallback({ type: 'agent_end', messages: [] })
      }
    })
  })

  it('emits run_state_changed and message_appended on completion', async () => {
    const { createAgentRunner } = await import('../../../src/main/agent-runner')
    const events: SessionRuntimeEvent[] = []

    const runner = createAgentRunner({
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      systemPrompt: 'You are a helpful assistant.',
      onEvent: (event) => events.push(event)
    })

    await runner.execute('Plan phase 2')

    expect(events.some((e) => e.type === 'run_state_changed')).toBe(true)
    expect(events.some((e) => e.type === 'message_appended')).toBe(true)

    // Verify state transitions: pending at start, idle at end
    const stateEvents = events.filter((e) => e.type === 'run_state_changed')
    expect(stateEvents[0]).toEqual({ type: 'run_state_changed', runState: 'pending' })
    expect(stateEvents[stateEvents.length - 1]).toEqual({
      type: 'run_state_changed',
      runState: 'idle'
    })

    // Verify message content
    const msgEvents = events.filter((e) => e.type === 'message_appended')
    expect(msgEvents).toHaveLength(1)
    const msg = (msgEvents[0] as { type: 'message_appended'; message: { content: string } })
      .message
    expect(msg.content).toBe('Draft ready for review.')
  })

  it('configures agent with system prompt and model', async () => {
    const { createAgentRunner } = await import('../../../src/main/agent-runner')

    const runner = createAgentRunner({
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      systemPrompt: 'You are a helpful assistant.',
      onEvent: () => {}
    })

    await runner.execute('test')

    expect(mockSetSystemPrompt).toHaveBeenCalledWith('You are a helpful assistant.')
    expect(mockSetModel).toHaveBeenCalled()
  })

  it('subscribes to agent events before calling prompt', async () => {
    const { createAgentRunner } = await import('../../../src/main/agent-runner')

    const runner = createAgentRunner({
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      systemPrompt: 'test',
      onEvent: () => {}
    })

    await runner.execute('test prompt')

    // subscribe should be called before prompt
    const subscribeOrder = mockSubscribe.mock.invocationCallOrder[0]
    const promptOrder = mockPrompt.mock.invocationCallOrder[0]
    expect(subscribeOrder).toBeLessThan(promptOrder)
  })

  it('emits error run_state_changed when agent throws', async () => {
    mockPrompt.mockReset().mockRejectedValue(new Error('API rate limit'))

    const { createAgentRunner } = await import('../../../src/main/agent-runner')
    const events: SessionRuntimeEvent[] = []

    const runner = createAgentRunner({
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      systemPrompt: 'test',
      onEvent: (event) => events.push(event)
    })

    await runner.execute('fail')

    const errorEvent = events.find(
      (e) => e.type === 'run_state_changed' && e.runState === 'error'
    )
    expect(errorEvent).toBeDefined()
    expect((errorEvent as { errorMessage: string }).errorMessage).toBe('API rate limit')
  })

  it('treats assistant stopReason=error as run failure and does not emit idle', async () => {
    mockPrompt.mockReset().mockImplementation(async () => {
      if (subscribeCallback) {
        subscribeCallback({
          type: 'message_end',
          message: {
            role: 'assistant',
            content: [],
            usage: {
              input: 0,
              output: 0,
              totalTokens: 0,
              cacheRead: 0,
              cacheWrite: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
            },
            stopReason: 'error',
            errorMessage: 'Missing scopes: api.responses.write',
            api: 'openai-codex-responses',
            provider: 'openai-codex',
            model: 'gpt-5.3-codex',
            timestamp: Date.now()
          }
        } as AgentEvent)
        subscribeCallback({ type: 'agent_end', messages: [] })
      }
    })

    const { createAgentRunner } = await import('../../../src/main/agent-runner')
    const events: SessionRuntimeEvent[] = []

    const runner = createAgentRunner({
      model: 'gpt-5.3-codex',
      provider: 'openai-codex',
      apiKey: 'token',
      systemPrompt: 'test',
      onEvent: (event) => events.push(event)
    })

    await runner.execute('test')

    const stateEvents = events.filter((e) => e.type === 'run_state_changed')
    expect(stateEvents[0]).toEqual({ type: 'run_state_changed', runState: 'pending' })
    expect(stateEvents[stateEvents.length - 1]).toEqual({
      type: 'run_state_changed',
      runState: 'error',
      errorMessage: 'Missing scopes: api.responses.write'
    })
  })

  it('emits Unknown error once when assistant error has no message and prompt rejects', async () => {
    mockPrompt.mockReset().mockImplementation(async () => {
      if (subscribeCallback) {
        subscribeCallback({
          type: 'message_end',
          message: {
            role: 'assistant',
            content: [],
            usage: {
              input: 0,
              output: 0,
              totalTokens: 0,
              cacheRead: 0,
              cacheWrite: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
            },
            stopReason: 'error',
            api: 'openai-codex-responses',
            provider: 'openai-codex',
            model: 'gpt-5.3-codex',
            timestamp: Date.now()
          }
        } as AgentEvent)
      }
      throw new Error('transport failed')
    })

    const { createAgentRunner } = await import('../../../src/main/agent-runner')
    const events: SessionRuntimeEvent[] = []

    const runner = createAgentRunner({
      model: 'gpt-5.3-codex',
      provider: 'openai-codex',
      apiKey: 'token',
      systemPrompt: 'test',
      onEvent: (event) => events.push(event)
    })

    await runner.execute('test')

    const stateEvents = events.filter((e) => e.type === 'run_state_changed')
    expect(stateEvents[0]).toEqual({ type: 'run_state_changed', runState: 'pending' })

    const errorEvents = stateEvents.filter((e) => e.runState === 'error')
    expect(errorEvents).toHaveLength(1)
    expect((errorEvents[0] as { errorMessage: string }).errorMessage).toBe('Unknown error')
    expect(stateEvents.some((e) => e.runState === 'idle')).toBe(false)
  })

  it('abort calls agent.abort', async () => {
    const { createAgentRunner } = await import('../../../src/main/agent-runner')

    const runner = createAgentRunner({
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      systemPrompt: 'test',
      onEvent: () => {}
    })

    runner.abort()
    expect(mockAbort).toHaveBeenCalled()
  })

  it('passes apiKey through streamFn to streamSimple', async () => {
    const { streamSimple } = await import('@mariozechner/pi-ai')
    const { createAgentRunner } = await import('../../../src/main/agent-runner')

    createAgentRunner({
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      apiKey: 'sk-ant-key-123',
      systemPrompt: 'test',
      onEvent: () => {}
    })

    expect(capturedStreamFn).not.toBeNull()
    const mockModel = { id: 'test' }
    const mockContext = [{ role: 'user', content: 'hello' }]
    capturedStreamFn!(mockModel, mockContext, { temperature: 0.5 })
    expect(streamSimple).toHaveBeenCalledWith(
      mockModel,
      mockContext,
      { temperature: 0.5, apiKey: 'sk-ant-key-123' }
    )
  })

  it('handles message_end with non-array content', async () => {
    mockPrompt.mockReset().mockImplementation(async () => {
      if (subscribeCallback) {
        subscribeCallback({
          type: 'message_end',
          message: {
            role: 'assistant',
            content: 'raw-string-not-array',
            usage: { input: 0, output: 0, totalTokens: 0, cacheRead: 0, cacheWrite: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            stopReason: 'stop',
            api: 'anthropic-messages',
            provider: 'anthropic',
            model: 'test',
            timestamp: Date.now()
          }
        } as AgentEvent)
        subscribeCallback({ type: 'agent_end', messages: [] })
      }
    })

    const { createAgentRunner } = await import('../../../src/main/agent-runner')
    const events: SessionRuntimeEvent[] = []

    const runner = createAgentRunner({
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      systemPrompt: 'test',
      onEvent: (event) => events.push(event)
    })

    await runner.execute('test')

    // No message_appended event should be emitted since extractTextContent returns '' for non-array
    const msgEvents = events.filter((e) => e.type === 'message_appended')
    expect(msgEvents).toHaveLength(0)
  })

  it('skips message_appended for non-assistant messages', async () => {
    mockPrompt.mockReset().mockImplementation(async () => {
      if (subscribeCallback) {
        subscribeCallback({
          type: 'message_end',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'user echo' }],
            usage: { input: 0, output: 0, totalTokens: 0, cacheRead: 0, cacheWrite: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            stopReason: 'stop',
            api: 'anthropic-messages',
            provider: 'anthropic',
            model: 'test',
            timestamp: Date.now()
          }
        } as AgentEvent)
        subscribeCallback({ type: 'agent_end', messages: [] })
      }
    })

    const { createAgentRunner } = await import('../../../src/main/agent-runner')
    const events: SessionRuntimeEvent[] = []

    const runner = createAgentRunner({
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      systemPrompt: 'test',
      onEvent: (event) => events.push(event)
    })

    await runner.execute('test')

    const msgEvents = events.filter((e) => e.type === 'message_appended')
    expect(msgEvents).toHaveLength(0)
  })

  it('emits Unknown error for non-Error thrown objects', async () => {
    mockPrompt.mockReset().mockRejectedValue('string-error')

    const { createAgentRunner } = await import('../../../src/main/agent-runner')
    const events: SessionRuntimeEvent[] = []

    const runner = createAgentRunner({
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      systemPrompt: 'test',
      onEvent: (event) => events.push(event)
    })

    await runner.execute('fail')

    const errorEvent = events.find(
      (e) => e.type === 'run_state_changed' && e.runState === 'error'
    )
    expect(errorEvent).toBeDefined()
    expect((errorEvent as { errorMessage: string }).errorMessage).toBe('Unknown error')
  })

  it('suppresses events after abort during execution', async () => {
    let abortRunner: (() => void) | null = null
    mockPrompt.mockReset().mockImplementation(async () => {
      // Abort mid-execution
      abortRunner?.()
      if (subscribeCallback) {
        subscribeCallback({ type: 'agent_start' })
        subscribeCallback({
          type: 'message_end',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Should be suppressed' }],
            usage: {
              input: 0,
              output: 0,
              totalTokens: 0,
              cacheRead: 0,
              cacheWrite: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
            },
            stopReason: 'stop',
            api: 'anthropic-messages',
            provider: 'anthropic',
            model: 'test',
            timestamp: Date.now()
          }
        } as AgentEvent)
      }
    })

    const { createAgentRunner } = await import('../../../src/main/agent-runner')
    const events: SessionRuntimeEvent[] = []

    const runner = createAgentRunner({
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      systemPrompt: 'test',
      onEvent: (event) => events.push(event)
    })

    abortRunner = () => runner.abort()
    await runner.execute('test')

    const msgEvents = events.filter((e) => e.type === 'message_appended')
    expect(msgEvents).toHaveLength(0)
  })

  it('does not emit error event when prompt rejects after abort during execution', async () => {
    let abortRunner: (() => void) | null = null
    mockPrompt.mockReset().mockImplementation(async () => {
      abortRunner?.()
      throw new Error('late failure')
    })

    const { createAgentRunner } = await import('../../../src/main/agent-runner')
    const events: SessionRuntimeEvent[] = []

    const runner = createAgentRunner({
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      systemPrompt: 'test',
      onEvent: (event) => events.push(event)
    })

    abortRunner = () => runner.abort()
    await runner.execute('test')

    const errorEvent = events.find(
      (e) => e.type === 'run_state_changed' && e.runState === 'error'
    )
    expect(errorEvent).toBeUndefined()
  })
})

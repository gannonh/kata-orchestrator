import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import { createCredentialResolver } from '../../../src/main/credential-resolver'
import type { AuthStorage } from '../../../src/main/auth-storage'

function createMockAuthStorage(
  data: Record<
    string,
    | { type: 'api_key'; key: string }
    | { type: 'oauth'; access: string; refresh: string; expires: number }
    | null
  > = {}
): AuthStorage {
  return {
    async get(provider) {
      return data[provider] ?? null
    },
    async set() {},
    async remove() {}
  }
}

describe('CredentialResolver', () => {
  const originalEnv = { ...process.env }
  const tempDirs: string[] = []

  function createTempCodexAuthFileRaw(payload: unknown): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kata-cred-test-'))
    tempDirs.push(dir)
    const filePath = path.join(dir, 'codex-auth.json')
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf-8')
    return filePath
  }

  function createTempCodexAuthFile(accessToken?: string): string {
    const payload = accessToken ? { tokens: { access_token: accessToken } } : { tokens: {} }
    return createTempCodexAuthFileRaw(payload)
  }

  afterEach(() => {
    process.env = { ...originalEnv }
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns oauth access token when stored', async () => {
    const storage = createMockAuthStorage({
      anthropic: {
        type: 'oauth',
        access: 'oauth-token',
        refresh: 'r',
        expires: Date.now() + 3600000
      }
    })
    const resolver = createCredentialResolver(storage)

    const key = await resolver.getApiKey('anthropic')
    expect(key).toBe('oauth-token')
  })

  it('falls back to env var when no oauth credential', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env'
    const resolver = createCredentialResolver(createMockAuthStorage())

    const key = await resolver.getApiKey('anthropic')
    expect(key).toBe('sk-ant-env')
  })

  it('returns undefined when no credentials at all', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const resolver = createCredentialResolver(createMockAuthStorage())

    const key = await resolver.getApiKey('anthropic')
    expect(key).toBeUndefined()
  })

  it('resolves openai env var', async () => {
    process.env.OPENAI_API_KEY = 'sk-openai-env'
    const resolver = createCredentialResolver(createMockAuthStorage())

    const key = await resolver.getApiKey('openai')
    expect(key).toBe('sk-openai-env')
  })

  it('resolves openai-codex env var', async () => {
    process.env.OPENAI_API_KEY = 'sk-openai-env'
    const resolver = createCredentialResolver(createMockAuthStorage())

    const key = await resolver.getApiKey('openai-codex')
    expect(key).toBe('sk-openai-env')
  })

  it('falls back to Codex session token for openai when no stored/env credentials exist', async () => {
    delete process.env.OPENAI_API_KEY
    const codexAuthPath = createTempCodexAuthFile('codex-session-token')
    const resolver = createCredentialResolver(createMockAuthStorage(), { codexAuthPath })

    const key = await resolver.getApiKey('openai')
    expect(key).toBe('codex-session-token')
  })

  it('falls back to Codex session token for openai-codex when no stored/env credentials exist', async () => {
    delete process.env.OPENAI_API_KEY
    const codexAuthPath = createTempCodexAuthFile('codex-session-token')
    const resolver = createCredentialResolver(createMockAuthStorage(), { codexAuthPath })

    const key = await resolver.getApiKey('openai-codex')
    expect(key).toBe('codex-session-token')
  })

  it('returns undefined when Codex session token is non-string', async () => {
    delete process.env.OPENAI_API_KEY
    const codexAuthPath = createTempCodexAuthFileRaw({ tokens: { access_token: 123 } })
    const resolver = createCredentialResolver(createMockAuthStorage(), { codexAuthPath })

    const key = await resolver.getApiKey('openai')
    expect(key).toBeUndefined()
  })

  it('returns undefined when Codex auth file is missing', async () => {
    delete process.env.OPENAI_API_KEY
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kata-cred-test-'))
    tempDirs.push(dir)
    const codexAuthPath = path.join(dir, 'missing-auth.json')
    const resolver = createCredentialResolver(createMockAuthStorage(), { codexAuthPath })

    const key = await resolver.getApiKey('openai')
    expect(key).toBeUndefined()
  })

  it('oauth takes priority over env var', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env'
    const storage = createMockAuthStorage({
      anthropic: {
        type: 'oauth',
        access: 'oauth-wins',
        refresh: 'r',
        expires: Date.now() + 3600000
      }
    })
    const resolver = createCredentialResolver(storage)

    const key = await resolver.getApiKey('anthropic')
    expect(key).toBe('oauth-wins')
  })

  it('api_key credential takes priority over env var', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env'
    const storage = createMockAuthStorage({
      anthropic: { type: 'api_key', key: 'sk-ant-stored' }
    })
    const resolver = createCredentialResolver(storage)

    const key = await resolver.getApiKey('anthropic')
    expect(key).toBe('sk-ant-stored')
  })

  it('getAuthStatus returns oauth when oauth credential exists', async () => {
    const storage = createMockAuthStorage({
      anthropic: {
        type: 'oauth',
        access: 'token',
        refresh: 'r',
        expires: Date.now() + 3600000
      }
    })
    const resolver = createCredentialResolver(storage)

    const status = await resolver.getAuthStatus('anthropic')
    expect(status).toBe('oauth')
  })

  it('getAuthStatus returns api_key when only env var set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env'
    const resolver = createCredentialResolver(createMockAuthStorage())

    const status = await resolver.getAuthStatus('anthropic')
    expect(status).toBe('api_key')
  })

  it('getAuthStatus returns none when no credentials', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const resolver = createCredentialResolver(createMockAuthStorage())

    const status = await resolver.getAuthStatus('anthropic')
    expect(status).toBe('none')
  })

  it('getAuthStatus returns oauth for openai when only Codex session token exists', async () => {
    delete process.env.OPENAI_API_KEY
    const codexAuthPath = createTempCodexAuthFile('codex-session-token')
    const resolver = createCredentialResolver(createMockAuthStorage(), { codexAuthPath })

    const status = await resolver.getAuthStatus('openai')
    expect(status).toBe('oauth')
  })

  it('getAuthStatus returns oauth for openai-codex when only Codex session token exists', async () => {
    delete process.env.OPENAI_API_KEY
    const codexAuthPath = createTempCodexAuthFile('codex-session-token')
    const resolver = createCredentialResolver(createMockAuthStorage(), { codexAuthPath })

    const status = await resolver.getAuthStatus('openai-codex')
    expect(status).toBe('oauth')
  })
})

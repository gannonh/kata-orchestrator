import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAuthStorage } from '../../../src/main/auth-storage'
import type { AuthCredential, AuthStorage } from '../../../src/main/auth-storage'

describe('AuthStorage', () => {
  let tmpDir: string
  let authPath: string
  let storage: AuthStorage

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kata-auth-test-'))
    authPath = path.join(tmpDir, 'auth.json')
    storage = createAuthStorage(authPath)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns null for unknown provider when file does not exist', async () => {
    const cred = await storage.get('anthropic')
    expect(cred).toBeNull()
  })

  it('saves and retrieves an api_key credential', async () => {
    const cred: AuthCredential = { type: 'api_key', key: 'sk-ant-test' }
    await storage.set('anthropic', cred)

    const loaded = await storage.get('anthropic')
    expect(loaded).toEqual(cred)
  })

  it('saves and retrieves an oauth credential', async () => {
    const cred: AuthCredential = {
      type: 'oauth',
      refresh: 'refresh-token',
      access: 'access-token',
      expires: Date.now() + 3600000
    }
    await storage.set('openai', cred)

    const loaded = await storage.get('openai')
    expect(loaded).toEqual(cred)
  })

  it('removes a credential', async () => {
    await storage.set('anthropic', { type: 'api_key', key: 'sk-ant-test' })
    await storage.remove('anthropic')

    const loaded = await storage.get('anthropic')
    expect(loaded).toBeNull()
  })

  it('persists across instances', async () => {
    await storage.set('anthropic', { type: 'api_key', key: 'sk-ant-test' })

    const storage2 = createAuthStorage(authPath)
    const loaded = await storage2.get('anthropic')
    expect(loaded).toEqual({ type: 'api_key', key: 'sk-ant-test' })
  })

  it('rethrows non-ENOENT errors from readData', async () => {
    // Create a directory where the file should be — readFileSync on a directory throws EISDIR
    fs.mkdirSync(authPath)
    await expect(storage.get('anthropic')).rejects.toThrow()
  })

  it('rejects __proto__ as provider key', async () => {
    await expect(storage.get('__proto__')).rejects.toThrow('Invalid provider key')
    await expect(storage.set('__proto__', { type: 'api_key', key: 'k' })).rejects.toThrow('Invalid provider key')
    await expect(storage.remove('__proto__')).rejects.toThrow('Invalid provider key')
  })

  it('rejects constructor as provider key', async () => {
    await expect(storage.get('constructor')).rejects.toThrow('Invalid provider key')
  })

  it('rejects empty string as provider key', async () => {
    await expect(storage.get('')).rejects.toThrow('Invalid provider key')
  })

  it('handles concurrent access without corruption', async () => {
    const s1 = createAuthStorage(authPath)
    const s2 = createAuthStorage(authPath)

    await Promise.all([
      s1.set('anthropic', { type: 'api_key', key: 'key-1' }),
      s2.set('openai', { type: 'api_key', key: 'key-2' })
    ])

    const storage3 = createAuthStorage(authPath)
    const a = await storage3.get('anthropic')
    const o = await storage3.get('openai')
    // Both should exist (lockfile prevents race)
    expect(a).not.toBeNull()
    expect(o).not.toBeNull()
  })
})

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { AuthStorage } from './auth-storage'

export type AuthStatus = 'oauth' | 'api_key' | 'none'

export type CredentialResolver = {
  getApiKey(provider: string): Promise<string | undefined>
  getAuthStatus(provider: string): Promise<AuthStatus>
}

const ENV_MAP: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  'openai-codex': 'OPENAI_API_KEY'
}

type CreateCredentialResolverOptions = {
  codexAuthPath?: string
}

type CodexAuthFile = {
  tokens?: {
    access_token?: string
  }
}

function readCodexAccessToken(codexAuthPath: string): string | undefined {
  let raw: string
  try {
    raw = fs.readFileSync(codexAuthPath, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    console.error(`[CredentialResolver] Failed to read Codex auth file at ${codexAuthPath}:`, err)
    return undefined
  }

  try {
    const parsed = JSON.parse(raw) as CodexAuthFile
    const token = parsed.tokens?.access_token
    if (typeof token !== 'string') return undefined
    return token.trim() || undefined
  } catch (err) {
    console.error(`[CredentialResolver] Failed to parse Codex auth file at ${codexAuthPath}:`, err)
    return undefined
  }
}

function isCodexSessionProvider(provider: string): boolean {
  return provider === 'openai' || provider === 'openai-codex'
}

export function createCredentialResolver(
  authStorage: AuthStorage,
  options?: CreateCredentialResolverOptions
): CredentialResolver {
  const codexAuthPath = options?.codexAuthPath ?? path.join(os.homedir(), '.codex', 'auth.json')

  return {
    async getApiKey(provider) {
      const stored = await authStorage.get(provider)
      if (stored) {
        return stored.type === 'oauth' ? stored.access : stored.key
      }

      const envVar = ENV_MAP[provider]
      const envValue = envVar ? process.env[envVar] : undefined
      if (envValue) {
        return envValue
      }

      if (isCodexSessionProvider(provider)) {
        return readCodexAccessToken(codexAuthPath)
      }

      return undefined
    },

    async getAuthStatus(provider) {
      const stored = await authStorage.get(provider)
      if (stored) {
        return stored.type
      }

      const envVar = ENV_MAP[provider]
      if (envVar && process.env[envVar]) {
        return 'api_key'
      }

      if (isCodexSessionProvider(provider) && readCodexAccessToken(codexAuthPath)) {
        return 'oauth'
      }

      return 'none'
    }
  }
}

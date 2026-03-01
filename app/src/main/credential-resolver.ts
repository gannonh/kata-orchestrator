import type { AuthStorage } from './auth-storage'

export type AuthStatus = 'oauth' | 'api_key' | 'none'

export type CredentialResolver = {
  getApiKey(provider: string): Promise<string | undefined>
  getAuthStatus(provider: string): Promise<AuthStatus>
}

const ENV_MAP: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY'
}

export function createCredentialResolver(authStorage: AuthStorage): CredentialResolver {
  return {
    async getApiKey(provider) {
      const stored = await authStorage.get(provider)
      if (stored) {
        return stored.type === 'oauth' ? stored.access : stored.key
      }

      const envVar = ENV_MAP[provider]
      return envVar ? process.env[envVar] : undefined
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

      return 'none'
    }
  }
}

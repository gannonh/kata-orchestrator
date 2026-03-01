import fs from 'node:fs'
import path from 'node:path'
import { lock } from 'proper-lockfile'

export type AuthCredential =
  | { type: 'api_key'; key: string }
  | { type: 'oauth'; refresh: string; access: string; expires: number }

type AuthData = Record<string, AuthCredential>

export type AuthStorage = {
  get(provider: string): Promise<AuthCredential | null>
  set(provider: string, credential: AuthCredential): Promise<void>
  remove(provider: string): Promise<void>
}

function readData(filePath: string): AuthData {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as AuthData)
      : {}
  } catch {
    return {}
  }
}

function writeData(filePath: string, data: AuthData): void {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  const tmpPath = path.join(dir, `.auth-${Date.now()}.tmp`)
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2))
  fs.renameSync(tmpPath, filePath)
}

function ensureFileExists(filePath: string): void {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '{}')
  }
}

export function createAuthStorage(filePath: string): AuthStorage {
  return {
    async get(provider) {
      const data = readData(filePath)
      return data[provider] ?? null
    },

    async set(provider, credential) {
      ensureFileExists(filePath)
      const release = await lock(filePath, { retries: { retries: 3, minTimeout: 100 } })
      try {
        const data = readData(filePath)
        data[provider] = credential
        writeData(filePath, data)
      } finally {
        await release()
      }
    },

    async remove(provider) {
      ensureFileExists(filePath)
      const release = await lock(filePath, { retries: { retries: 3, minTimeout: 100 } })
      try {
        const data = readData(filePath)
        delete data[provider]
        writeData(filePath, data)
      } finally {
        await release()
      }
    }
  }
}

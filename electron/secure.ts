import fs from 'fs'
import path from 'path'
import { app, safeStorage } from 'electron'

function keyFilePath() {
  return path.join(app.getPath('userData'), 'openai.key.enc')
}

export function saveApiKey(key: string): boolean {
  if (!key.trim()) {
    clearApiKey()
    return true
  }
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback: still store locally (dev / unsupported platforms)
    fs.writeFileSync(keyFilePath(), Buffer.from(key, 'utf8'))
    return true
  }
  const encrypted = safeStorage.encryptString(key.trim())
  fs.writeFileSync(keyFilePath(), encrypted)
  return true
}

export function loadApiKey(): string | null {
  const p = keyFilePath()
  if (!fs.existsSync(p)) return null
  const buf = fs.readFileSync(p)
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buf)
    }
    return buf.toString('utf8')
  } catch {
    return null
  }
}

export function clearApiKey() {
  const p = keyFilePath()
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

export function hasApiKey(): boolean {
  return !!loadApiKey()
}

import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { v4 as uuid } from 'uuid'

/** Keep in sync with src/lib/mediaLimits.ts — renderer must reject before reading bytes. */
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'])
export const MAX_MEDIA_BYTES = 15 * 1024 * 1024
const MAX_BYTES = MAX_MEDIA_BYTES

export type SavedMedia = {
  id: string
  mimeType: string
  filename: string
  size: number
}

export type MediaPayload = {
  id: string
  mimeType: string
  bytes: Uint8Array
}

function mediaDir() {
  const dir = path.join(app.getPath('userData'), 'media')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function extensionFor(mimeType: string, originalName?: string) {
  const fromName = originalName ? path.extname(originalName).toLowerCase() : ''
  if (fromName && /^\.(png|jpe?g|gif|webp)$/.test(fromName)) return fromName
  if (mimeType === 'image/png') return '.png'
  if (mimeType === 'image/gif') return '.gif'
  if (mimeType === 'image/webp') return '.webp'
  return '.jpg'
}

function normalizeMime(mimeType: string) {
  const mime = (mimeType || '').toLowerCase()
  if (mime === 'image/jpg') return 'image/jpeg'
  return mime
}

export function saveMedia(bytes: Buffer, mimeType: string, originalName?: string): SavedMedia {
  const mime = normalizeMime(mimeType)
  if (!ALLOWED_MIME.has(mime) && !ALLOWED_MIME.has(mimeType.toLowerCase())) {
    throw new Error('סוג הקובץ אינו נתמך. אפשר להעלות PNG, JPG, GIF או WEBP.')
  }
  if (!bytes?.length) {
    throw new Error('הקובץ ריק או פגום.')
  }
  if (bytes.length > MAX_BYTES) {
    throw new Error('התמונה גדולה מדי (מעל 15MB).')
  }

  const id = uuid()
  const filename = `${id}${extensionFor(mime, originalName)}`
  const fullPath = path.join(mediaDir(), filename)
  fs.writeFileSync(fullPath, bytes)

  return {
    id: filename,
    mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime,
    filename,
    size: bytes.length,
  }
}

export function readMedia(id: string): MediaPayload {
  const safeId = path.basename(id)
  const fullPath = path.join(mediaDir(), safeId)
  if (!fs.existsSync(fullPath)) {
    throw new Error('התמונה לא נמצאה.')
  }
  const bytes = fs.readFileSync(fullPath)
  const ext = path.extname(safeId).toLowerCase()
  const mimeType =
    ext === '.png'
      ? 'image/png'
      : ext === '.gif'
        ? 'image/gif'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/jpeg'
  return { id: safeId, mimeType, bytes: new Uint8Array(bytes) }
}

export function deleteMedia(id: string) {
  const safeId = path.basename(id)
  const fullPath = path.join(mediaDir(), safeId)
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
}

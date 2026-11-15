/** Keep in sync with electron/media.ts */
export const MAX_MEDIA_BYTES = 15 * 1024 * 1024

export const ALLOWED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
])

export function isAllowedImageFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase()
  if (ALLOWED_IMAGE_MIME.has(mime)) return true
  return /\.(png|jpe?g|gif|webp)$/i.test(file.name)
}

export function imageRejectionMessage(file: File): string | null {
  if (!isAllowedImageFile(file)) {
    return 'סוג הקובץ אינו נתמך. אפשר להעלות PNG, JPG, GIF או WEBP.'
  }
  if (!file.size) {
    return 'הקובץ ריק או פגום.'
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return 'התמונה גדולה מדי (מעל 15MB).'
  }
  return null
}

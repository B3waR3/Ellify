export type TipTapDoc = {
  type: 'doc'
  content?: unknown[]
}

export type CanvasTextElement = {
  id: string
  type: 'text'
  x: number
  y: number
  width: number
  zIndex: number
  content: TipTapDoc
}

export type CanvasImageElement = {
  id: string
  type: 'image'
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  mediaId: string
  mimeType: string
}

export type CanvasElement = CanvasTextElement | CanvasImageElement

export type CanvasPageDocument = {
  version: 1
  type: 'canvas'
  elements: CanvasElement[]
}

export const DEFAULT_TEXT_WIDTH = 320
export const MIN_TEXT_WIDTH = 160
export const MAX_TEXT_WIDTH = 900
export const DEFAULT_IMAGE_WIDTH = 280
export const MIN_IMAGE_SIZE = 64
export const MAX_IMAGE_SIZE = 1200
export const CANVAS_MIN_HEIGHT = 1600

export function emptyTipTapDoc(): TipTapDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

export function emptyCanvas(): CanvasPageDocument {
  return { version: 1, type: 'canvas', elements: [] }
}

export function isTipTapDoc(value: unknown): value is TipTapDoc {
  return !!value && typeof value === 'object' && (value as { type?: string }).type === 'doc'
}

export function isCanvasDocument(value: unknown): value is CanvasPageDocument {
  if (!value || typeof value !== 'object') return false
  const doc = value as Partial<CanvasPageDocument>
  return doc.type === 'canvas' && doc.version === 1 && Array.isArray(doc.elements)
}

export function isEmptyTipTapDoc(doc: TipTapDoc): boolean {
  const content = doc.content || []
  if (content.length === 0) return true
  const plain = tipTapPlainText(doc).trim()
  return plain.length === 0
}

export function tipTapPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const current = node as { type?: string; text?: string; content?: unknown[] }
  if (current.type === 'image') return ''
  const parts: string[] = []
  if (current.text) parts.push(current.text)
  for (const child of current.content || []) {
    const text = tipTapPlainText(child)
    if (text) parts.push(text)
  }
  return parts.join(' ')
}

/** Remove TipTap image nodes so legacy base64 embeds cannot freeze the editor. */
export function stripEmbeddedImages(doc: TipTapDoc): TipTapDoc {
  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== 'object') return node
    const current = node as { type?: string; content?: unknown[] }
    if (current.type === 'image') return null
    if (!current.content) return current
    return {
      ...current,
      content: current.content.map(walk).filter((child) => child != null),
    }
  }
  return walk(doc) as TipTapDoc
}

export function pageContentPlainText(json: string): string {
  try {
    const parsed = JSON.parse(json) as unknown
    if (isCanvasDocument(parsed)) {
      return parsed.elements
        .filter((element): element is CanvasTextElement => element.type === 'text')
        .map((element) => tipTapPlainText(element.content))
        .join(' ')
    }
    if (isTipTapDoc(parsed)) return tipTapPlainText(parsed)
    return ''
  } catch {
    return ''
  }
}

function safeParseJson(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function normalizeTextElement(element: Partial<CanvasTextElement>, index: number): CanvasTextElement {
  const content = isTipTapDoc(element.content)
    ? stripEmbeddedImages(element.content)
    : emptyTipTapDoc()
  return {
    id: element.id || createElementId(),
    type: 'text',
    x: Number.isFinite(element.x) ? Number(element.x) : 48,
    y: Number.isFinite(element.y) ? Number(element.y) : 72 + index * 24,
    width: Number.isFinite(element.width)
      ? Math.min(MAX_TEXT_WIDTH, Math.max(MIN_TEXT_WIDTH, Number(element.width)))
      : DEFAULT_TEXT_WIDTH,
    zIndex: Number.isFinite(element.zIndex) ? Number(element.zIndex) : index + 1,
    content,
  }
}

function normalizeImageElement(
  element: Partial<CanvasImageElement>,
  index: number,
): CanvasImageElement | null {
  if (!element.mediaId || typeof element.mediaId !== 'string') return null
  const width = Number.isFinite(element.width)
    ? Math.min(MAX_IMAGE_SIZE, Math.max(MIN_IMAGE_SIZE, Number(element.width)))
    : DEFAULT_IMAGE_WIDTH
  const height = Number.isFinite(element.height)
    ? Math.min(MAX_IMAGE_SIZE, Math.max(MIN_IMAGE_SIZE, Number(element.height)))
    : DEFAULT_IMAGE_WIDTH
  return {
    id: element.id || createElementId(),
    type: 'image',
    x: Number.isFinite(element.x) ? Number(element.x) : 48,
    y: Number.isFinite(element.y) ? Number(element.y) : 72 + index * 24,
    width,
    height,
    zIndex: Number.isFinite(element.zIndex) ? Number(element.zIndex) : index + 1,
    mediaId: element.mediaId,
    mimeType: element.mimeType || 'image/png',
  }
}

export function parsePageContent(json: string): CanvasPageDocument {
  const parsed = safeParseJson(json)
  if (isCanvasDocument(parsed)) {
    const elements: CanvasElement[] = []
    parsed.elements.forEach((element, index) => {
      if (!element || typeof element !== 'object') return
      if (element.type === 'image') {
        const image = normalizeImageElement(element as CanvasImageElement, index)
        if (image) elements.push(image)
        return
      }
      if (element.type === 'text' || isTipTapDoc((element as CanvasTextElement).content)) {
        elements.push(normalizeTextElement(element as CanvasTextElement, index))
      }
    })
    return { version: 1, type: 'canvas', elements }
  }

  if (isTipTapDoc(parsed)) {
    const cleaned = stripEmbeddedImages(parsed)
    if (isEmptyTipTapDoc(cleaned)) return emptyCanvas()
    return {
      version: 1,
      type: 'canvas',
      elements: [
        {
          id: createElementId(),
          type: 'text',
          x: 48,
          y: 72,
          width: 420,
          zIndex: 1,
          content: cleaned,
        },
      ],
    }
  }

  return emptyCanvas()
}

export function serializeCanvas(doc: CanvasPageDocument): string {
  return JSON.stringify({
    version: 1,
    type: 'canvas',
    elements: doc.elements,
  })
}

export function createTextElement(
  partial?: Partial<Omit<CanvasTextElement, 'type' | 'content'>> & { content?: TipTapDoc },
): CanvasTextElement {
  return {
    id: partial?.id || createElementId(),
    type: 'text',
    x: partial?.x ?? 48,
    y: partial?.y ?? 72,
    width: partial?.width ?? DEFAULT_TEXT_WIDTH,
    zIndex: partial?.zIndex ?? 1,
    content: partial?.content ?? emptyTipTapDoc(),
  }
}

export function createImageElement(
  partial: Omit<CanvasImageElement, 'type' | 'id'> & { id?: string },
): CanvasImageElement {
  return {
    id: partial.id || createElementId(),
    type: 'image',
    x: partial.x,
    y: partial.y,
    width: partial.width,
    height: partial.height,
    zIndex: partial.zIndex,
    mediaId: partial.mediaId,
    mimeType: partial.mimeType,
  }
}

export function createElementId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `el-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function nextZIndex(elements: CanvasElement[]): number {
  return elements.reduce((max, element) => Math.max(max, element.zIndex), 0) + 1
}

export function canvasHeightFor(elements: CanvasElement[]): number {
  const bottom = elements.reduce((max, element) => {
    const height = element.type === 'image' ? element.height : 240
    return Math.max(max, element.y + height)
  }, 0)
  return Math.max(CANVAS_MIN_HEIGHT, bottom + 480)
}

export function fitImageSize(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth = DEFAULT_IMAGE_WIDTH,
): { width: number; height: number } {
  const safeW = Math.max(1, naturalWidth)
  const safeH = Math.max(1, naturalHeight)
  const width = Math.min(maxWidth, Math.max(MIN_IMAGE_SIZE, safeW))
  const height = Math.round((width / safeW) * safeH)
  return {
    width,
    height: Math.min(MAX_IMAGE_SIZE, Math.max(MIN_IMAGE_SIZE, height)),
  }
}

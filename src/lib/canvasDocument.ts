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

export type CanvasPageDocument = {
  version: 1
  type: 'canvas'
  elements: CanvasTextElement[]
}

export const DEFAULT_TEXT_WIDTH = 320
export const MIN_TEXT_WIDTH = 160
export const MAX_TEXT_WIDTH = 900
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
  const current = node as { text?: string; content?: unknown[] }
  const parts: string[] = []
  if (current.text) parts.push(current.text)
  for (const child of current.content || []) {
    const text = tipTapPlainText(child)
    if (text) parts.push(text)
  }
  return parts.join(' ')
}

export function pageContentPlainText(json: string): string {
  try {
    const parsed = JSON.parse(json) as unknown
    if (isCanvasDocument(parsed)) {
      return parsed.elements.map((element) => tipTapPlainText(element.content)).join(' ')
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

export function parsePageContent(json: string): CanvasPageDocument {
  const parsed = safeParseJson(json)
  if (isCanvasDocument(parsed)) {
    return {
      version: 1,
      type: 'canvas',
      elements: parsed.elements
        .filter((element) => element && element.type === 'text')
        .map((element, index) => ({
          id: element.id || createElementId(),
          type: 'text' as const,
          x: Number.isFinite(element.x) ? element.x : 48,
          y: Number.isFinite(element.y) ? element.y : 72 + index * 24,
          width: Number.isFinite(element.width)
            ? Math.min(MAX_TEXT_WIDTH, Math.max(MIN_TEXT_WIDTH, element.width))
            : DEFAULT_TEXT_WIDTH,
          zIndex: Number.isFinite(element.zIndex) ? element.zIndex : index + 1,
          content: isTipTapDoc(element.content) ? element.content : emptyTipTapDoc(),
        })),
    }
  }

  if (isTipTapDoc(parsed)) {
    if (isEmptyTipTapDoc(parsed)) return emptyCanvas()
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
          content: parsed,
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

export function createElementId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `el-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function nextZIndex(elements: CanvasTextElement[]): number {
  return elements.reduce((max, element) => Math.max(max, element.zIndex), 0) + 1
}

export function canvasHeightFor(elements: CanvasTextElement[]): number {
  const bottom = elements.reduce((max, element) => Math.max(max, element.y + 240), 0)
  return Math.max(CANVAS_MIN_HEIGHT, bottom + 480)
}

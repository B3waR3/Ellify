import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ella } from '../lib/api'
import type { CanvasImageElement } from '../lib/canvasDocument'
import { MAX_IMAGE_SIZE, MIN_IMAGE_SIZE } from '../lib/canvasDocument'

type Props = {
  element: CanvasImageElement
  active: boolean
  onActivate: (id: string) => void
  onChangeFrame: (
    id: string,
    frame: Partial<Pick<CanvasImageElement, 'x' | 'y' | 'width' | 'height' | 'zIndex'>>,
  ) => void
  onDelete: (id: string) => void
  onError: (message: string) => void
}

type ResizeCorner = 'se' | 'sw' | 'ne' | 'nw'

type DragState = {
  kind: 'move' | 'resize'
  startX: number
  startY: number
  origX: number
  origY: number
  origWidth: number
  origHeight: number
  aspect: number
  corner?: ResizeCorner
}

export default function NoteImageBox({
  element,
  active,
  onActivate,
  onChangeFrame,
  onDelete,
  onError,
}: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const objectUrlRef = useRef<string | null>(null)
  const dragRef = useRef<DragState | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSrc(null)

    void (async () => {
      try {
        const media = await ella().media.read(element.mediaId)
        if (cancelled) return
        const raw = media.bytes instanceof Uint8Array ? media.bytes : new Uint8Array(media.bytes as ArrayBuffer)
        const copy = new Uint8Array(raw.byteLength)
        copy.set(raw)
        const blob = new Blob([copy.buffer], { type: media.mimeType || element.mimeType })
        const url = URL.createObjectURL(blob)
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = url
        setSrc(url)
        setLoading(false)
      } catch (error) {
        if (cancelled) return
        setLoading(false)
        onError(error instanceof Error ? error.message : 'לא ניתן לטעון את התמונה')
      }
    })()

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [element.mediaId, element.mimeType, onError])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      if (drag.kind === 'move') {
        const dx = drag.startX - event.clientX
        const dy = event.clientY - drag.startY
        onChangeFrame(element.id, {
          x: Math.max(0, drag.origX + dx),
          y: Math.max(0, drag.origY + dy),
        })
        return
      }

      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      const corner = drag.corner || 'sw'
      // Anchored at inline-start/top; leftward and downward drags grow the image.
      const widthDelta = -dx
      const heightHint = corner === 'ne' || corner === 'nw' ? -dy : dy
      const primary =
        Math.abs(widthDelta) >= Math.abs(heightHint) ? widthDelta : heightHint * drag.aspect
      const nextWidth = Math.min(
        MAX_IMAGE_SIZE,
        Math.max(MIN_IMAGE_SIZE, drag.origWidth + primary),
      )
      const nextHeight = Math.min(
        MAX_IMAGE_SIZE,
        Math.max(MIN_IMAGE_SIZE, Math.round(nextWidth / drag.aspect)),
      )
      onChangeFrame(element.id, { width: nextWidth, height: nextHeight })
    }

    const onUp = () => {
      dragRef.current = null
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [element.id, onChangeFrame])

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const target = event.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return
        }
        event.preventDefault()
        onDelete(element.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, element.id, onDelete])

  const startMove = (event: ReactPointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onActivate(element.id)
    dragRef.current = {
      kind: 'move',
      startX: event.clientX,
      startY: event.clientY,
      origX: element.x,
      origY: element.y,
      origWidth: element.width,
      origHeight: element.height,
      aspect: element.width / Math.max(1, element.height),
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'
  }

  const startResize = (event: ReactPointerEvent, corner: ResizeCorner) => {
    event.preventDefault()
    event.stopPropagation()
    onActivate(element.id)
    dragRef.current = {
      kind: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      origX: element.x,
      origY: element.y,
      origWidth: element.width,
      origHeight: element.height,
      aspect: element.width / Math.max(1, element.height),
      corner,
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = corner === 'ne' || corner === 'sw' ? 'nesw-resize' : 'nwse-resize'
  }

  return (
    <div
      className={`note-image-box ${active ? 'is-active' : ''}`}
      style={{
        top: element.y,
        insetInlineStart: element.x,
        width: element.width,
        height: element.height,
        zIndex: active ? element.zIndex + 1000 : element.zIndex,
      }}
      onMouseDown={(event) => {
        event.stopPropagation()
        onActivate(element.id)
      }}
    >
      {loading && <div className="note-image-loading">טוענת תמונה…</div>}
      {src && (
        <img
          src={src}
          alt=""
          draggable={false}
          className="note-image"
          onPointerDown={startMove}
        />
      )}
      {active && (
        <>
          <button
            type="button"
            className="note-image-delete"
            title="מחיקת תמונה"
            aria-label="מחיקת תמונה"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(element.id)
            }}
          >
            ×
          </button>
          <button
            type="button"
            className="note-image-handle note-image-handle-se"
            title="שני גודל"
            aria-label="שינוי גודל תמונה"
            onPointerDown={(event) => startResize(event, 'se')}
          />
          <button
            type="button"
            className="note-image-handle note-image-handle-sw"
            title="שני גודל"
            aria-label="שינוי גודל תמונה"
            onPointerDown={(event) => startResize(event, 'sw')}
          />
          <button
            type="button"
            className="note-image-handle note-image-handle-ne"
            title="שני גודל"
            aria-label="שינוי גודל תמונה"
            onPointerDown={(event) => startResize(event, 'ne')}
          />
          <button
            type="button"
            className="note-image-handle note-image-handle-nw"
            title="שני גודל"
            aria-label="שינוי גודל תמונה"
            onPointerDown={(event) => startResize(event, 'nw')}
          />
        </>
      )}
    </div>
  )
}

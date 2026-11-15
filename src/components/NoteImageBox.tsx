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

type VisualFrame = {
  x: number
  y: number
  width: number
  height: number
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
  const boxRef = useRef<HTMLDivElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const visualRef = useRef<VisualFrame>({
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  })
  const interactingRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const pendingPaintRef = useRef(false)
  const onChangeFrameRef = useRef(onChangeFrame)

  useEffect(() => {
    onChangeFrameRef.current = onChangeFrame
  }, [onChangeFrame])

  const paintFrame = (frame: VisualFrame, kind: 'move' | 'resize' | 'idle') => {
    const box = boxRef.current
    if (!box) return

    if (kind === 'move') {
      const drag = dragRef.current
      const originX = drag?.origX ?? frame.x
      const originY = drag?.origY ?? frame.y
      // inset-inline-start grows toward inline start (left in RTL). CSS
      // translateX is physical (positive = right), so invert the X delta.
      box.style.transform = `translate(${-(frame.x - originX)}px, ${frame.y - originY}px)`
      box.style.top = `${originY}px`
      box.style.insetInlineStart = `${originX}px`
      box.style.width = `${frame.width}px`
      box.style.height = `${frame.height}px`
      return
    }

    box.style.transform = ''
    box.style.willChange = ''
    box.style.top = `${frame.y}px`
    box.style.insetInlineStart = `${frame.x}px`
    box.style.width = `${frame.width}px`
    box.style.height = `${frame.height}px`
  }

  const schedulePaint = (kind: 'move' | 'resize') => {
    if (pendingPaintRef.current) return
    pendingPaintRef.current = true
    rafRef.current = window.requestAnimationFrame(() => {
      pendingPaintRef.current = false
      rafRef.current = null
      if (!dragRef.current) return
      paintFrame(visualRef.current, kind)
    })
  }

  const commitInteraction = () => {
    if (!dragRef.current) return

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      pendingPaintRef.current = false
    }

    const frame = { ...visualRef.current }
    interactingRef.current = false
    dragRef.current = null
    document.body.style.userSelect = ''
    document.body.style.cursor = ''

    // Bake final geometry into layout styles before React props catch up.
    paintFrame(frame, 'idle')
    onChangeFrameRef.current(element.id, frame)
  }

  useEffect(() => {
    if (interactingRef.current) return
    visualRef.current = {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    }
    paintFrame(visualRef.current, 'idle')
  }, [element.x, element.y, element.width, element.height])

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
        visualRef.current = {
          x: Math.max(0, drag.origX + dx),
          y: Math.max(0, drag.origY + dy),
          width: drag.origWidth,
          height: drag.origHeight,
        }
        schedulePaint('move')
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
      visualRef.current = {
        x: drag.origX,
        y: drag.origY,
        width: nextWidth,
        height: nextHeight,
      }
      schedulePaint('resize')
    }

    const onUp = () => {
      if (!dragRef.current) return
      commitInteraction()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [element.id])

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

  const beginInteraction = (
    event: ReactPointerEvent,
    kind: 'move' | 'resize',
    corner?: ResizeCorner,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    onActivate(element.id)
    interactingRef.current = true
    visualRef.current = {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    }
    dragRef.current = {
      kind,
      startX: event.clientX,
      startY: event.clientY,
      origX: element.x,
      origY: element.y,
      origWidth: element.width,
      origHeight: element.height,
      aspect: element.width / Math.max(1, element.height),
      corner,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Some targets (e.g. buttons) may already manage capture; window listeners still work.
    }
    document.body.style.userSelect = 'none'
    if (kind === 'move') {
      document.body.style.cursor = 'grabbing'
      if (boxRef.current) boxRef.current.style.willChange = 'transform'
    } else {
      document.body.style.cursor =
        corner === 'ne' || corner === 'sw' ? 'nesw-resize' : 'nwse-resize'
      if (boxRef.current) boxRef.current.style.willChange = 'width, height'
    }
  }

  return (
    <div
      ref={boxRef}
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
          onPointerDown={(event) => beginInteraction(event, 'move')}
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
            onPointerDown={(event) => beginInteraction(event, 'resize', 'se')}
          />
          <button
            type="button"
            className="note-image-handle note-image-handle-sw"
            title="שני גודל"
            aria-label="שינוי גודל תמונה"
            onPointerDown={(event) => beginInteraction(event, 'resize', 'sw')}
          />
          <button
            type="button"
            className="note-image-handle note-image-handle-ne"
            title="שני גודל"
            aria-label="שינוי גודל תמונה"
            onPointerDown={(event) => beginInteraction(event, 'resize', 'ne')}
          />
          <button
            type="button"
            className="note-image-handle note-image-handle-nw"
            title="שני גודל"
            aria-label="שינוי גודל תמונה"
            onPointerDown={(event) => beginInteraction(event, 'resize', 'nw')}
          />
        </>
      )}
    </div>
  )
}

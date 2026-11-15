import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react'
import type { CanvasTextElement, TipTapDoc } from '../lib/canvasDocument'
import { isEmptyTipTapDoc, MIN_TEXT_WIDTH, MAX_TEXT_WIDTH } from '../lib/canvasDocument'
import { NOTE_EDITOR_EXTENSIONS } from '../lib/tiptapExtensions'

type Props = {
  element: CanvasTextElement
  active: boolean
  autofocus?: boolean
  onActivate: (id: string) => void
  onChangeContent: (id: string, content: TipTapDoc) => void
  onChangeFrame: (id: string, frame: Partial<Pick<CanvasTextElement, 'x' | 'y' | 'width' | 'zIndex'>>) => void
  onEditorReady: (id: string, editor: Editor) => void
  onEditorDestroy: (id: string) => void
  onEmptyBlur: (id: string) => void
}

export default function NoteTextBox({
  element,
  active,
  autofocus,
  onActivate,
  onChangeContent,
  onChangeFrame,
  onEditorReady,
  onEditorDestroy,
  onEmptyBlur,
}: Props) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; origWidth: number } | null>(null)
  const typedRef = useRef(!isEmptyTipTapDoc(element.content))

  const editor = useEditor({
    extensions: NOTE_EDITOR_EXTENSIONS,
    content: element.content as JSONContent,
    editorProps: {
      attributes: {
        dir: 'rtl',
        class: 'note-box-editor',
      },
      handleDOMEvents: {
        mousedown: () => {
          onActivate(element.id)
          return false
        },
        focus: () => {
          onActivate(element.id)
          return false
        },
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON() as unknown as TipTapDoc
      if (!isEmptyTipTapDoc(json)) typedRef.current = true
      onChangeContent(element.id, json)
    },
    onBlur: ({ editor: ed }) => {
      const json = ed.getJSON() as unknown as TipTapDoc
      if (!typedRef.current && isEmptyTipTapDoc(json)) {
        onEmptyBlur(element.id)
      }
    },
  })

  useEffect(() => {
    if (!editor) return
    onEditorReady(element.id, editor)
    return () => onEditorDestroy(element.id)
  }, [editor, element.id, onEditorReady, onEditorDestroy])

  useEffect(() => {
    if (!editor || !autofocus) return
    const timer = window.setTimeout(() => {
      editor.commands.focus('end')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [editor, autofocus])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (dragRef.current) {
        const dx = dragRef.current.startX - event.clientX
        const dy = event.clientY - dragRef.current.startY
        onChangeFrame(element.id, {
          x: Math.max(0, dragRef.current.origX + dx),
          y: Math.max(0, dragRef.current.origY + dy),
        })
      }
      if (resizeRef.current) {
        const delta = resizeRef.current.startX - event.clientX
        const next = Math.min(
          MAX_TEXT_WIDTH,
          Math.max(MIN_TEXT_WIDTH, resizeRef.current.origWidth + delta),
        )
        onChangeFrame(element.id, { width: next })
      }
    }
    const onUp = () => {
      dragRef.current = null
      resizeRef.current = null
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

  const startDrag = (event: ReactPointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onActivate(element.id)
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origX: element.x,
      origY: element.y,
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'
  }

  const startResize = (event: ReactPointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onActivate(element.id)
    resizeRef.current = {
      startX: event.clientX,
      origWidth: element.width,
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'
  }

  return (
    <div
      className={`note-box ${active ? 'is-active' : ''}`}
      style={{
        top: element.y,
        insetInlineStart: element.x,
        width: element.width,
        zIndex: active ? element.zIndex + 1000 : element.zIndex,
      }}
      onMouseDown={(event) => {
        event.stopPropagation()
        onActivate(element.id)
      }}
    >
      {active && (
        <>
          <button
            type="button"
            className="note-box-drag"
            title="גררי לשינוי מיקום"
            aria-label="הזזת תיבת טקסט"
            onPointerDown={startDrag}
          />
          <button
            type="button"
            className="note-box-resize"
            title="שני את הרוחב"
            aria-label="שינוי רוחב תיבת טקסט"
            onPointerDown={startResize}
          />
        </>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}

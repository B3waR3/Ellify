import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import type { Editor } from '@tiptap/react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
} from 'lucide-react'
import { ella } from '../lib/api'
import { PAGE_COLORS } from '../lib/colors'
import NoteTextBox from './NoteTextBox'
import NoteImageBox from './NoteImageBox'
import {
  canvasHeightFor,
  createImageElement,
  createTextElement,
  DEFAULT_TEXT_WIDTH,
  fitImageSize,
  nextZIndex,
  parsePageContent,
  serializeCanvas,
  type CanvasElement,
  type CanvasPageDocument,
  type TipTapDoc,
} from '../lib/canvasDocument'
import { FONT_FAMILIES, FONT_SIZES } from '../lib/tiptapExtensions'
import { imageRejectionMessage, MAX_MEDIA_BYTES } from '../lib/mediaLimits'

type AssistAction = 'explain' | 'summarize' | 'simplify' | 'expand' | 'questions'

type Props = {
  notebookId?: string
  title: string
  updatedAt?: string | null
  contentJson: string
  onTitleChange: (title: string) => void
  onContentChange: (json: string) => void
}

export default function NotesEditor({
  notebookId,
  title,
  updatedAt,
  contentJson,
  onTitleChange,
  onContentChange,
}: Props) {
  const [pageColor, setPageColor] = useState('#ffffff')
  const [ruled, setRuled] = useState(false)
  const [ruleColor, setRuleColor] = useState('#DDD8CF')
  const [textColor, setTextColor] = useState('#3E342F')
  const [highlightColor, setHighlightColor] = useState('#A5B5A0')
  const [suggestion, setSuggestion] = useState('')
  const [assistError, setAssistError] = useState('')
  const [imageError, setImageError] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [doc, setDoc] = useState<CanvasPageDocument>(() => parsePageContent(contentJson))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [editorVersion, setEditorVersion] = useState(0)

  const editorsRef = useRef(new Map<string, Editor>())
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const docRef = useRef(doc)
  const suppressCreateRef = useRef(false)
  const activeIdRef = useRef<string | null>(null)

  useEffect(() => {
    docRef.current = doc
  }, [doc])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const flushSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    onContentChange(serializeCanvas(docRef.current))
  }, [onContentChange])

  const scheduleSave = useCallback(
    (next: CanvasPageDocument) => {
      docRef.current = next
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null
        onContentChange(serializeCanvas(next))
      }, 300)
    },
    [onContentChange],
  )

  useEffect(() => {
    return () => {
      flushSave()
    }
  }, [flushSave])

  const updateDoc = useCallback(
    (updater: (prev: CanvasPageDocument) => CanvasPageDocument) => {
      setDoc((prev) => {
        const next = updater(prev)
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave],
  )

  const activeEditor = activeId ? editorsRef.current.get(activeId) || null : null

  useEffect(() => {
    if (!activeEditor) return
    const bump = () => setEditorVersion((value) => value + 1)
    activeEditor.on('selectionUpdate', bump)
    activeEditor.on('transaction', bump)
    return () => {
      activeEditor.off('selectionUpdate', bump)
      activeEditor.off('transaction', bump)
    }
  }, [activeEditor])

  const onEditorReady = useCallback((id: string, editor: Editor) => {
    editorsRef.current.set(id, editor)
    setEditorVersion((value) => value + 1)
  }, [])

  const onEditorDestroy = useCallback((id: string) => {
    editorsRef.current.delete(id)
  }, [])

  const activate = useCallback(
    (id: string) => {
      const switching = activeIdRef.current !== id
      setActiveId(id)
      if (!switching) return
      updateDoc((prev) => {
        const maxZ = nextZIndex(prev.elements)
        return {
          ...prev,
          elements: prev.elements.map((element) =>
            element.id === id ? { ...element, zIndex: maxZ } : element,
          ),
        }
      })
    },
    [updateDoc],
  )

  const changeContent = useCallback(
    (id: string, content: TipTapDoc) => {
      updateDoc((prev) => ({
        ...prev,
        elements: prev.elements.map((element) =>
          element.id === id ? { ...element, content } : element,
        ),
      }))
    },
    [updateDoc],
  )

  const changeFrame = useCallback(
    (
      id: string,
      frame: Partial<Pick<CanvasElement, 'x' | 'y' | 'width' | 'zIndex'> & { height?: number }>,
    ) => {
      suppressCreateRef.current = true
      window.setTimeout(() => {
        suppressCreateRef.current = false
      }, 80)
      updateDoc((prev) => ({
        ...prev,
        elements: prev.elements.map((element) =>
          element.id === id ? ({ ...element, ...frame } as CanvasElement) : element,
        ),
      }))
    },
    [updateDoc],
  )

  const removeElement = useCallback(
    (id: string) => {
      const target = docRef.current.elements.find((element) => element.id === id)
      updateDoc((prev) => ({
        ...prev,
        elements: prev.elements.filter((element) => element.id !== id),
      }))
      setActiveId((current) => (current === id ? null : current))
      setFocusId((current) => (current === id ? null : current))
      editorsRef.current.delete(id)
      if (target?.type === 'image') {
        void ella()
          .media.delete(target.mediaId)
          .catch(() => undefined)
      }
    },
    [updateDoc],
  )

  const reportImageError = useCallback((message: string) => {
    setImageError(message)
  }, [])

  const createAt = useCallback(
    (x: number, y: number) => {
      const element = createTextElement({
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: DEFAULT_TEXT_WIDTH,
        zIndex: nextZIndex(docRef.current.elements),
      })
      updateDoc((prev) => ({
        ...prev,
        elements: [...prev.elements, element],
      }))
      setActiveId(element.id)
      setFocusId(element.id)
      window.setTimeout(() => {
        setFocusId((current) => (current === element.id ? null : current))
      }, 400)
    },
    [updateDoc],
  )

  const onCanvasClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressCreateRef.current) return
    if (event.target !== event.currentTarget && event.target !== surfaceRef.current) {
      const target = event.target as HTMLElement
      if (!target.classList?.contains('note-canvas-hint')) return
    }
    const surface = surfaceRef.current
    if (!surface) return
    const rect = surface.getBoundingClientRect()
    const x = Math.max(0, rect.right - event.clientX - DEFAULT_TEXT_WIDTH / 2)
    const y = Math.max(0, event.clientY - rect.top - 12)
    createAt(x, y)
  }

  const run = (action: (editor: Editor) => void) => {
    if (!activeEditor) return
    action(activeEditor)
    activeEditor.view.focus()
    setEditorVersion((value) => value + 1)
  }

  const assist = async (action: AssistAction) => {
    if (!activeEditor || !notebookId) return
    const { from, to } = activeEditor.state.selection
    const selection = activeEditor.state.doc.textBetween(from, to, ' ').trim()
    if (!selection) {
      setAssistError('סמני טקסט לפני הבקשה')
      return
    }
    setAssistError('')
    setSuggestion('מעבדת…')
    try {
      setSuggestion(await ella().ai.assist(notebookId, action, selection))
    } catch (error) {
      setSuggestion('')
      setAssistError(error instanceof Error ? error.message : 'שגיאה')
    }
  }

  const insertImage = () => {
    if (imageBusy) return
    setImageError('')
    imageInputRef.current?.click()
  }

  const onImageSelected = async (file: File | null) => {
    if (!file) return
    setImageError('')

    // Validate type and size before any decode, IPC, or canvas update.
    // Reading oversized files into ArrayBuffer and cloning them over IPC
    // was freezing the renderer even when saveMedia later rejected them.
    const rejection = imageRejectionMessage(file)
    if (rejection) {
      setImageError(rejection)
      return
    }

    setImageBusy(true)
    try {
      const bytes = await file.arrayBuffer()
      if (bytes.byteLength > MAX_MEDIA_BYTES) {
        setImageError('התמונה גדולה מדי (מעל 15MB).')
        return
      }

      const saved = await ella().media.save({
        bytes,
        mimeType: file.type || 'image/png',
        name: file.name,
      })
      const natural = await readImageSize(bytes, saved.mimeType)
      const size = fitImageSize(natural.width, natural.height)
      const canvas = canvasRef.current
      const scrollTop = canvas?.scrollTop || 0
      const element = createImageElement({
        x: 64,
        y: Math.max(48, scrollTop + 72),
        width: size.width,
        height: size.height,
        zIndex: nextZIndex(docRef.current.elements),
        mediaId: saved.id,
        mimeType: saved.mimeType,
      })
      updateDoc((prev) => ({
        ...prev,
        elements: [...prev.elements, element],
      }))
      setActiveId(element.id)
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'לא ניתן להוסיף את התמונה')
    } finally {
      setImageBusy(false)
    }
  }

  const pageStyle = {
    backgroundColor: pageColor,
    ['--rule-color' as string]: ruleColor,
  } as CSSProperties

  const surfaceHeight = useMemo(() => canvasHeightFor(doc.elements), [doc.elements])
  void editorVersion

  const currentFontFamily =
    (activeEditor?.getAttributes('textStyle').fontFamily as string | undefined) || ''
  const currentFontSize =
    (activeEditor?.getAttributes('textStyle').fontSize as string | undefined) || ''

  const modifiedLabel = formatUpdatedAt(updatedAt)

  return (
    <div className="editor-panel">
      <header className="page-title-bar">
        <input
          className="page-title-input"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="שם העמוד"
          aria-label="שם העמוד"
        />
        <p className="page-title-meta">
          {modifiedLabel ? `עודכן לאחרונה ${modifiedLabel}` : 'עדיין לא נשמר'}
        </p>
      </header>

      <div className="format-toolbar" role="toolbar" aria-label="עיצוב טקסט">
        <div className="format-group" aria-label="גופן">
          <select
            className="format-select format-select-font"
            disabled={!activeEditor}
            value={currentFontFamily}
            title="גופן"
            onMouseDown={keepSelection}
            onChange={(e) => {
              const value = e.target.value
              run((editor) => {
                if (!value) editor.chain().focus().unsetFontFamily().run()
                else editor.chain().focus().setFontFamily(value).run()
              })
            }}
          >
            <option value="">גופן</option>
            {FONT_FAMILIES.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
          <select
            className="format-select format-select-size"
            disabled={!activeEditor}
            value={currentFontSize}
            title="גודל גופן"
            onMouseDown={keepSelection}
            onChange={(e) => {
              const value = e.target.value
              run((editor) => {
                if (!value) editor.chain().focus().unsetFontSize().run()
                else editor.chain().focus().setFontSize(value).run()
              })
            }}
          >
            <option value="">גודל</option>
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size.replace('px', '')}
              </option>
            ))}
          </select>
        </div>

        <span className="format-sep" aria-hidden="true" />

        <div className="format-group" aria-label="עיצוב טקסט">
          <ToolIcon
            label="מודגש (Ctrl+B)"
            active={!!activeEditor?.isActive('bold')}
            disabled={!activeEditor}
            onClick={() => run((editor) => editor.chain().focus().toggleBold().run())}
          >
            <Bold size={16} strokeWidth={2.25} />
          </ToolIcon>
          <ToolIcon
            label="נטוי (Ctrl+I)"
            active={!!activeEditor?.isActive('italic')}
            disabled={!activeEditor}
            onClick={() => run((editor) => editor.chain().focus().toggleItalic().run())}
          >
            <Italic size={16} strokeWidth={2.25} />
          </ToolIcon>
          <ToolIcon
            label="קו תחתון (Ctrl+U)"
            active={!!activeEditor?.isActive('underline')}
            disabled={!activeEditor}
            onClick={() => run((editor) => editor.chain().focus().toggleUnderline().run())}
          >
            <UnderlineIcon size={16} strokeWidth={2.25} />
          </ToolIcon>
          <ToolIcon
            label="קו חוצה"
            active={!!activeEditor?.isActive('strike')}
            disabled={!activeEditor}
            onClick={() => run((editor) => editor.chain().focus().toggleStrike().run())}
          >
            <Strikethrough size={16} strokeWidth={2.25} />
          </ToolIcon>
        </div>

        <span className="format-sep" aria-hidden="true" />

        <div className="format-group" aria-label="צבע והדגשה">
          <label
            className={`format-icon format-color ${!activeEditor ? 'is-disabled' : ''}`}
            title="צבע טקסט"
            onMouseDown={keepSelection}
          >
            <span className="format-color-letter" style={{ borderBottomColor: textColor }}>
              A
            </span>
            <input
              type="color"
              value={textColor}
              disabled={!activeEditor}
              onChange={(e) => {
                const value = e.target.value
                setTextColor(value)
                run((editor) => editor.chain().focus().setColor(value).run())
              }}
            />
          </label>
          <label
            className={`format-icon format-color ${!activeEditor ? 'is-disabled' : ''} ${
              activeEditor?.isActive('highlight') ? 'is-active' : ''
            }`}
            title="הדגשת רקע"
            onMouseDown={keepSelection}
          >
            <Highlighter size={16} strokeWidth={2.25} />
            <span className="format-color-bar" style={{ background: highlightColor }} />
            <input
              type="color"
              value={highlightColor}
              disabled={!activeEditor}
              onChange={(e) => {
                const value = e.target.value
                setHighlightColor(value)
                run((editor) => editor.chain().focus().toggleHighlight({ color: value }).run())
              }}
            />
          </label>
        </div>

        <span className="format-sep" aria-hidden="true" />

        <div className="format-group" aria-label="פסקה">
          <ToolIcon
            label="רשימה עם תבליטים"
            active={!!activeEditor?.isActive('bulletList')}
            disabled={!activeEditor}
            onClick={() => run((editor) => editor.chain().focus().toggleBulletList().run())}
          >
            <List size={16} strokeWidth={2.25} />
          </ToolIcon>
          <ToolIcon
            label="רשימה ממוספרת"
            active={!!activeEditor?.isActive('orderedList')}
            disabled={!activeEditor}
            onClick={() => run((editor) => editor.chain().focus().toggleOrderedList().run())}
          >
            <ListOrdered size={16} strokeWidth={2.25} />
          </ToolIcon>
          <ToolIcon
            label="יישור לימין"
            active={!!activeEditor?.isActive({ textAlign: 'right' })}
            disabled={!activeEditor}
            onClick={() => run((editor) => editor.chain().focus().setTextAlign('right').run())}
          >
            <AlignRight size={16} strokeWidth={2.25} />
          </ToolIcon>
          <ToolIcon
            label="יישור למרכז"
            active={!!activeEditor?.isActive({ textAlign: 'center' })}
            disabled={!activeEditor}
            onClick={() => run((editor) => editor.chain().focus().setTextAlign('center').run())}
          >
            <AlignCenter size={16} strokeWidth={2.25} />
          </ToolIcon>
          <ToolIcon
            label="יישור לשמאל"
            active={!!activeEditor?.isActive({ textAlign: 'left' })}
            disabled={!activeEditor}
            onClick={() => run((editor) => editor.chain().focus().setTextAlign('left').run())}
          >
            <AlignLeft size={16} strokeWidth={2.25} />
          </ToolIcon>
          <ToolIcon
            label="יישור לשני הצדדים"
            active={!!activeEditor?.isActive({ textAlign: 'justify' })}
            disabled={!activeEditor}
            onClick={() => run((editor) => editor.chain().focus().setTextAlign('justify').run())}
          >
            <AlignJustify size={16} strokeWidth={2.25} />
          </ToolIcon>
        </div>

        <span className="format-sep" aria-hidden="true" />

        <div className="format-group" aria-label="הוספה">
          <ToolIcon
            label="הוספת טבלה"
            disabled={!activeEditor}
            onClick={() =>
              run((editor) =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
              )
            }
          >
            <TableIcon size={16} strokeWidth={2.25} />
          </ToolIcon>
          <ToolIcon
            label={imageBusy ? 'מוסיפה תמונה…' : 'הוספת תמונה'}
            disabled={imageBusy}
            onClick={insertImage}
          >
            <ImageIcon size={16} strokeWidth={2.25} />
          </ToolIcon>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              e.target.value = ''
              void onImageSelected(file)
            }}
          />
        </div>

        <span className="format-sep" aria-hidden="true" />

        <div className="format-group format-group-labels" aria-label="קטע מסומן">
          <ToolText label="הסבר" disabled={!activeEditor} onClick={() => void assist('explain')} />
          <ToolText label="סיכום" disabled={!activeEditor} onClick={() => void assist('summarize')} />
          <ToolText label="פישוט" disabled={!activeEditor} onClick={() => void assist('simplify')} />
          <ToolText label="שאלות" disabled={!activeEditor} onClick={() => void assist('questions')} />
        </div>

        <span className="format-sep" aria-hidden="true" />

        <div className="format-group format-group-labels" aria-label="תצוגת עמוד">
          <ToolText
            label="קווי סרגל"
            active={ruled}
            onClick={() => setRuled((value) => !value)}
          />
          <label className="format-text-btn format-swatch-label" title="צבע עמוד" onMouseDown={keepSelection}>
            צבע עמוד
            <input type="color" value={pageColor} onChange={(e) => setPageColor(e.target.value)} />
          </label>
          <div className="format-page-swatches">
            {PAGE_COLORS.slice(0, 5).map((color) => (
              <button
                key={color}
                type="button"
                className={`format-page-swatch ${pageColor.toUpperCase() === color.toUpperCase() ? 'is-active' : ''}`}
                style={{ background: color }}
                title={color}
                onMouseDown={keepSelection}
                onClick={() => setPageColor(color)}
              />
            ))}
          </div>
        </div>
      </div>

      {(suggestion || assistError || imageError) && (
        <div className="assist-panel">
          {imageError && (
            <div className="image-error-row">
              <p style={{ color: 'var(--danger)', margin: 0 }}>{imageError}</p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setImageError('')}
              >
                סגרי
              </button>
            </div>
          )}
          {assistError && <p style={{ color: 'var(--danger)' }}>{assistError}</p>}
          {suggestion && <p>{suggestion}</p>}
          {suggestion && suggestion !== 'מעבדת…' && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!activeEditor}
              onClick={() => {
                run((editor) => editor.chain().focus().insertContent(`<p>${suggestion}</p>`).run())
                setSuggestion('')
              }}
            >
              הוסיפי לסיכום
            </button>
          )}
        </div>
      )}

      <div className={`editor-scroll note-canvas ${ruled ? 'ruled' : ''}`} style={pageStyle} ref={canvasRef}>
        <div
          ref={surfaceRef}
          className="note-canvas-surface"
          style={{ minHeight: surfaceHeight }}
          onMouseDown={onCanvasClick}
        >
          {doc.elements.length === 0 && (
            <p className="note-canvas-hint">לחצי על מקום ריק בעמוד כדי להתחיל לכתוב</p>
          )}
          {doc.elements.map((element) =>
            element.type === 'image' ? (
              <NoteImageBox
                key={element.id}
                element={element}
                active={activeId === element.id}
                onActivate={activate}
                onChangeFrame={changeFrame}
                onDelete={removeElement}
                onError={reportImageError}
              />
            ) : (
              <NoteTextBox
                key={element.id}
                element={element}
                active={activeId === element.id}
                autofocus={focusId === element.id}
                onActivate={activate}
                onChangeContent={changeContent}
                onChangeFrame={changeFrame}
                onEditorReady={onEditorReady}
                onEditorDestroy={onEditorDestroy}
                onEmptyBlur={removeElement}
              />
            ),
          )}
        </div>
      </div>
    </div>
  )
}

function keepSelection(event: ReactMouseEvent) {
  event.preventDefault()
}

function ToolIcon({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`format-icon ${active ? 'is-active' : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={keepSelection}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ToolText({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`format-text-btn ${active ? 'is-active' : ''}`}
      title={label}
      disabled={disabled}
      onMouseDown={keepSelection}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function readImageSize(
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes], { type: mimeType || 'image/png' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      const width = image.naturalWidth || 1
      const height = image.naturalHeight || 1
      URL.revokeObjectURL(url)
      resolve({ width, height })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('הקובץ פגום או שאינו תמונה תקינה.'))
    }
    image.src = url
  })
}

import { useEffect, useState, type CSSProperties } from 'react'
import { ella } from '../lib/api'
import { useEditor, EditorContent } from '@tiptap/react'
import { PAGE_COLORS } from '../lib/colors'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'

type RibbonTab = 'home' | 'insert' | 'view'

type AssistAction = 'explain' | 'summarize' | 'simplify' | 'expand' | 'questions'

type Props = {
  notebookId?: string
  title: string
  contentJson: string
  onTitleChange: (title: string) => void
  onContentChange: (json: string) => void
}

export default function NotesEditor({
  notebookId,
  title,
  contentJson,
  onTitleChange,
  onContentChange,
}: Props) {
  const [ribbon, setRibbon] = useState<RibbonTab>('home')
  const [pageColor, setPageColor] = useState('#ffffff')
  const [ruled, setRuled] = useState(false)
  const [ruleColor, setRuleColor] = useState('#d8d0e8')
  const [suggestion, setSuggestion] = useState('')
  const [assistError, setAssistError] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Placeholder.configure({ placeholder: 'התחילי לכתוב סיכום…' }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: safeParse(contentJson),
    onUpdate: ({ editor: ed }) => {
      onContentChange(JSON.stringify(ed.getJSON()))
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = JSON.stringify(editor.getJSON())
    if (current !== contentJson) {
      editor.commands.setContent(safeParse(contentJson), false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentJson, editor])

  const assist = async (action: AssistAction) => {
    if (!editor || !notebookId) return
    const { from, to } = editor.state.selection
    const selection = editor.state.doc.textBetween(from, to, ' ').trim()
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

  if (!editor) return null

  const pageStyle = {
    backgroundColor: pageColor,
    ['--rule-color' as string]: ruleColor,
  } as CSSProperties

  return (
    <div className="editor-panel">
      <div className="onenote-ribbon">
        <div className="ribbon-tabs">
          <button
            type="button"
            className={`ribbon-tab ${ribbon === 'home' ? 'active' : ''}`}
            onClick={() => setRibbon('home')}
          >
            בית
          </button>
          <button
            type="button"
            className={`ribbon-tab ${ribbon === 'insert' ? 'active' : ''}`}
            onClick={() => setRibbon('insert')}
          >
            הוספה
          </button>
          <button
            type="button"
            className={`ribbon-tab ${ribbon === 'view' ? 'active' : ''}`}
            onClick={() => setRibbon('view')}
          >
            תצוגה
          </button>
        </div>

        <div className="ribbon-body">
          {ribbon === 'home' && (
            <div className="ribbon-groups">
              <div className="ribbon-group">
                <div className="ribbon-group-controls">
                  <button
                    type="button"
                    className={`tool-btn ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  >
                    כותרת
                  </button>
                  <button
                    type="button"
                    className={`tool-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  >
                    כותרת משנה
                  </button>
                </div>
                <span className="ribbon-group-label">סגנונות</span>
              </div>
              <div className="ribbon-group">
                <div className="ribbon-group-controls">
                  <button
                    type="button"
                    className={`tool-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                  >
                    מודגש
                  </button>
                  <button
                    type="button"
                    className={`tool-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                  >
                    נטוי
                  </button>
                  <button
                    type="button"
                    className={`tool-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                  >
                    קו תחתון
                  </button>
                  <button
                    type="button"
                    className={`tool-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                  >
                    קו חוצה
                  </button>
                  <label className="tool-btn tool-btn-color">
                    צבע טקסט
                    <input
                      type="color"
                      defaultValue="#2a1a22"
                      onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                    />
                  </label>
                </div>
                <span className="ribbon-group-label">גופן</span>
              </div>
              <div className="ribbon-group">
                <div className="ribbon-group-controls">
                  <button
                    type="button"
                    className={`tool-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                  >
                    רשימה
                  </button>
                  <button
                    type="button"
                    className={`tool-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  >
                    ממוספר
                  </button>
                </div>
                <span className="ribbon-group-label">פסקה</span>
              </div>
              <div className="ribbon-group">
                <div className="ribbon-group-controls">
                  <button type="button" className="tool-btn" onClick={() => void assist('explain')}>הסבר</button>
                  <button type="button" className="tool-btn" onClick={() => void assist('summarize')}>סיכום</button>
                  <button type="button" className="tool-btn" onClick={() => void assist('simplify')}>פישוט</button>
                  <button type="button" className="tool-btn" onClick={() => void assist('questions')}>שאלות</button>
                </div>
                <span className="ribbon-group-label">קטע מסומן</span>
              </div>
            </div>
          )}

          {ribbon === 'insert' && (
            <div className="ribbon-groups">
              <div className="ribbon-group">
                <div className="ribbon-group-controls">
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() =>
                      editor
                        .chain()
                        .focus()
                        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                        .run()
                    }
                  >
                    טבלה
                  </button>
                  <button type="button" className="tool-btn" disabled title="בקרוב">
                    מפת חשיבה
                  </button>
                  <button type="button" className="tool-btn" disabled title="בקרוב">
                    תרשים
                  </button>
                </div>
                <span className="ribbon-group-label">תוכן</span>
              </div>
              <p className="ribbon-hint">פיצ׳רים נוספים להוספה יוגדרו כאן בהמשך</p>
            </div>
          )}

          {ribbon === 'view' && (
            <div className="ribbon-groups">
              <div className="ribbon-group">
                <div className="ribbon-group-controls">
                  <button
                    type="button"
                    className={`tool-btn ${ruled ? 'is-active' : ''}`}
                    onClick={() => setRuled((v) => !v)}
                  >
                    קווי סרגל
                  </button>
                  <label className="tool-btn tool-btn-color">
                    צבע קווים
                    <input
                      type="color"
                      value={ruleColor}
                      onChange={(e) => setRuleColor(e.target.value)}
                      disabled={!ruled}
                    />
                  </label>
                </div>
                <span className="ribbon-group-label">סרגל</span>
              </div>
              <div className="ribbon-group">
                <div className="ribbon-group-controls page-color-swatches">
                  {PAGE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`page-swatch ${pageColor.toUpperCase() === c.toUpperCase() ? 'active' : ''}`}
                      style={{ background: c }}
                      title={c}
                      onClick={() => setPageColor(c)}
                    />
                  ))}
                  <label className="tool-btn tool-btn-color">
                    HEX
                    <input
                      type="color"
                      value={pageColor}
                      onChange={(e) => setPageColor(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => {
                      setPageColor('#ffffff')
                      setRuled(false)
                    }}
                  >
                    איפוס תצוגה
                  </button>
                </div>
                <span className="ribbon-group-label">עמוד</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {(suggestion || assistError) && (
        <div className="assist-panel">
          {assistError && <p style={{ color: 'var(--danger)' }}>{assistError}</p>}
          {suggestion && <p>{suggestion}</p>}
          {suggestion && suggestion !== 'מעבדת…' && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                editor.chain().focus().insertContent(`<p>${suggestion}</p>`).run()
                setSuggestion('')
              }}
            >
              הוסיפי לסיכום
            </button>
          )}
        </div>
      )}

      <div className={`editor-scroll ${ruled ? 'ruled' : ''}`} style={pageStyle}>
        <input
          className="editor-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="שם העמוד"
        />
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function safeParse(json: string) {
  try {
    return JSON.parse(json)
  } catch {
    return { type: 'doc', content: [{ type: 'paragraph' }] }
  }
}

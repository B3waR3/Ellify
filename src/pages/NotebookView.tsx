import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ella } from '../lib/api'
import NotesEditor from '../components/NotesEditor'
import StudyWorkspace from '../components/StudyWorkspace'
import type { AppSettings, Chapter, Notebook, Page } from '../../electron/types'

type Props = {
  settings: AppSettings
  onChanged: () => Promise<void>
}

type MainTab = 'notes' | 'learn'

type EditTarget =
  | { kind: 'chapter'; id: string; value: string }
  | { kind: 'page'; id: string; chapterId: string; value: string }
  | { kind: 'new-chapter'; value: string }
  | { kind: 'new-page'; chapterId: string; value: string }
  | null

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 480
const SIDEBAR_DEFAULT = 260

export default function NotebookView({ settings, onChanged }: Props) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [notebook, setNotebook] = useState<Notebook | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [pagesByChapter, setPagesByChapter] = useState<Record<string, Page[]>>({})
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [tab, setTab] = useState<MainTab>('notes')
  const [examDate, setExamDate] = useState('')
  const [editingNotebookName, setEditingNotebookName] = useState(false)
  const [notebookNameDraft, setNotebookNameDraft] = useState('')
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const dragging = useRef(false)

  const activePage = useMemo(() => {
    for (const pages of Object.values(pagesByChapter)) {
      const found = pages.find((p) => p.id === activePageId)
      if (found) return found
    }
    return null
  }, [pagesByChapter, activePageId])

  const refreshTree = useCallback(async () => {
    if (!id) return
    const nb = await ella().notebooks.get(id)
    if (!nb) return
    setNotebook(nb)
    setNotebookNameDraft(nb.name)
    setExamDate(nb.exam_date ? nb.exam_date.slice(0, 10) : '')
    const chs = await ella().chapters.list(id)
    setChapters(chs)
    const map: Record<string, Page[]> = {}
    for (const ch of chs) {
      map[ch.id] = await ella().pages.list(ch.id)
    }
    setPagesByChapter(map)
    setActivePageId((prev) => {
      if (prev && Object.values(map).some((pages) => pages.some((p) => p.id === prev))) {
        return prev
      }
      return chs[0] && map[chs[0].id]?.[0]?.id ? map[chs[0].id][0].id : null
    })
  }, [id])

  useEffect(() => {
    refreshTree().catch(console.error)
  }, [refreshTree])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      // RTL: sidebar is on the right; drag left increases width
      const fromRight = window.innerWidth - e.clientX
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, fromRight))
      setSidebarWidth(next)
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const startResize = (e: ReactMouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const saveExamDate = async () => {
    if (!notebook) return
    const updated = await ella().notebooks.update(notebook.id, {
      exam_date: examDate ? new Date(examDate).toISOString() : null,
    })
    if (updated) setNotebook(updated)
  }

  const saveNotebookName = async () => {
    if (!notebook) return
    const name = notebookNameDraft.trim()
    if (!name || name === notebook.name) {
      setNotebookNameDraft(notebook.name)
      setEditingNotebookName(false)
      return
    }
    const updated = await ella().notebooks.update(notebook.id, { name })
    if (updated) setNotebook(updated)
    setEditingNotebookName(false)
  }

  const commitEdit = async () => {
    if (!editTarget || !notebook) return
    const value = editTarget.value.trim()

    if (editTarget.kind === 'chapter') {
      if (!value) {
        setEditTarget(null)
        return
      }
      await ella().chapters.update(editTarget.id, value)
      setEditTarget(null)
      await refreshTree()
      return
    }

    if (editTarget.kind === 'page') {
      if (!value) {
        setEditTarget(null)
        return
      }
      const updated = await ella().pages.update(editTarget.id, { title: value })
      if (updated) {
        setPagesByChapter((prev) => ({
          ...prev,
          [updated.chapter_id]: (prev[updated.chapter_id] || []).map((p) =>
            p.id === updated.id ? updated : p,
          ),
        }))
      }
      setEditTarget(null)
      return
    }

    if (editTarget.kind === 'new-chapter') {
      if (!value) {
        setEditTarget(null)
        return
      }
      const ch = await ella().chapters.create(notebook.id, value)
      const page = await ella().pages.create(ch.id, 'עמוד 1')
      setEditTarget(null)
      await refreshTree()
      setActivePageId(page.id)
      return
    }

    if (editTarget.kind === 'new-page') {
      if (!value) {
        setEditTarget(null)
        return
      }
      const page = await ella().pages.create(editTarget.chapterId, value)
      setEditTarget(null)
      await refreshTree()
      setActivePageId(page.id)
    }
  }

  const cancelEdit = () => setEditTarget(null)

  const deleteChapter = async (chapter: Chapter) => {
    const pageCount = (pagesByChapter[chapter.id] || []).length
    const ok = confirm(
      pageCount > 0
        ? `למחוק את הפרק "${chapter.title}" ואת ${pageCount} העמודים שבו?`
        : `למחוק את הפרק "${chapter.title}"?`,
    )
    if (!ok) return
    setEditTarget(null)
    await ella().chapters.delete(chapter.id)
    await refreshTree()
  }

  const deletePage = async (page: Page) => {
    const ok = confirm(`למחוק את העמוד "${page.title}"?`)
    if (!ok) return
    setEditTarget(null)
    await ella().pages.delete(page.id)
    await refreshTree()
  }

  const deleteNotebook = async () => {
    if (!notebook) return
    if (!confirm(`למחוק את המחברת "${notebook.name}"?`)) return
    await ella().notebooks.delete(notebook.id)
    navigate('/')
  }

  const onTitleChange = async (title: string) => {
    if (!activePage) return
    const updated = await ella().pages.update(activePage.id, { title })
    if (updated) {
      setPagesByChapter((prev) => ({
        ...prev,
        [updated.chapter_id]: (prev[updated.chapter_id] || []).map((p) =>
          p.id === updated.id ? updated : p,
        ),
      }))
    }
  }

  const onContentChange = async (content_json: string) => {
    if (!activePage) return
    await ella().pages.update(activePage.id, { content_json })
  }

  if (!notebook) {
    return (
      <div className="notebook-fullscreen loading-fill">
        <p className="subtitle">טוענת מחברת…</p>
      </div>
    )
  }

  return (
    <div className="notebook-fullscreen">
      <header className="onenote-appbar" style={{ borderBottomColor: notebook.color }}>
        <div className="onenote-appbar-right">
          <Link to="/" className="back-link">
            ← כל המחברות
          </Link>
          <span className="nb-dot" style={{ background: notebook.color }} />
          {editingNotebookName ? (
            <input
              className="onenote-title-input"
              value={notebookNameDraft}
              autoFocus
              onChange={(e) => setNotebookNameDraft(e.target.value)}
              onBlur={() => void saveNotebookName()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveNotebookName()
                if (e.key === 'Escape') {
                  setNotebookNameDraft(notebook.name)
                  setEditingNotebookName(false)
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="onenote-title-btn"
              title="לחצי לשינוי שם המחברת"
              onClick={() => {
                setNotebookNameDraft(notebook.name)
                setEditingNotebookName(true)
              }}
            >
              <h1 className="onenote-title">{notebook.name}</h1>
              <span className="rename-hint">עריכה</span>
            </button>
          )}
        </div>
        <div className="onenote-appbar-left">
          <div className="field field-inline">
            <label>תאריך מבחן</label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              onBlur={saveExamDate}
            />
          </div>
          <Link className="btn btn-ghost btn-sm" to="/settings">
            הגדרות
          </Link>
          <button className="btn btn-danger btn-sm" onClick={deleteNotebook}>
            מחקי מחברת
          </button>
        </div>
      </header>

      <div className="onenote-main-tabs">
        <button
          type="button"
          className={`main-tab ${tab === 'notes' ? 'active' : ''}`}
          onClick={() => setTab('notes')}
        >
          סיכומים
        </button>
        <button
          type="button"
          className={`main-tab ${tab === 'learn' ? 'active' : ''}`}
          onClick={() => setTab('learn')}
        >
          סביבת למידה
        </button>
      </div>

      {tab === 'notes' && (
        <div className="notebook-layout notebook-layout-fill notebook-layout-resize">
          <aside className="sidebar sidebar-fill" style={{ width: sidebarWidth, flex: `0 0 ${sidebarWidth}px` }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%' }}
              onClick={() => setEditTarget({ kind: 'new-chapter', value: 'פרק חדש' })}
            >
              + פרק
            </button>

            {editTarget?.kind === 'new-chapter' && (
              <InlineNameInput
                value={editTarget.value}
                onChange={(value) => setEditTarget({ ...editTarget, value })}
                onCommit={() => void commitEdit()}
                onCancel={cancelEdit}
                placeholder="שם הפרק"
              />
            )}

            {chapters.map((ch) => (
              <div key={ch.id} className="sidebar-chapter-block">
                <div className="sidebar-chapter-row">
                  {editTarget?.kind === 'chapter' && editTarget.id === ch.id ? (
                    <InlineNameInput
                      value={editTarget.value}
                      onChange={(value) => setEditTarget({ ...editTarget, value })}
                      onCommit={() => void commitEdit()}
                      onCancel={cancelEdit}
                      placeholder="שם הפרק"
                    />
                  ) : (
                    <>
                      <h3 className="sidebar-chapter-title">{ch.title}</h3>
                      <button
                        type="button"
                        className="sidebar-edit-btn"
                        title="שינוי שם פרק"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditTarget({ kind: 'chapter', id: ch.id, value: ch.title })
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="sidebar-edit-btn sidebar-delete-btn"
                        title="מחיקת פרק"
                        onClick={(e) => {
                          e.stopPropagation()
                          void deleteChapter(ch)
                        }}
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>

                {(pagesByChapter[ch.id] || []).map((p) => (
                  <div key={p.id} className="sidebar-page-row">
                    {editTarget?.kind === 'page' && editTarget.id === p.id ? (
                      <InlineNameInput
                        value={editTarget.value}
                        onChange={(value) => setEditTarget({ ...editTarget, value })}
                        onCommit={() => void commitEdit()}
                        onCancel={cancelEdit}
                        placeholder="שם העמוד"
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`sidebar-item page-item ${activePageId === p.id ? 'active' : ''}`}
                          onClick={() => setActivePageId(p.id)}
                        >
                          {p.title}
                        </button>
                        <button
                          type="button"
                          className="sidebar-edit-btn"
                          title="שינוי שם עמוד"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditTarget({
                              kind: 'page',
                              id: p.id,
                              chapterId: ch.id,
                              value: p.title,
                            })
                          }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="sidebar-edit-btn sidebar-delete-btn"
                          title="מחיקת עמוד"
                          onClick={(e) => {
                            e.stopPropagation()
                            void deletePage(p)
                          }}
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                ))}

                {editTarget?.kind === 'new-page' && editTarget.chapterId === ch.id ? (
                  <InlineNameInput
                    value={editTarget.value}
                    onChange={(value) => setEditTarget({ ...editTarget, value })}
                    onCommit={() => void commitEdit()}
                    onCancel={cancelEdit}
                    placeholder="שם העמוד"
                  />
                ) : (
                  <button
                    type="button"
                    className="sidebar-item page-item add-page-btn"
                    onClick={() =>
                      setEditTarget({ kind: 'new-page', chapterId: ch.id, value: 'עמוד חדש' })
                    }
                  >
                    + עמוד
                  </button>
                )}
              </div>
            ))}
          </aside>

          <div
            className="sidebar-resizer"
            onMouseDown={startResize}
            title="גררי לשינוי רוחב"
            role="separator"
            aria-orientation="vertical"
          />

          <div className="editor-host">
            {activePage ? (
              <NotesEditor
                key={activePage.id}
                notebookId={notebook.id}
                title={activePage.title}
                contentJson={activePage.content_json}
                onTitleChange={onTitleChange}
                onContentChange={onContentChange}
              />
            ) : (
              <p className="empty">בחרי או צרי עמוד</p>
            )}
          </div>
        </div>
      )}

      {tab === 'learn' && (
        <div className="learn-panel learn-panel-fill">
          <StudyWorkspace notebook={notebook} settings={settings} onChanged={onChanged} />
        </div>
      )}
    </div>
  )
}

function InlineNameInput({
  value,
  onChange,
  onCommit,
  onCancel,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  placeholder: string
}) {
  return (
    <div className="inline-name-row">
      <input
        className="inline-name-input"
        value={value}
        autoFocus
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onCommit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        onBlur={() => onCommit()}
      />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ella } from '../lib/api'
import { NOTEBOOK_COLORS } from '../lib/colors'
import ColorPicker from '../components/ColorPicker'
import type { Notebook } from '../../electron/types'

type Props = {
  onChanged: () => Promise<void>
}

type ManageMode = 'rename' | 'color' | null

export default function Home({ onChanged }: Props) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(NOTEBOOK_COLORS[1])
  const [menuId, setMenuId] = useState<string | null>(null)
  const [managing, setManaging] = useState<Notebook | null>(null)
  const [manageMode, setManageMode] = useState<ManageMode>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(NOTEBOOK_COLORS[1])
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement | null>(null)

  const load = async () => {
    setNotebooks(await ella().notebooks.list())
  }

  useEffect(() => {
    load().catch(console.error)
  }, [])

  useEffect(() => {
    if (!menuId) return
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuId(null)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuId(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuId])

  const create = async () => {
    if (!name.trim()) return
    const nb = await ella().notebooks.create(name.trim(), color)
    setShowCreate(false)
    setName('')
    setColor(NOTEBOOK_COLORS[1])
    await load()
    await onChanged()
    navigate(`/notebook/${nb.id}`)
  }

  const openRename = (nb: Notebook) => {
    setMenuId(null)
    setManaging(nb)
    setManageMode('rename')
    setEditName(nb.name)
  }

  const openColor = (nb: Notebook) => {
    setMenuId(null)
    setManaging(nb)
    setManageMode('color')
    setEditColor(nb.color)
  }

  const closeManage = () => {
    setManaging(null)
    setManageMode(null)
  }

  const saveRename = async () => {
    if (!managing || !editName.trim()) return
    const next = editName.trim()
    if (next !== managing.name) {
      await ella().notebooks.update(managing.id, { name: next })
      await load()
      await onChanged()
    }
    closeManage()
  }

  const saveColor = async () => {
    if (!managing) return
    if (editColor !== managing.color) {
      await ella().notebooks.update(managing.id, { color: editColor })
      await load()
      await onChanged()
    }
    closeManage()
  }

  const remove = async (nb: Notebook) => {
    setMenuId(null)
    if (!confirm(`למחוק את המחברת "${nb.name}"?`)) return
    await ella().notebooks.delete(nb.id)
    await load()
    await onChanged()
  }

  return (
    <div className="page">
      <h1 className="hero-title">המחברות שלי</h1>
      <p className="subtitle">בחרי מחברת או צרי אחת חדשה לכל מקצוע</p>

      <div className="grid-notebooks">
        <button type="button" className="notebook-card create-card" onClick={() => setShowCreate(true)}>
          + מחברת חדשה
        </button>
        {notebooks.map((nb) => (
          <article
            key={nb.id}
            className="notebook-card"
            style={{ ['--nb-color' as string]: nb.color }}
          >
            <button type="button" className="notebook-open" onClick={() => navigate(`/notebook/${nb.id}`)}>
              <div className="notebook-card-top">
                <span className="notebook-color-swatch" style={{ background: nb.color }} aria-hidden="true" />
                <h3>{nb.name}</h3>
              </div>
              <div className="notebook-meta">
                {nb.exam_date
                  ? `מבחן: ${new Date(nb.exam_date).toLocaleDateString('he-IL')}`
                  : 'ללא תאריך מבחן'}
              </div>
            </button>

            <div className="notebook-menu" ref={menuId === nb.id ? menuRef : null}>
              <button
                type="button"
                className="notebook-menu-trigger"
                aria-label={`פעולות עבור ${nb.name}`}
                aria-haspopup="menu"
                aria-expanded={menuId === nb.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuId((prev) => (prev === nb.id ? null : nb.id))
                }}
              >
                ⋯
              </button>
              {menuId === nb.id && (
                <div className="notebook-menu-panel" role="menu">
                  <button type="button" role="menuitem" onClick={() => openRename(nb)}>
                    שינוי שם
                  </button>
                  <button type="button" role="menuitem" onClick={() => openColor(nb)}>
                    שינוי צבע
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="notebook-menu-danger"
                    onClick={() => void remove(nb)}
                  >
                    מחיקת מחברת
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>מחברת חדשה</h2>
            <div className="field">
              <label htmlFor="nb-name">שם המקצוע / המחברת</label>
              <input
                id="nb-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="למשל: מבוא לפסיכולוגיה"
                autoFocus
              />
            </div>
            <div className="field">
              <label>צבע המחברת</label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={create}>
                צרי
              </button>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {managing && manageMode === 'rename' && (
        <div className="modal-backdrop" onClick={closeManage}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>שינוי שם</h2>
            <div className="field">
              <label htmlFor="edit-name">שם המחברת</label>
              <input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveRename()
                  if (e.key === 'Escape') closeManage()
                }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => void saveRename()}>
                שמרי
              </button>
              <button className="btn btn-ghost" onClick={closeManage}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {managing && manageMode === 'color' && (
        <div className="modal-backdrop" onClick={closeManage}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>שינוי צבע</h2>
            <div className="field">
              <label>צבע המחברת</label>
              <ColorPicker value={editColor} onChange={setEditColor} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => void saveColor()}>
                שמרי
              </button>
              <button className="btn btn-ghost" onClick={closeManage}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

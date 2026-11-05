import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ella } from '../lib/api'
import { NOTEBOOK_COLORS } from '../lib/colors'
import ColorPicker from '../components/ColorPicker'
import type { Notebook } from '../../electron/types'

type Props = {
  onChanged: () => Promise<void>
}

export default function Home({ onChanged }: Props) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(NOTEBOOK_COLORS[1])
  const [editing, setEditing] = useState<Notebook | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(NOTEBOOK_COLORS[1])
  const navigate = useNavigate()

  const load = async () => {
    setNotebooks(await ella().notebooks.list())
  }

  useEffect(() => {
    load().catch(console.error)
  }, [])

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

  const openEdit = (nb: Notebook) => {
    setEditing(nb)
    setEditName(nb.name)
    setEditColor(nb.color)
  }

  const saveEdit = async () => {
    if (!editing || !editName.trim()) return
    await ella().notebooks.update(editing.id, { name: editName.trim(), color: editColor })
    setEditing(null)
    await load()
  }

  const remove = async (nb: Notebook) => {
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
              <h3>{nb.name}</h3>
              <div className="notebook-meta">
                {nb.exam_date
                  ? `מבחן: ${new Date(nb.exam_date).toLocaleDateString('he-IL')}`
                  : 'ללא תאריך מבחן'}
              </div>
            </button>
            <div className="notebook-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(nb)}>
                שם וצבע
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(nb)}>
                מחקי
              </button>
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

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>עריכת מחברת</h2>
            <div className="field">
              <label htmlFor="edit-name">שם</label>
              <input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="field">
              <label>צבע</label>
              <ColorPicker value={editColor} onChange={setEditColor} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => void saveEdit()}>
                שמרי
              </button>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

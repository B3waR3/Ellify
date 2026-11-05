import { useEffect, useState } from 'react'
import { ella } from '../lib/api'
import type { InstructorProfile, Material } from '../../electron/types'

type Props = {
  notebookId: string
}

export default function MaterialsPanel({ notebookId }: Props) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [pastExams, setPastExams] = useState<Material[]>([])
  const [profile, setProfile] = useState<InstructorProfile | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setMaterials(await ella().materials.list(notebookId, 'material'))
    setPastExams(await ella().materials.list(notebookId, 'past_exam'))
    setProfile(await ella().profile.get(notebookId))
  }

  useEffect(() => {
    load().catch(console.error)
  }, [notebookId])

  const addFiles = async (kind: 'material' | 'past_exam') => {
    setError('')
    setBusy(true)
    try {
      await ella().materials.add(notebookId, kind)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בהעלאה')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    await ella().materials.delete(id)
    await load()
  }

  const startRename = (item: Material) => {
    setRenamingId(item.id)
    setRenameValue(item.display_name || item.filename)
  }

  const commitRename = async (item: Material) => {
    const next = renameValue.trim()
    setRenamingId(null)
    if (!next || next === (item.display_name || item.filename)) return
    await ella().materials.update(item.id, { display_name: next })
    await load()
  }

  const toggle = async (item: Material) => {
    await ella().materials.update(item.id, { enabled: !item.enabled })
    await load()
  }

  const analyze = async () => {
    setError('')
    setBusy(true)
    try {
      setProfile(await ella().ai.analyzeInstructor(notebookId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בניתוח')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 className="panel-title">מקורות</h2>
      <p className="subtitle">
        חומרי לימוד הם מקור התוכן. שחזורי מבחנים משמשים לניתוח סגנון השאלות, לא כעובדות.
        הסיכומים במחברת נכללים אוטומטית כמקור.
      </p>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button className="btn btn-primary" disabled={busy} onClick={() => addFiles('material')}>
          העלי חומרי לימוד
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => addFiles('past_exam')}>
          העלי שחזורים
        </button>
      </div>
      <FileList
        title="חומרי לימוד"
        items={materials}
        renamingId={renamingId}
        renameValue={renameValue}
        onRenameValue={setRenameValue}
        onStartRename={startRename}
        onCommitRename={commitRename}
        onDelete={remove}
        onToggle={toggle}
      />
      <FileList
        title="שחזורי מבחנים"
        items={pastExams}
        renamingId={renamingId}
        renameValue={renameValue}
        onRenameValue={setRenameValue}
        onStartRename={startRename}
        onCommitRename={commitRename}
        onDelete={remove}
        onToggle={toggle}
      />
      <button className="btn btn-ghost" disabled={busy} onClick={() => void analyze()}>
        נתחי סגנון שאלות מהשחזורים
      </button>
      {profile && (
        <div className="profile-card">
          <p>{profile.summary}</p>
          <p className="subtitle">{profile.limitations}</p>
          {profile.styles.length > 0 && <p>סגנונות: {profile.styles.join(' · ')}</p>}
          {profile.topics.map((topic) => (
            <div key={topic.topic} className="list-row">
              <span>{topic.topic}</span>
              <span className="chip">{topic.confidence === 'high' ? 'ביטחון גבוה' : topic.confidence === 'medium' ? 'ביטחון בינוני' : 'ביטחון נמוך'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FileList({
  title,
  items,
  renamingId,
  renameValue,
  onRenameValue,
  onStartRename,
  onCommitRename,
  onDelete,
  onToggle,
}: {
  title: string
  items: Material[]
  renamingId: string | null
  renameValue: string
  onRenameValue: (value: string) => void
  onStartRename: (item: Material) => void
  onCommitRename: (item: Material) => void
  onDelete: (id: string) => void
  onToggle: (item: Material) => void
}) {
  if (!items.length) return <p className="subtitle">{title}: אין קבצים עדיין</p>
  return (
    <div style={{ marginBottom: '0.8rem' }}>
      <strong>{title}</strong>
      {items.map((m) => (
        <div key={m.id} className="list-row">
          {renamingId === m.id ? (
            <input
              value={renameValue}
              autoFocus
              onChange={(e) => onRenameValue(e.target.value)}
              onBlur={() => onCommitRename(m)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommitRename(m)
              }}
            />
          ) : (
            <label className="check-line">
              <input type="checkbox" checked={m.enabled} onChange={() => onToggle(m)} />
              {m.display_name || m.filename}
            </label>
          )}
          <span>
            <button className="btn btn-ghost" onClick={() => onStartRename(m)}>שם</button>
            <button className="btn btn-ghost" onClick={() => onDelete(m.id)}>מחקי</button>
          </span>
        </div>
      ))}
    </div>
  )
}

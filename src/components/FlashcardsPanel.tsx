import { useEffect, useState } from 'react'
import { ella } from '../lib/api'
import { contrastText } from '../lib/colors'
import type { Flashcard, Notebook } from '../../electron/types'

type Props = {
  notebook: Notebook
  onChanged: () => Promise<void>
}

export default function FlashcardsPanel({ notebook, onChanged }: Props) {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [due, setDue] = useState<Flashcard[]>([])
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [topic, setTopic] = useState('')
  const [intervals, setIntervals] = useState<number[]>([1, 2, 4, 8, 16])
  const [mode, setMode] = useState<'list' | 'review'>('list')
  const [reviewIndex, setReviewIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const textColor = contrastText(notebook.color)

  const load = async () => {
    setCards(await ella().flashcards.list(notebook.id))
    setDue(await ella().flashcards.due(notebook.id))
    setIntervals(await ella().flashcards.intervals())
  }

  useEffect(() => {
    load().catch(console.error)
  }, [notebook.id])

  const create = async () => {
    if (!front.trim() || !back.trim()) return
    await ella().flashcards.create(notebook.id, front.trim(), back.trim(), topic.trim())
    setFront('')
    setBack('')
    await load()
    await onChanged()
  }

  const remove = async (id: string) => {
    await ella().flashcards.delete(id)
    await load()
    await onChanged()
  }

  const startReview = async () => {
    const d = await ella().flashcards.due(notebook.id)
    setDue(d)
    setReviewIndex(0)
    setFlipped(false)
    setMode('review')
  }

  const answer = async (correct: boolean) => {
    const card = due[reviewIndex]
    if (!card) return
    await ella().flashcards.review(card.id, correct)
    const next = reviewIndex + 1
    setFlipped(false)
    if (next >= due.length) {
      setMode('list')
      await load()
      await onChanged()
    } else {
      setReviewIndex(next)
      await onChanged()
    }
  }

  if (mode === 'review') {
    const card = due[reviewIndex]
    if (!card) {
      return (
        <div className="empty">
          <p>אין עוד כרטיסיות לתרגול כרגע.</p>
          <button className="btn btn-primary" onClick={() => setMode('list')}>
            חזרה לרשימה
          </button>
        </div>
      )
    }
    return (
      <div>
        <p className="subtitle" style={{ textAlign: 'center' }}>
          כרטיסייה {reviewIndex + 1} מתוך {due.length}
        </p>
        <div
          className="review-card"
          style={{ background: notebook.color, color: textColor }}
          onClick={() => setFlipped((f) => !f)}
          role="button"
          tabIndex={0}
        >
          <h2>{flipped ? card.back : card.front}</h2>
          <p style={{ opacity: 0.8 }}>{flipped ? 'הקשי לסימון' : 'לחצי להצגת התשובה'}</p>
        </div>
        {flipped && (
          <div className="review-actions">
            <button className="btn btn-danger" onClick={() => answer(false)}>
              טעיתי
            </button>
            <button className="btn btn-primary" onClick={() => answer(true)}>
              צדקתי
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={startReview} disabled={due.length === 0}>
          תרגול להיום ({due.length})
        </button>
      </div>

      <div className="settings-card" style={{ marginBottom: '1.2rem', maxWidth: '100%' }}>
        <h3 style={{ marginBottom: '0.8rem', color: 'var(--pink-700)' }}>כרטיסייה חדשה</h3>
        <div className="field">
          <label>נושא</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="למשל: התניה" />
        </div>
        <div className="field">
          <label>שאלה / צד קדמי</label>
          <textarea value={front} onChange={(e) => setFront(e.target.value)} />
        </div>
        <div className="field">
          <label>תשובה / צד אחורי</label>
          <textarea value={back} onChange={(e) => setBack(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={create}>
          הוסיפי כרטיסייה
        </button>
      </div>

      {cards.length === 0 ? (
        <p className="empty">עדיין אין כרטיסיות. צרי אותן ידנית — הצבע יתאים למחברת.</p>
      ) : (
        <div className="flash-grid">
          {cards.map((c) => (
            <div
              key={c.id}
              className="flash-card"
              style={{ background: notebook.color, color: textColor }}
            >
              <div>
                <strong>{c.front}</strong>
                <div style={{ marginTop: 8, opacity: 0.9, fontSize: '0.92rem' }}>{c.back}</div>
              </div>
              <div className="meta">
                קופסה {c.box} מתוך 5
                {c.topic ? ` · ${c.topic}` : ''} · הצלחות {c.successes}/{c.reviews} · הבא:{' '}
                {new Date(c.next_review_at).toLocaleDateString('he-IL')}
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ background: 'rgba(255,255,255,0.25)', color: textColor }}
                    onClick={() => remove(c.id)}
                  >
                    מחקי
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

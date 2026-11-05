import { useEffect, useState } from 'react'
import { ella } from '../lib/api'
import type {
  AppSettings,
  Material,
  McQuestion,
  McExamResult,
  FeynmanResult,
  StrengthEntry,
} from '../../electron/types'

type Props = {
  notebookId: string
  settings: AppSettings
}

export default function AiStudyPanel({ notebookId, settings }: Props) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [pastExams, setPastExams] = useState<Material[]>([])
  const [strengths, setStrengths] = useState<StrengthEntry[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // MC exam state
  const [questions, setQuestions] = useState<McQuestion[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<McExamResult | null>(null)
  const [count, setCount] = useState(5)

  // Feynman
  const [topic, setTopic] = useState('')
  const [explanation, setExplanation] = useState('')
  const [feynman, setFeynman] = useState<FeynmanResult | null>(null)

  const load = async () => {
    setMaterials(await ella().materials.list(notebookId, 'material'))
    setPastExams(await ella().materials.list(notebookId, 'past_exam'))
    setStrengths(await ella().strength.list(notebookId))
  }

  useEffect(() => {
    load().catch(console.error)
  }, [notebookId])

  if (!settings.ai_enabled) {
    return (
      <div className="empty">
        <p>מצב AI כבוי. אפשר להפעיל בהגדרות ולהזין מפתח API.</p>
      </div>
    )
  }

  if (!settings.has_api_key) {
    return (
      <div className="empty">
        <p>חסר מפתח API. היכנסי להגדרות והוסיפי מפתח OpenAI.</p>
      </div>
    )
  }

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

  const generateExam = async () => {
    setError('')
    setBusy(true)
    setResult(null)
    setAnswers({})
    try {
      const qs = await ella().ai.generateMcExam(notebookId, count)
      setQuestions(qs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה ביצירת מבחן')
    } finally {
      setBusy(false)
    }
  }

  const submitExam = async () => {
    if (!questions) return
    setBusy(true)
    try {
      const res = await ella().ai.scoreMcExam(questions, answers, notebookId)
      setResult(res)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בציון')
    } finally {
      setBusy(false)
    }
  }

  const runFeynman = async () => {
    if (!topic.trim() || !explanation.trim()) return
    setError('')
    setBusy(true)
    setFeynman(null)
    try {
      const res = await ella().ai.feynman(notebookId, topic.trim(), explanation.trim())
      setFeynman(res)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בפיינמן')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}

      <section style={{ marginBottom: '1.8rem' }}>
        <h2 style={{ color: 'var(--pink-700)', marginBottom: '0.6rem' }}>חומרים ושחזורים</h2>
        <p className="subtitle">העלי PDF/TXT — השחזורים עוזרים למודל לנסח שאלות בסגנון המבחן</p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
          <button className="btn btn-primary" disabled={busy} onClick={() => addFiles('material')}>
            העלי חומרי לימוד
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => addFiles('past_exam')}>
            העלי שחזורים
          </button>
        </div>
        <FileList title="חומרים" items={materials} onDelete={remove} />
        <FileList title="שחזורים" items={pastExams} onDelete={remove} />
      </section>

      <section style={{ marginBottom: '1.8rem' }}>
        <h2 style={{ color: 'var(--pink-700)', marginBottom: '0.6rem' }}>מבחן אמריקאי</h2>
        <div className="field" style={{ maxWidth: 200 }}>
          <label>מספר שאלות</label>
          <input
            type="number"
            min={3}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 5)}
          />
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={generateExam}>
          {busy && !questions ? 'מייצרת…' : 'צרי מבחן מהחומר'}
        </button>

        {questions && (
          <div style={{ marginTop: '1.2rem' }}>
            {questions.map((q, qi) => (
              <div key={q.id} style={{ marginBottom: '1.2rem' }}>
                <strong>
                  {qi + 1}. {q.prompt}
                </strong>
                <div style={{ marginTop: '0.5rem' }}>
                  {q.options.map((opt, oi) => {
                    let cls = 'mc-option'
                    if (result) {
                      if (oi === q.correctIndex) cls += ' correct'
                      else if (answers[q.id] === oi) cls += ' wrong'
                    } else if (answers[q.id] === oi) cls += ' selected'
                    return (
                      <button
                        key={oi}
                        type="button"
                        className={cls}
                        disabled={!!result}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
                {result && q.explanation && (
                  <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{q.explanation}</p>
                )}
              </div>
            ))}
            {!result ? (
              <button className="btn btn-primary" disabled={busy} onClick={submitExam}>
                הגשי מבחן
              </button>
            ) : (
              <p>
                ציון: {result.score}/{result.total}
              </p>
            )}
          </div>
        )}
      </section>

      <section style={{ marginBottom: '1.8rem' }}>
        <h2 style={{ color: 'var(--pink-700)', marginBottom: '0.6rem' }}>בדיקת פיינמן</h2>
        <p className="subtitle">הסבירי בעל פה (בכתב) כל מה שאת זוכרת — הפערים יהפכו לנקודות חולשה</p>
        <div className="field">
          <label>נושא</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div className="field">
          <label>ההסבר שלך מהזיכרון</label>
          <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={runFeynman}>
          בדקי הבנה
        </button>
        {feynman && (
          <div style={{ marginTop: '1rem' }}>
            <p>{feynman.feedback}</p>
            <h3 style={{ marginTop: '0.8rem' }}>חולשות</h3>
            <ul>
              {feynman.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <h3>חוזקות</h3>
            <ul>
              {feynman.strengths.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 style={{ color: 'var(--pink-700)', marginBottom: '0.6rem' }}>פרופיל חוזק / חולשה</h2>
        {strengths.length === 0 ? (
          <p className="empty">עדיין אין נתונים — עשי מבחן או פיינמן</p>
        ) : (
          strengths.map((s) => (
            <div key={s.id} className="list-row">
              <span>{s.topic}</span>
              <span className={`chip ${s.level === 'weak' ? 'chip-weak' : 'chip-strong'}`}>
                {s.level === 'weak' ? 'חלש' : 'חזק'}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

function FileList({
  title,
  items,
  onDelete,
}: {
  title: string
  items: Material[]
  onDelete: (id: string) => void
}) {
  if (!items.length) return <p className="subtitle">{title}: אין קבצים</p>
  return (
    <div style={{ marginBottom: '0.8rem' }}>
      <strong>{title}</strong>
      {items.map((m) => (
        <div key={m.id} className="list-row">
          <span>{m.filename}</span>
          <button className="btn btn-ghost" onClick={() => onDelete(m.id)}>
            מחקי
          </button>
        </div>
      ))}
    </div>
  )
}

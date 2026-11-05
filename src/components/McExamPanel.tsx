import { useEffect, useState } from 'react'
import { ella } from '../lib/api'
import type { AppSettings, McQuestion, McExamResult } from '../../electron/types'

type Props = {
  notebookId: string
  settings: AppSettings
}

export default function McExamPanel({ notebookId, settings }: Props) {
  const [questions, setQuestions] = useState<McQuestion[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<McExamResult | null>(null)
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [topics, setTopics] = useState('')
  const [matchInstructor, setMatchInstructor] = useState(true)
  const [focusMissed, setFocusMissed] = useState(false)
  const [minutes, setMinutes] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!settings.ai_enabled || !settings.has_api_key) {
    return (
      <div className="empty">
        <p>מבחן אמריקאי דורש מצב AI ומפתח API. עדכני בהגדרות.</p>
      </div>
    )
  }

  const generateExam = async () => {
    setError('')
    setBusy(true)
    setResult(null)
    setAnswers({})
    try {
      const qs = await ella().ai.generateMcExam(notebookId, {
        count,
        difficulty,
        topics,
        matchInstructor,
        focusMissed,
        minutes: minutes > 0 ? minutes : null,
      })
      setQuestions(qs)
      setRemaining(minutes > 0 ? minutes * 60 : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה ביצירת מבחן')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (remaining === null || result) return
    if (remaining <= 0) return
    const timer = window.setTimeout(() => setRemaining((value) => (value === null ? null : value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [remaining, result])

  const submitExam = async () => {
    if (!questions) return
    setBusy(true)
    try {
      const res = await ella().ai.scoreMcExam(questions, answers, notebookId)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בציון')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 className="panel-title">מבחן אמריקאי</h2>
      <p className="subtitle">שאלות על בסיס החומרים והשחזורים שהועלו</p>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="exam-config">
        <div className="field">
          <label>מספר שאלות</label>
          <input type="number" min={3} max={20} value={count} onChange={(e) => setCount(Number(e.target.value) || 5)} />
        </div>
        <div className="field">
          <label>רמת קושי</label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}>
            <option value="easy">קלה</option>
            <option value="medium">בינונית</option>
            <option value="hard">גבוהה</option>
          </select>
        </div>
        <div className="field">
          <label>נושאים</label>
          <input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="למשל: התניה קלאסית" />
        </div>
        <div className="field">
          <label>זמן בדקות (0 = בלי הגבלה)</label>
          <input type="number" min={0} max={180} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 0)} />
        </div>
      </div>
      <label className="check-line">
        <input type="checkbox" checked={matchInstructor} onChange={(e) => setMatchInstructor(e.target.checked)} />
        התאמה לסגנון השאלות שזוהה בשחזורים
      </label>
      <label className="check-line">
        <input type="checkbox" checked={focusMissed} onChange={(e) => setFocusMissed(e.target.checked)} />
        התמקדות בנושאים שפספסתי
      </label>
      {remaining !== null && !result && (
        <p className="subtitle">זמן שנותר: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p>
      )}
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
              {result && q.sources?.length > 0 && (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>מקורות: {q.sources.join(' · ')}</p>
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
    </div>
  )
}

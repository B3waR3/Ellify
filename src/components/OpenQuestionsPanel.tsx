import { useState } from 'react'
import { ella } from '../lib/api'
import type { AppSettings, OpenEvaluation, OpenQuestion } from '../../electron/types'

type Props = {
  notebookId: string
  settings: AppSettings
}

export default function OpenQuestionsPanel({ notebookId, settings }: Props) {
  const [focus, setFocus] = useState('')
  const [question, setQuestion] = useState<OpenQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [evaluation, setEvaluation] = useState<(OpenEvaluation & { sources: string[] }) | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!settings.ai_enabled || !settings.has_api_key) {
    return <div className="empty">שאלות פתוחות דורשות מצב AI ומפתח API.</div>
  }

  const ask = async (nextFocus = focus) => {
    setError('')
    setBusy(true)
    setEvaluation(null)
    setRevealed(false)
    setAnswer('')
    setSubmitted('')
    try {
      setQuestion(await ella().ai.openQuestion(notebookId, nextFocus))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setBusy(false)
    }
  }

  const evaluate = async (reveal: boolean, text = answer) => {
    if (!question || !text.trim()) return
    setError('')
    setBusy(true)
    setSubmitted(text)
    try {
      const result = await ella().ai.evaluateOpen(notebookId, {
        question: question.prompt,
        concept: question.concept,
        answer: text,
        reveal,
      })
      setEvaluation(result)
      setRevealed(reveal)
      if (result.verdict === 'correct') {
        await ella().progress.record(notebookId, question.concept, reveal ? 'after_reveal' : 'independent')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 className="panel-title">שאלות פתוחות</h2>
      <p className="subtitle">נסי לשלוף מהזיכרון. רמז מגיע לפני התשובה המלאה.</p>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="field">
        <label>מיקוד (אפשר להשאיר ריק)</label>
        <input value={focus} onChange={(e) => setFocus(e.target.value)} />
      </div>
      <button className="btn btn-primary" disabled={busy} onClick={() => void ask()}>
        שאלה חדשה
      </button>

      {question && (
        <div className="open-card">
          <p><strong>{question.prompt}</strong></p>
          {question.sourceLabels.length > 0 && (
            <p className="subtitle">מקורות אפשריים: {question.sourceLabels.join(' · ')}</p>
          )}
          <div className="field">
            <label>התשובה שלך</label>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={() => void evaluate(false)}>
            בדקי
          </button>
        </div>
      )}

      {submitted && (
        <div className="open-card">
          <h3>התשובה המקורית</h3>
          <p>{submitted}</p>
        </div>
      )}

      {evaluation && (
        <div className="open-card">
          <p>{evaluation.feedback}</p>
          {evaluation.verdict === 'insufficient_sources' && (
            <p>אין במקורות מספיק מידע כדי לתקן את התשובה בביטחון.</p>
          )}
          {!revealed && evaluation.hint && (
            <p><strong>רמז: </strong>{evaluation.hint}</p>
          )}
          {evaluation.sources.length > 0 && (
            <p className="subtitle">נשענו על: {[...new Set(evaluation.sources)].join(' · ')}</p>
          )}
          {revealed && evaluation.enhancedParts.length > 0 && (
            <p className="enhanced-answer">
              {evaluation.enhancedParts.map((part, index) => (
                <span key={index} className={part.added ? 'ai-added' : undefined}>
                  {part.added ? ` תוספת: ${part.text}` : part.text}{' '}
                </span>
              ))}
            </p>
          )}
          <div className="review-actions">
            {!revealed && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => void evaluate(true, submitted)}>
                הציגי הסבר מלא
              </button>
            )}
            {evaluation.followUp && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setQuestion({
                    prompt: evaluation.followUp,
                    concept: question?.concept || focus,
                    sourceLabels: evaluation.sources,
                  })
                  setAnswer('')
                  setSubmitted('')
                  setEvaluation(null)
                  setRevealed(false)
                }}
              >
                נסי שוב על מה שחסר
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

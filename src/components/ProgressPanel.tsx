import { useEffect, useState } from 'react'
import { ella } from '../lib/api'
import type { ConceptProgress, ExamAttempt } from '../../electron/types'

const STATUS_LABEL: Record<ConceptProgress['status'], string> = {
  independent: 'נשלף לבד',
  after_hint: 'אחרי רמז',
  after_reveal: 'אחרי הסבר',
  still_wrong: 'עדיין חלש',
}

type Props = {
  notebookId: string
  onResetCards: () => Promise<void>
}

export default function ProgressPanel({ notebookId, onResetCards }: Props) {
  const [concepts, setConcepts] = useState<ConceptProgress[]>([])
  const [exams, setExams] = useState<ExamAttempt[]>([])

  const load = async () => {
    setConcepts(await ella().progress.concepts(notebookId))
    setExams(await ella().progress.exams(notebookId))
  }

  useEffect(() => {
    load().catch(console.error)
  }, [notebookId])

  return (
    <div>
      <h2 className="panel-title">התקדמות</h2>
      <p className="subtitle">הנתונים נשמרים למחברת הזו בלבד. איפוס לא מוחק כרטיסיות שכתבת.</p>
      <div className="review-actions" style={{ justifyContent: 'flex-start' }}>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            await ella().progress.reset(notebookId)
            await load()
          }}
        >
          איפוס היסטוריית למידה
        </button>
        <button className="btn btn-ghost" onClick={() => void onResetCards()}>
          איפוס לוח הזמנים של הכרטיסיות
        </button>
      </div>
      <h3>מבחנים</h3>
      {exams.length === 0 ? <p className="empty">עדיין אין מבחנים שמורים</p> : exams.map((exam) => (
        <div key={exam.id} className="list-row">
          <span>{exam.score}/{exam.total}</span>
          <span>{new Date(exam.created_at).toLocaleDateString('he-IL')}</span>
        </div>
      ))}
      <h3>מושגים</h3>
      {concepts.length === 0 ? <p className="empty">עדיין אין מעקב מושגים</p> : concepts.map((concept) => (
        <div key={concept.id} className="list-row">
          <span>{concept.concept}</span>
          <span className="chip">{STATUS_LABEL[concept.status]}</span>
        </div>
      ))}
    </div>
  )
}

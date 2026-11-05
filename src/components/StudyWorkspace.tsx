import { useState } from 'react'
import MaterialsPanel from './MaterialsPanel'
import McExamPanel from './McExamPanel'
import FlashcardsPanel from './FlashcardsPanel'
import OpenQuestionsPanel from './OpenQuestionsPanel'
import ProgressPanel from './ProgressPanel'
import ChatPanel from './ChatPanel'
import { ella } from '../lib/api'
import type { AppSettings, Notebook } from '../../electron/types'

type Section = 'sources' | 'exam' | 'cards' | 'open' | 'progress' | 'chat'

type Props = {
  notebook: Notebook
  settings: AppSettings
  onChanged: () => Promise<void>
}

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'sources', label: 'מקורות' },
  { id: 'exam', label: 'מבחן אמריקאי' },
  { id: 'cards', label: 'כרטיסיות' },
  { id: 'open', label: 'שאלות פתוחות' },
  { id: 'progress', label: 'התקדמות' },
  { id: 'chat', label: 'שיחה' },
]

export default function StudyWorkspace({ notebook, settings, onChanged }: Props) {
  const [section, setSection] = useState<Section>('sources')

  return (
    <div className="study-shell">
      <nav className="study-nav">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`study-nav-item ${section === item.id ? 'active' : ''}`}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="study-content">
        {section === 'sources' && <MaterialsPanel notebookId={notebook.id} />}
        {section === 'exam' && <McExamPanel notebookId={notebook.id} settings={settings} />}
        {section === 'cards' && <FlashcardsPanel notebook={notebook} onChanged={onChanged} />}
        {section === 'open' && <OpenQuestionsPanel notebookId={notebook.id} settings={settings} />}
        {section === 'progress' && (
          <ProgressPanel
            notebookId={notebook.id}
            onResetCards={async () => {
              await ella().flashcards.resetStats(notebook.id)
              await onChanged()
            }}
          />
        )}
        {section === 'chat' && <ChatPanel notebookId={notebook.id} settings={settings} />}
      </div>
    </div>
  )
}

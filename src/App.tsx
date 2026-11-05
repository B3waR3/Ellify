import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ella } from './lib/api'
import type { AppSettings } from '../electron/types'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import NotebookView from './pages/NotebookView'
import Settings from './pages/Settings'
import TopBar from './components/TopBar'

export default function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [dueCount, setDueCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const s = await ella().settings.get()
    const due = await ella().flashcards.countDue()
    setSettings(s)
    setDueCount(due)
  }

  useEffect(() => {
    refresh()
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading || !settings) {
    return (
      <div className="onboarding">
        <div className="onboarding-panel">
          <p className="subtitle" style={{ margin: 0 }}>
            טוענת…
          </p>
        </div>
      </div>
    )
  }

  if (!settings.onboarding_done) {
    return (
      <Onboarding
        onDone={async () => {
          await refresh()
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      <TopBar dueCount={dueCount} aiEnabled={settings.ai_enabled} />
      <Routes>
        <Route path="/" element={<Home onChanged={refresh} />} />
        <Route
          path="/notebook/:id"
          element={<NotebookView settings={settings} onChanged={refresh} />}
        />
        <Route
          path="/settings"
          element={
            <Settings
              settings={settings}
              onChanged={async () => {
                await refresh()
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

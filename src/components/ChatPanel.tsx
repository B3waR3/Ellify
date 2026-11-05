import { useState } from 'react'
import { ella } from '../lib/api'
import type { AppSettings } from '../../electron/types'

type Msg = { role: 'user' | 'assistant'; content: string }

type Props = {
  notebookId: string
  settings: AppSettings
}

export default function ChatPanel({ notebookId, settings }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!settings.ai_enabled || !settings.has_api_key) {
    return (
      <div className="empty">
        <p>צ׳אט עם AI דורש מצב AI ומפתח API. עדכני בהגדרות.</p>
      </div>
    )
  }

  const send = async () => {
    if (!input.trim() || busy) return
    const userMsg: Msg = { role: 'user', content: input.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setBusy(true)
    setError('')
    try {
      const reply = await ella().ai.chat(
        notebookId,
        next.map((m) => ({ role: m.role, content: m.content })),
      )
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בצ׳אט')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat-panel">
      <h2 className="panel-title">צ׳אט עם AI</h2>
      <p className="subtitle">שאלי על החומר — המודל משתמש במסמכים שהעלית למחברת</p>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="chat-messages">
        {messages.length === 0 && <p className="empty">התחילי שיחה על נושא מהחומר…</p>}
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
      </div>

      <div className="chat-input-row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="כתבי שאלה…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <button className="btn btn-primary" disabled={busy} onClick={send}>
          {busy ? 'שולחת…' : 'שלחי'}
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { ella } from '../lib/api'
import type { AppSettings } from '../../electron/types'

type Props = {
  settings: AppSettings
  onChanged: () => Promise<void>
}

export default function Settings({ settings, onChanged }: Props) {
  const [aiEnabled, setAiEnabled] = useState(settings.ai_enabled)
  const [model, setModel] = useState(settings.openai_model)
  const [apiKey, setApiKey] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    setMessage('')
    try {
      if (aiEnabled && apiKey.trim()) {
        await ella().settings.setApiKey(apiKey.trim())
      }
      if (!aiEnabled) {
        // keep key but disable AI, or clear — keep key for convenience
      }
      await ella().settings.update({
        ai_enabled: aiEnabled,
        openai_model: model,
      })
      setApiKey('')
      setMessage('נשמר בהצלחה')
      await onChanged()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setBusy(false)
    }
  }

  const clearKey = async () => {
    await ella().settings.clearApiKey()
    setMessage('המפתח נמחק')
    await onChanged()
  }

  return (
    <div className="page">
      <h1 className="hero-title">הגדרות</h1>
      <p className="subtitle">ניהול מצב AI ומפתח API</p>

      <div className="settings-card">
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              style={{ marginInlineEnd: 8 }}
            />
            הפעלת AI
          </label>
        </div>

        {aiEnabled && (
          <>
            <div className="field">
              <label htmlFor="model">מודל</label>
              <select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="gpt-5-nano">gpt-5-nano (זול)</option>
                <option value="gpt-5-mini">gpt-5-mini (מומלץ)</option>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-5.4-mini">gpt-5.4-mini</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="key">
                מפתח OpenAI {settings.has_api_key ? '(כבר שמור — הזנה מחדש תחליף)' : ''}
              </label>
              <input
                id="key"
                type="password"
                dir="ltr"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={settings.has_api_key ? '••••••••' : 'sk-...'}
              />
            </div>
            {settings.has_api_key && (
              <button className="btn btn-danger" type="button" onClick={clearKey}>
                מחקי מפתח
              </button>
            )}
          </>
        )}

        <div className="modal-actions" style={{ marginTop: '1.2rem' }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'שומרת…' : 'שמרי'}
          </button>
        </div>
        {message && <p style={{ marginTop: '0.8rem', color: 'var(--pink-700)' }}>{message}</p>}
      </div>
    </div>
  )
}

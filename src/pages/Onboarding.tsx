import { useState } from 'react'
import { ella } from '../lib/api'

type Props = {
  onDone: () => Promise<void>
}

export default function Onboarding({ onDone }: Props) {
  const [mode, setMode] = useState<'ai' | 'no-ai' | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-5-mini')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const finish = async () => {
    setError('')
    if (!mode) {
      setError('בחרי אפשרות כדי להמשיך')
      return
    }
    if (mode === 'ai' && !apiKey.trim()) {
      setError('יש להזין מפתח OpenAI API')
      return
    }
    setBusy(true)
    try {
      if (mode === 'ai') {
        await ella().settings.setApiKey(apiKey.trim())
        await ella().settings.update({
          ai_enabled: true,
          openai_model: model,
          onboarding_done: true,
        })
      } else {
        await ella().settings.clearApiKey()
        await ella().settings.update({
          ai_enabled: false,
          onboarding_done: true,
        })
      }
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-panel">
        <h1>Ella</h1>
        <p className="subtitle">מחברות לימוד, כרטיסיות והכנה למבחנים — בעברית</p>

        <div className="choice-row">
          <button
            type="button"
            className={`choice ${mode === 'ai' ? 'active' : ''}`}
            onClick={() => setMode('ai')}
          >
            <strong>עם AI</strong>
            <span>מבחנים אמריקאיים ופיינמן על בסיס החומרים שלך</span>
          </button>
          <button
            type="button"
            className={`choice ${mode === 'no-ai' ? 'active' : ''}`}
            onClick={() => setMode('no-ai')}
          >
            <strong>בלי AI</strong>
            <span>מחברות, סיכומים וכרטיסיות לייטנר בלבד</span>
          </button>
        </div>

        {mode === 'ai' && (
          <>
            <div className="field" style={{ textAlign: 'right' }}>
              <label htmlFor="apiKey">מפתח OpenAI API</label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                dir="ltr"
              />
            </div>
            <div className="field" style={{ textAlign: 'right' }}>
              <label htmlFor="model">מודל</label>
              <select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="gpt-5-nano">gpt-5-nano (זול)</option>
                <option value="gpt-5-mini">gpt-5-mini (מומלץ)</option>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-5.4-mini">gpt-5.4-mini</option>
              </select>
            </div>
          </>
        )}

        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

        <button className="btn btn-primary" onClick={finish} disabled={busy}>
          {busy ? 'שומרת…' : 'התחילי'}
        </button>
      </div>
    </div>
  )
}

import { Link, useLocation } from 'react-router-dom'

type Props = {
  dueCount: number
  aiEnabled: boolean
}

export default function TopBar({ dueCount, aiEnabled }: Props) {
  const location = useLocation()
  const inNotebook = location.pathname.startsWith('/notebook/')

  // Inside a notebook the OneNote-style chrome takes over — keep a minimal utility strip only on home/settings
  if (inNotebook) {
    return null
  }

  return (
    <header className="topbar topbar-slim">
      <div className="topbar-actions" style={{ marginInlineStart: 'auto' }}>
        {dueCount > 0 && (
          <span className="badge" title="כרטיסיות לתרגול היום">
            לתרגול היום: {dueCount}
          </span>
        )}
        <span className="badge">{aiEnabled ? 'עם AI' : 'בלי AI'}</span>
        <Link className="btn btn-ghost" to="/settings">
          הגדרות
        </Link>
      </div>
    </header>
  )
}

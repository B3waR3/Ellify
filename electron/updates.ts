import { app, BrowserWindow, dialog, shell } from 'electron'

const REPO = 'B3waR3/Ellify'

type ReleaseAsset = {
  name: string
  browser_download_url: string
}

type GitHubRelease = {
  tag_name?: string
  html_url?: string
  assets?: ReleaseAsset[]
}

function parseVersion(value: string): number[] {
  return value
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0))
}

function isNewer(latest: string, current: string): boolean {
  const next = parseVersion(latest)
  const now = parseVersion(current)
  const length = Math.max(next.length, now.length)
  for (let i = 0; i < length; i += 1) {
    const a = next[i] ?? 0
    const b = now[i] ?? 0
    if (a > b) return true
    if (a < b) return false
  }
  return false
}

function downloadUrl(release: GitHubRelease): string | null {
  const assets = release.assets ?? []
  const wanted =
    process.platform === 'darwin'
      ? assets.find((asset) => asset.name.endsWith('.dmg'))
      : assets.find((asset) => asset.name.endsWith('.exe'))
  return wanted?.browser_download_url || release.html_url || null
}

export async function checkForUpdates(win: BrowserWindow | null) {
  if (process.env.VITE_DEV_SERVER_URL) return

  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Ellify',
      },
    })
    if (response.status === 404) return
    if (!response.ok) return

    const release = (await response.json()) as GitHubRelease
    const latest = release.tag_name || ''
    const current = app.getVersion()
    if (!latest || !isNewer(latest, current)) return

    const url = downloadUrl(release)
    if (!url || !win) return

    const choice = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'עדכון זמין',
      message: `יש גרסה חדשה של Ellify (${latest.replace(/^v/i, '')}).`,
      detail: `הגרסה שלך היא ${current}. אפשר להוריד את העדכון עכשיו.`,
      buttons: ['הורדה', 'אחר כך'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    })

    if (choice.response === 0) {
      await shell.openExternal(url)
    }
  } catch {
    // Offline or GitHub unavailable: keep the current version running.
  }
}

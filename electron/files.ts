import fs from 'fs'
import path from 'path'
import { dialog, BrowserWindow } from 'electron'

export async function pickFiles(
  win: BrowserWindow | null,
  title: string,
): Promise<string[]> {
  const result = await dialog.showOpenDialog(win ?? undefined!, {
    title,
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'מסמכים', extensions: ['pdf', 'txt', 'md', 'text'] },
      { name: 'הכל', extensions: ['*'] },
    ],
  })
  if (result.canceled) return []
  return result.filePaths
}

export async function extractTextFromFile(filepath: string): Promise<string> {
  const ext = path.extname(filepath).toLowerCase()
  if (ext === '.txt' || ext === '.md' || ext === '.text') {
    return fs.readFileSync(filepath, 'utf8')
  }
  if (ext === '.pdf') {
    try {
      // pdf-parse is CommonJS
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      const data = await pdfParse(fs.readFileSync(filepath))
      return data.text || ''
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`כשל בחילוץ טקסט מ-PDF: ${message}`)
    }
  }
  throw new Error('סוג קובץ לא נתמך. השתמשי ב-PDF או TXT.')
}

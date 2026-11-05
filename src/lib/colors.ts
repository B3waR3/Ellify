/** From user's palette PDF — notebooks: 8×4 grid (vibrant → pastel) */
export const NOTEBOOK_COLOR_ROWS: string[][] = [
  ['#F032A4', '#8757A7', '#5461A8', '#52BBE5', '#62C46F', '#FFF532', '#F9A84D', '#F0494F'],
  ['#F366BA', '#A380BC', '#8188BC', '#7BCDEC', '#89D393', '#FEF77E', '#FABF78', '#F3787B'],
  ['#F899D0', '#C2ACD3', '#AAB0D4', '#AADDF3', '#B1E1B6', '#FFFB9A', '#FCD4A6', '#F9A4A8'],
  ['#FACDE7', '#E1D5E9', '#D5D7E9', '#D4F0FB', '#D8F0DC', '#FDFCCC', '#FFEAD3', '#FBD2D4'],
]

export const NOTEBOOK_COLORS: string[] = NOTEBOOK_COLOR_ROWS.flat()

/** Soft page backgrounds from the same PDF */
export const PAGE_COLORS = [
  '#E7C2B3',
  '#D1B2E8',
  '#B4DCFA',
  '#D8EEC0',
  '#FAFABE',
  '#FAD2A0',
  '#FAD2D2',
  '#FFFFFF',
]

export function isValidHex(value: string): boolean {
  return /^#([0-9A-Fa-f]{6})$/.test(value.trim())
}

export function normalizeHex(value: string): string {
  let v = value.trim()
  if (!v.startsWith('#')) v = `#${v}`
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const r = v[1]
    const g = v[2]
    const b = v[3]
    v = `#${r}${r}${g}${g}${b}${b}`
  }
  return v.toUpperCase()
}

export function contrastText(bg: string): string {
  const hex = bg.replace('#', '')
  if (hex.length !== 6) return '#ffffff'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luma > 0.62 ? '#2a1a22' : '#ffffff'
}

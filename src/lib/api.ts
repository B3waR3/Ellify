export function ella() {
  if (!window.ella) {
    throw new Error('Ella API לא זמין — יש להריץ דרך Electron')
  }
  return window.ella
}

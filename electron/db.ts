import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import { v4 as uuid } from 'uuid'
import type {
  Notebook,
  Chapter,
  Page,
  Flashcard,
  Material,
  AppSettings,
  StrengthEntry,
} from './types'
import { initialReview, normalizeBox, onCorrect, onWrong, todayIso, DEFAULT_INTERVALS } from './leitner'
import type { ConceptProgress, ConceptStatus, ExamAttempt, InstructorProfile, Passage } from './types'

let SQL: SqlJsStatic | null = null
let db: Database | null = null
let dbPath = ''

function getDb(): Database {
  if (!db) throw new Error('מסד הנתונים לא אותחל')
  return db
}

function persist() {
  const data = getDb().export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}

function rowToObject<T>(columns: string[], values: unknown[]): T {
  const obj: Record<string, unknown> = {}
  columns.forEach((c, i) => {
    obj[c] = values[i]
  })
  return obj as T
}

function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  const stmt = getDb().prepare(sql)
  stmt.bind(params as never[])
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

function queryOne<T>(sql: string, params: unknown[] = []): T | null {
  const rows = queryAll<T>(sql, params)
  return rows[0] ?? null
}

function run(sql: string, params: unknown[] = []) {
  getDb().run(sql, params as never[])
  persist()
}

export async function initDatabase() {
  const userData = app.getPath('userData')
  dbPath = path.join(userData, 'ella.sqlite')

  const wasmPath = path.join(
    app.getAppPath(),
    'node_modules',
    'sql.js',
    'dist',
    'sql-wasm.wasm',
  )
  const fallbackWasm = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
  SQL = await initSqlJs({
    locateFile: (file) => {
      if (file.endsWith('.wasm')) {
        if (fs.existsSync(wasmPath)) return wasmPath
        if (fs.existsSync(fallbackWasm)) return fallbackWasm
      }
      return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
    },
  })

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  getDb().run(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      exam_date TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content_json TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      box INTEGER NOT NULL,
      next_review_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      extracted_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS strength_profile (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      level TEXT NOT NULL,
      notes TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
    );
  `)

  ensureColumn('materials', 'enabled', 'INTEGER DEFAULT 1')
  ensureColumn('materials', 'display_name', 'TEXT')
  ensureColumn('flashcards', 'topic', "TEXT DEFAULT ''")
  ensureColumn('flashcards', 'reviews', 'INTEGER DEFAULT 0')
  ensureColumn('flashcards', 'successes', 'INTEGER DEFAULT 0')
  ensureColumn('flashcards', 'failures', 'INTEGER DEFAULT 0')

  getDb().run(`
    CREATE TABLE IF NOT EXISTS instructor_profiles (
      notebook_id TEXT PRIMARY KEY,
      profile_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS exam_attempts (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      weak_topics_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS concept_progress (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL,
      concept TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  // Defaults
  const existing = queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['onboarding_done'])
  if (!existing) {
    run('INSERT INTO settings (key, value) VALUES (?, ?)', ['onboarding_done', 'false'])
    run('INSERT INTO settings (key, value) VALUES (?, ?)', ['ai_enabled', 'false'])
    run('INSERT INTO settings (key, value) VALUES (?, ?)', ['openai_model', 'gpt-5-mini'])
  }

  persist()
}

function columnExists(table: string, column: string): boolean {
  const rows = queryAll<{ name: string }>(`PRAGMA table_info(${table})`)
  return rows.some((row) => row.name === column)
}

function ensureColumn(table: string, column: string, type: string) {
  if (!columnExists(table, column)) {
    getDb().run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
  }
}

function getSetting(key: string, fallback = ''): string {
  const row = queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
  return row?.value ?? fallback
}

function setSetting(key: string, value: string) {
  const existing = queryOne('SELECT key FROM settings WHERE key = ?', [key])
  if (existing) {
    run('UPDATE settings SET value = ? WHERE key = ?', [value, key])
  } else {
    run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value])
  }
}

export function getAppSettings(hasApiKey: boolean): AppSettings {
  return {
    onboarding_done: getSetting('onboarding_done') === 'true',
    ai_enabled: getSetting('ai_enabled') === 'true',
    openai_model: getSetting('openai_model', 'gpt-5-mini'),
    has_api_key: hasApiKey,
  }
}

export function updateAppSettings(partial: Partial<Omit<AppSettings, 'has_api_key'>>) {
  if (partial.onboarding_done !== undefined) {
    setSetting('onboarding_done', partial.onboarding_done ? 'true' : 'false')
  }
  if (partial.ai_enabled !== undefined) {
    setSetting('ai_enabled', partial.ai_enabled ? 'true' : 'false')
  }
  if (partial.openai_model !== undefined) {
    setSetting('openai_model', partial.openai_model)
  }
}

// --- Notebooks ---

export function listNotebooks(): Notebook[] {
  return queryAll<Notebook>('SELECT * FROM notebooks ORDER BY created_at DESC')
}

export function createNotebook(name: string, color: string): Notebook {
  const notebook: Notebook = {
    id: uuid(),
    name,
    color,
    exam_date: null,
    created_at: new Date().toISOString(),
  }
  run(
    'INSERT INTO notebooks (id, name, color, exam_date, created_at) VALUES (?, ?, ?, ?, ?)',
    [notebook.id, notebook.name, notebook.color, notebook.exam_date, notebook.created_at],
  )
  // Default chapter + page
  const chapter = createChapter(notebook.id, 'פרק 1')
  createPage(chapter.id, 'עמוד 1')
  return notebook
}

export function updateNotebook(
  id: string,
  data: Partial<Pick<Notebook, 'name' | 'color' | 'exam_date'>>,
): Notebook | null {
  const current = queryOne<Notebook>('SELECT * FROM notebooks WHERE id = ?', [id])
  if (!current) return null
  const next = {
    ...current,
    name: data.name ?? current.name,
    color: data.color ?? current.color,
    exam_date: data.exam_date !== undefined ? data.exam_date : current.exam_date,
  }
  run('UPDATE notebooks SET name = ?, color = ?, exam_date = ? WHERE id = ?', [
    next.name,
    next.color,
    next.exam_date,
    id,
  ])
  return next
}

export function deleteNotebook(id: string) {
  run('DELETE FROM strength_profile WHERE notebook_id = ?', [id])
  run('DELETE FROM materials WHERE notebook_id = ?', [id])
  run('DELETE FROM flashcards WHERE notebook_id = ?', [id])
  const chapters = queryAll<{ id: string }>('SELECT id FROM chapters WHERE notebook_id = ?', [id])
  for (const ch of chapters) {
    run('DELETE FROM pages WHERE chapter_id = ?', [ch.id])
  }
  run('DELETE FROM chapters WHERE notebook_id = ?', [id])
  run('DELETE FROM notebooks WHERE id = ?', [id])
}

export function getNotebook(id: string): Notebook | null {
  return queryOne<Notebook>('SELECT * FROM notebooks WHERE id = ?', [id])
}

// --- Chapters ---

export function listChapters(notebookId: string): Chapter[] {
  return queryAll<Chapter>(
    'SELECT * FROM chapters WHERE notebook_id = ? ORDER BY sort_order ASC',
    [notebookId],
  )
}

export function createChapter(notebookId: string, title: string): Chapter {
  const max = queryOne<{ m: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM chapters WHERE notebook_id = ?',
    [notebookId],
  )
  const chapter: Chapter = {
    id: uuid(),
    notebook_id: notebookId,
    title,
    sort_order: (max?.m ?? -1) + 1,
  }
  run('INSERT INTO chapters (id, notebook_id, title, sort_order) VALUES (?, ?, ?, ?)', [
    chapter.id,
    chapter.notebook_id,
    chapter.title,
    chapter.sort_order,
  ])
  return chapter
}

export function updateChapter(id: string, title: string): Chapter | null {
  run('UPDATE chapters SET title = ? WHERE id = ?', [title, id])
  return queryOne<Chapter>('SELECT * FROM chapters WHERE id = ?', [id])
}

export function deleteChapter(id: string) {
  run('DELETE FROM pages WHERE chapter_id = ?', [id])
  run('DELETE FROM chapters WHERE id = ?', [id])
}

// --- Pages ---

export function listPages(chapterId: string): Page[] {
  return queryAll<Page>(
    'SELECT * FROM pages WHERE chapter_id = ? ORDER BY sort_order ASC',
    [chapterId],
  )
}

export function listPagesByNotebook(notebookId: string): Page[] {
  return queryAll<Page>(
    `SELECT p.* FROM pages p
     JOIN chapters c ON c.id = p.chapter_id
     WHERE c.notebook_id = ?
     ORDER BY c.sort_order ASC, p.sort_order ASC`,
    [notebookId],
  )
}

export function createPage(chapterId: string, title: string): Page {
  const max = queryOne<{ m: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM pages WHERE chapter_id = ?',
    [chapterId],
  )
  const page: Page = {
    id: uuid(),
    chapter_id: chapterId,
    title,
    content_json: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
    sort_order: (max?.m ?? -1) + 1,
    updated_at: new Date().toISOString(),
  }
  run(
    'INSERT INTO pages (id, chapter_id, title, content_json, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [page.id, page.chapter_id, page.title, page.content_json, page.sort_order, page.updated_at],
  )
  return page
}

export function updatePage(
  id: string,
  data: Partial<Pick<Page, 'title' | 'content_json'>>,
): Page | null {
  const current = queryOne<Page>('SELECT * FROM pages WHERE id = ?', [id])
  if (!current) return null
  const next = {
    ...current,
    title: data.title ?? current.title,
    content_json: data.content_json ?? current.content_json,
    updated_at: new Date().toISOString(),
  }
  run('UPDATE pages SET title = ?, content_json = ?, updated_at = ? WHERE id = ?', [
    next.title,
    next.content_json,
    next.updated_at,
    id,
  ])
  return next
}

export function deletePage(id: string) {
  run('DELETE FROM pages WHERE id = ?', [id])
}

export function getPage(id: string): Page | null {
  return queryOne<Page>('SELECT * FROM pages WHERE id = ?', [id])
}

// --- Flashcards ---

function mapCard(row: Flashcard): Flashcard {
  return {
    ...row,
    topic: row.topic || '',
    box: normalizeBox(Number(row.box)),
    reviews: Number(row.reviews || 0),
    successes: Number(row.successes || 0),
    failures: Number(row.failures || 0),
  }
}

export function getLeitnerIntervals(): number[] {
  const raw = getSetting('leitner_intervals', '')
  if (!raw) return DEFAULT_INTERVALS
  try {
    const parsed = JSON.parse(raw) as number[]
    if (parsed.length === 5 && parsed.every((n) => Number(n) > 0)) return parsed.map(Number)
  } catch {
    /* keep defaults */
  }
  return DEFAULT_INTERVALS
}

export function setLeitnerIntervals(intervals: number[]) {
  setSetting('leitner_intervals', JSON.stringify(intervals))
}

export function listFlashcards(notebookId: string): Flashcard[] {
  return queryAll<Flashcard>(
    'SELECT * FROM flashcards WHERE notebook_id = ? ORDER BY created_at DESC',
    [notebookId],
  ).map(mapCard)
}

export function createFlashcard(
  notebookId: string,
  front: string,
  back: string,
  topic = '',
): Flashcard {
  const init = initialReview()
  const card: Flashcard = {
    id: uuid(),
    notebook_id: notebookId,
    front,
    back,
    topic,
    box: init.box,
    next_review_at: init.next_review_at,
    created_at: new Date().toISOString(),
    reviews: 0,
    successes: 0,
    failures: 0,
  }
  run(
    `INSERT INTO flashcards
      (id, notebook_id, front, back, topic, box, next_review_at, created_at, reviews, successes, failures)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
    [card.id, card.notebook_id, card.front, card.back, card.topic, card.box, card.next_review_at, card.created_at],
  )
  return card
}

export function updateFlashcard(
  id: string,
  data: Partial<Pick<Flashcard, 'front' | 'back' | 'topic'>>,
): Flashcard | null {
  const current = queryOne<Flashcard>('SELECT * FROM flashcards WHERE id = ?', [id])
  if (!current) return null
  const next = mapCard({
    ...current,
    front: data.front ?? current.front,
    back: data.back ?? current.back,
    topic: data.topic ?? current.topic,
  })
  run('UPDATE flashcards SET front = ?, back = ?, topic = ? WHERE id = ?', [
    next.front,
    next.back,
    next.topic,
    id,
  ])
  return next
}

export function deleteFlashcard(id: string) {
  run('DELETE FROM flashcards WHERE id = ?', [id])
}

export function dueFlashcards(notebookId: string): Flashcard[] {
  const now = todayIso()
  return queryAll<Flashcard>(
    'SELECT * FROM flashcards WHERE notebook_id = ? AND next_review_at <= ? ORDER BY next_review_at ASC',
    [notebookId, now],
  ).map(mapCard)
}

export function countDueAll(): number {
  const now = todayIso()
  const row = queryOne<{ c: number }>(
    'SELECT COUNT(*) as c FROM flashcards WHERE next_review_at <= ?',
    [now],
  )
  return row?.c ?? 0
}

export function reviewFlashcard(id: string, correct: boolean): Flashcard | null {
  const raw = queryOne<Flashcard>('SELECT * FROM flashcards WHERE id = ?', [id])
  if (!raw) return null
  const card = mapCard(raw)
  const notebook = getNotebook(card.notebook_id)
  const intervals = getLeitnerIntervals()
  const result = correct
    ? onCorrect(card.box, notebook?.exam_date ?? null, intervals)
    : onWrong(card.box, notebook?.exam_date ?? null, intervals)
  const reviews = card.reviews + 1
  const successes = card.successes + (correct ? 1 : 0)
  const failures = card.failures + (correct ? 0 : 1)
  run(
    'UPDATE flashcards SET box = ?, next_review_at = ?, reviews = ?, successes = ?, failures = ? WHERE id = ?',
    [result.box, result.next_review_at, reviews, successes, failures, id],
  )
  return { ...card, box: result.box, next_review_at: result.next_review_at, reviews, successes, failures }
}

export function resetFlashcardStats(notebookId: string) {
  const init = initialReview()
  run(
    'UPDATE flashcards SET box = ?, next_review_at = ?, reviews = 0, successes = 0, failures = 0 WHERE notebook_id = ?',
    [init.box, init.next_review_at, notebookId],
  )
}

// --- Materials ---

function mapMaterial(row: Material & { enabled?: number | boolean | null; display_name?: string | null }): Material {
  const enabledRaw = row.enabled as number | boolean | null | undefined
  return {
    ...row,
    display_name: row.display_name || row.filename,
    enabled: enabledRaw === undefined || enabledRaw === null ? true : Number(enabledRaw) === 1 || enabledRaw === true,
  }
}

export function listMaterials(notebookId: string, kind?: 'material' | 'past_exam'): Material[] {
  const rows = kind
    ? queryAll<Material>(
        'SELECT * FROM materials WHERE notebook_id = ? AND kind = ? ORDER BY created_at DESC',
        [notebookId, kind],
      )
    : queryAll<Material>('SELECT * FROM materials WHERE notebook_id = ? ORDER BY created_at DESC', [
        notebookId,
      ])
  return rows.map((row) => mapMaterial(row))
}

export function addMaterial(
  notebookId: string,
  kind: 'material' | 'past_exam',
  filename: string,
  filepath: string,
  extractedText: string,
): Material {
  const material: Material = {
    id: uuid(),
    notebook_id: notebookId,
    kind,
    filename,
    display_name: filename,
    filepath,
    extracted_text: extractedText,
    enabled: true,
    created_at: new Date().toISOString(),
  }
  run(
    `INSERT INTO materials
      (id, notebook_id, kind, filename, display_name, filepath, extracted_text, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      material.id,
      material.notebook_id,
      material.kind,
      material.filename,
      material.display_name,
      material.filepath,
      material.extracted_text,
      material.created_at,
    ],
  )
  return material
}

export function updateMaterial(
  id: string,
  data: Partial<Pick<Material, 'display_name' | 'enabled'>>,
): Material | null {
  const current = queryOne<Material>('SELECT * FROM materials WHERE id = ?', [id])
  if (!current) return null
  const next = mapMaterial({
    ...current,
    display_name: data.display_name ?? current.display_name,
    enabled: data.enabled === undefined ? mapMaterial(current).enabled : data.enabled,
  })
  run('UPDATE materials SET display_name = ?, enabled = ? WHERE id = ?', [
    next.display_name,
    next.enabled ? 1 : 0,
    id,
  ])
  return next
}

export function deleteMaterial(id: string) {
  run('DELETE FROM materials WHERE id = ?', [id])
}

export function getMaterialsText(notebookId: string): { materials: string; pastExams: string } {
  const mats = listMaterials(notebookId, 'material').filter((m) => m.enabled)
  const exams = listMaterials(notebookId, 'past_exam').filter((m) => m.enabled)
  return {
    materials: mats.map((m) => `--- ${m.display_name} ---\n${m.extracted_text}`).join('\n\n'),
    pastExams: exams.map((m) => `--- ${m.display_name} ---\n${m.extracted_text}`).join('\n\n'),
  }
}

function plainFromTipTap(json: string): string {
  try {
    const doc = JSON.parse(json) as { text?: string; content?: unknown[] }
    const parts: string[] = []
    const walk = (node: { text?: string; content?: unknown[] }) => {
      if (node.text) parts.push(node.text)
      for (const child of node.content || []) walk(child as { text?: string; content?: unknown[] })
    }
    walk(doc)
    return parts.join(' ')
  } catch {
    return ''
  }
}

function chunkText(text: string, size = 1400): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const parts: string[] = []
  for (let i = 0; i < clean.length && parts.length < 30; i += size) {
    parts.push(clean.slice(i, i + size))
  }
  return parts
}

function overlapScore(passage: string, query: string): number {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 2)
  if (!terms.length) return 1
  const hay = passage.toLowerCase()
  return terms.reduce((sum, term) => sum + (hay.includes(term) ? 1 : 0), 0)
}

export function retrievePassages(
  notebookId: string,
  query: string,
  options?: { kinds?: Array<'notes' | 'material' | 'past_exam'>; limit?: number },
): Passage[] {
  const limit = options?.limit ?? 8
  const kinds = options?.kinds ?? ['notes', 'material', 'past_exam']
  const scored: Array<Passage & { score: number }> = []

  if (kinds.includes('notes')) {
    for (const page of listPagesByNotebook(notebookId)) {
      for (const part of chunkText(plainFromTipTap(page.content_json))) {
        scored.push({
          source: `סיכום: ${page.title}`,
          kind: 'notes',
          text: part,
          score: overlapScore(part, query),
        })
      }
    }
  }

  for (const material of listMaterials(notebookId)) {
    if (!material.enabled || !kinds.includes(material.kind)) continue
    for (const part of chunkText(material.extracted_text)) {
      scored.push({
        source: material.display_name,
        kind: material.kind,
        text: part,
        score: overlapScore(part, query),
      })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  const matched = query.trim() ? scored.filter((item) => item.score > 0) : scored
  const chosen = (matched.length ? matched : scored).slice(0, limit)
  return chosen.map(({ source, kind, text }) => ({ source, kind, text }))
}

export function formatPassages(passages: Passage[]): string {
  if (!passages.length) return ''
  return passages.map((p) => `[${p.source}]\n${p.text}`).join('\n\n')
}

// --- Strength profile ---

export function listStrengths(notebookId: string): StrengthEntry[] {
  return queryAll<StrengthEntry>(
    'SELECT * FROM strength_profile WHERE notebook_id = ? ORDER BY updated_at DESC',
    [notebookId],
  )
}

export function upsertStrength(
  notebookId: string,
  topic: string,
  level: 'weak' | 'strong',
  notes: string,
): StrengthEntry {
  const existing = queryOne<StrengthEntry>(
    'SELECT * FROM strength_profile WHERE notebook_id = ? AND topic = ?',
    [notebookId, topic],
  )
  if (existing) {
    run('UPDATE strength_profile SET level = ?, notes = ?, updated_at = ? WHERE id = ?', [
      level,
      notes,
      new Date().toISOString(),
      existing.id,
    ])
    return { ...existing, level, notes, updated_at: new Date().toISOString() }
  }
  const entry: StrengthEntry = {
    id: uuid(),
    notebook_id: notebookId,
    topic,
    level,
    notes,
    updated_at: new Date().toISOString(),
  }
  run(
    'INSERT INTO strength_profile (id, notebook_id, topic, level, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [entry.id, entry.notebook_id, entry.topic, entry.level, entry.notes, entry.updated_at],
  )
  return entry
}

export function getInstructorProfile(notebookId: string): InstructorProfile | null {
  const row = queryOne<{ profile_json: string; updated_at: string }>(
    'SELECT profile_json, updated_at FROM instructor_profiles WHERE notebook_id = ?',
    [notebookId],
  )
  if (!row) return null
  const parsed = JSON.parse(row.profile_json) as Omit<InstructorProfile, 'notebook_id' | 'updated_at'>
  return { ...parsed, notebook_id: notebookId, updated_at: row.updated_at }
}

export function saveInstructorProfile(profile: InstructorProfile) {
  const json = JSON.stringify({
    summary: profile.summary,
    styles: profile.styles,
    topics: profile.topics,
    examples: profile.examples,
    limitations: profile.limitations,
  })
  const existing = queryOne('SELECT notebook_id FROM instructor_profiles WHERE notebook_id = ?', [
    profile.notebook_id,
  ])
  if (existing) {
    run('UPDATE instructor_profiles SET profile_json = ?, updated_at = ? WHERE notebook_id = ?', [
      json,
      profile.updated_at,
      profile.notebook_id,
    ])
  } else {
    run('INSERT INTO instructor_profiles (notebook_id, profile_json, updated_at) VALUES (?, ?, ?)', [
      profile.notebook_id,
      json,
      profile.updated_at,
    ])
  }
}

export function listExamAttempts(notebookId: string): ExamAttempt[] {
  return queryAll<{ id: string; notebook_id: string; score: number; total: number; weak_topics_json: string; created_at: string }>(
    'SELECT * FROM exam_attempts WHERE notebook_id = ? ORDER BY created_at DESC',
    [notebookId],
  ).map((row) => ({
    id: row.id,
    notebook_id: row.notebook_id,
    score: row.score,
    total: row.total,
    weak_topics: JSON.parse(row.weak_topics_json || '[]') as string[],
    created_at: row.created_at,
  }))
}

export function addExamAttempt(notebookId: string, score: number, total: number, weakTopics: string[]): ExamAttempt {
  const attempt: ExamAttempt = {
    id: uuid(),
    notebook_id: notebookId,
    score,
    total,
    weak_topics: weakTopics,
    created_at: new Date().toISOString(),
  }
  run(
    'INSERT INTO exam_attempts (id, notebook_id, score, total, weak_topics_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [attempt.id, notebookId, score, total, JSON.stringify(weakTopics), attempt.created_at],
  )
  return attempt
}

export function listConcepts(notebookId: string): ConceptProgress[] {
  return queryAll<ConceptProgress>(
    'SELECT * FROM concept_progress WHERE notebook_id = ? ORDER BY updated_at DESC',
    [notebookId],
  )
}

export function recordConcept(notebookId: string, concept: string, status: ConceptStatus): ConceptProgress {
  const existing = queryOne<ConceptProgress>(
    'SELECT * FROM concept_progress WHERE notebook_id = ? AND concept = ?',
    [notebookId, concept],
  )
  const updated_at = new Date().toISOString()
  if (existing) {
    run('UPDATE concept_progress SET status = ?, updated_at = ? WHERE id = ?', [status, updated_at, existing.id])
    return { ...existing, status, updated_at }
  }
  const entry: ConceptProgress = { id: uuid(), notebook_id: notebookId, concept, status, updated_at }
  run(
    'INSERT INTO concept_progress (id, notebook_id, concept, status, updated_at) VALUES (?, ?, ?, ?, ?)',
    [entry.id, entry.notebook_id, entry.concept, entry.status, entry.updated_at],
  )
  return entry
}

export function resetStudyProgress(notebookId: string) {
  run('DELETE FROM concept_progress WHERE notebook_id = ?', [notebookId])
  run('DELETE FROM exam_attempts WHERE notebook_id = ?', [notebookId])
  run('DELETE FROM strength_profile WHERE notebook_id = ?', [notebookId])
}

void rowToObject

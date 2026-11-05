import { app, BrowserWindow, ipcMain, Menu, Notification, shell } from 'electron'
import path from 'path'
import * as db from './db'
import * as secure from './secure'
import * as files from './files'
import * as ai from './ai'
import { checkForUpdates } from './updates'
import type { ConceptStatus, ExamConfig, McQuestion } from './types'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Ellify',
    backgroundColor: '#FAF8F3',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  await db.initDatabase()
  const due = db.countDueAll()
  if (due > 0 && Notification.isSupported()) {
    new Notification({
      title: 'Ellify',
      body: `יש ${due} כרטיסיות לתרגול. התזכורת מופיעה כשהאפליקציה נפתחת.`,
    }).show()
  }
  createWindow()
  void checkForUpdates(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// --- IPC: settings ---
ipcMain.handle('settings:get', () => db.getAppSettings(secure.hasApiKey()))
ipcMain.handle('settings:update', (_e, partial) => {
  db.updateAppSettings(partial)
  return db.getAppSettings(secure.hasApiKey())
})
ipcMain.handle('settings:setApiKey', (_e, key: string) => {
  secure.saveApiKey(key)
  return db.getAppSettings(secure.hasApiKey())
})
ipcMain.handle('settings:clearApiKey', () => {
  secure.clearApiKey()
  return db.getAppSettings(secure.hasApiKey())
})

// --- Notebooks ---
ipcMain.handle('notebooks:list', () => db.listNotebooks())
ipcMain.handle('notebooks:get', (_e, id: string) => db.getNotebook(id))
ipcMain.handle('notebooks:create', (_e, name: string, color: string) =>
  db.createNotebook(name, color),
)
ipcMain.handle('notebooks:update', (_e, id: string, data) => db.updateNotebook(id, data))
ipcMain.handle('notebooks:delete', (_e, id: string) => {
  db.deleteNotebook(id)
  return true
})

// --- Chapters ---
ipcMain.handle('chapters:list', (_e, notebookId: string) => db.listChapters(notebookId))
ipcMain.handle('chapters:create', (_e, notebookId: string, title: string) =>
  db.createChapter(notebookId, title),
)
ipcMain.handle('chapters:update', (_e, id: string, title: string) => db.updateChapter(id, title))
ipcMain.handle('chapters:delete', (_e, id: string) => {
  db.deleteChapter(id)
  return true
})

// --- Pages ---
ipcMain.handle('pages:list', (_e, chapterId: string) => db.listPages(chapterId))
ipcMain.handle('pages:listByNotebook', (_e, notebookId: string) =>
  db.listPagesByNotebook(notebookId),
)
ipcMain.handle('pages:get', (_e, id: string) => db.getPage(id))
ipcMain.handle('pages:create', (_e, chapterId: string, title: string) =>
  db.createPage(chapterId, title),
)
ipcMain.handle('pages:update', (_e, id: string, data) => db.updatePage(id, data))
ipcMain.handle('pages:delete', (_e, id: string) => {
  db.deletePage(id)
  return true
})

// --- Flashcards ---
ipcMain.handle('flashcards:list', (_e, notebookId: string) => db.listFlashcards(notebookId))
ipcMain.handle('flashcards:create', (_e, notebookId: string, front: string, back: string, topic?: string) =>
  db.createFlashcard(notebookId, front, back, topic || ''),
)
ipcMain.handle('flashcards:intervals', () => db.getLeitnerIntervals())
ipcMain.handle('flashcards:setIntervals', (_e, intervals: number[]) => {
  db.setLeitnerIntervals(intervals)
  return db.getLeitnerIntervals()
})
ipcMain.handle('flashcards:resetStats', (_e, notebookId: string) => {
  db.resetFlashcardStats(notebookId)
  return true
})
ipcMain.handle('flashcards:update', (_e, id: string, data) => db.updateFlashcard(id, data))
ipcMain.handle('flashcards:delete', (_e, id: string) => {
  db.deleteFlashcard(id)
  return true
})
ipcMain.handle('flashcards:due', (_e, notebookId: string) => db.dueFlashcards(notebookId))
ipcMain.handle('flashcards:countDue', () => db.countDueAll())
ipcMain.handle('flashcards:review', (_e, id: string, correct: boolean) =>
  db.reviewFlashcard(id, correct),
)

// --- Materials ---
ipcMain.handle('materials:list', (_e, notebookId: string, kind?: 'material' | 'past_exam') =>
  db.listMaterials(notebookId, kind),
)
ipcMain.handle(
  'materials:add',
  async (_e, notebookId: string, kind: 'material' | 'past_exam') => {
    const paths = await files.pickFiles(
      mainWindow,
      kind === 'past_exam' ? 'בחרי שחזורים' : 'בחרי חומרי לימוד',
    )
    const added = []
    for (const filepath of paths) {
      const text = await files.extractTextFromFile(filepath)
      const filename = path.basename(filepath)
      added.push(db.addMaterial(notebookId, kind, filename, filepath, text))
    }
    return added
  },
)
ipcMain.handle('materials:delete', (_e, id: string) => {
  db.deleteMaterial(id)
  return true
})
ipcMain.handle(
  'materials:update',
  (_e, id: string, data: { display_name?: string; enabled?: boolean }) => db.updateMaterial(id, data),
)

// --- Strength ---
ipcMain.handle('strength:list', (_e, notebookId: string) => db.listStrengths(notebookId))

// --- AI ---
function requireAi() {
  const key = secure.loadApiKey()
  if (!key) throw new Error('לא הוגדר מפתח API')
  const settings = db.getAppSettings(true)
  if (!settings.ai_enabled) throw new Error('מצב AI כבוי')
  return { key, model: settings.openai_model }
}

ipcMain.handle('ai:generateMcExam', async (_e, notebookId: string, config: ExamConfig) => {
  const { key, model } = requireAi()
  const passages = db.retrievePassages(notebookId, config.topics || '', {
    kinds: ['notes', 'material'],
    limit: 10,
  })
  const profile = config.matchInstructor ? db.getInstructorProfile(notebookId) : null
  const missed = config.focusMissed
    ? db.listConcepts(notebookId).filter((item) => item.status !== 'independent').map((item) => item.concept)
    : []
  return ai.generateMcExam(key, model, {
    materials: db.formatPassages(passages),
    instructor: profile ? JSON.stringify(profile) : '',
    missed: missed.join(', '),
    count: Math.min(Math.max(config.count || 5, 3), 20),
    difficulty: config.difficulty || 'medium',
    topics: config.topics || '',
    matchInstructor: !!config.matchInstructor,
  })
})

ipcMain.handle(
  'ai:scoreMcExam',
  (_e, questions: McQuestion[], answers: Record<string, number>, notebookId: string) => {
    const result = ai.scoreMcExam(questions, answers)
    for (const topic of result.weakTopics) {
      db.upsertStrength(notebookId, topic, 'weak', 'זוהה ממבחן אמריקאי')
      db.recordConcept(notebookId, topic, 'still_wrong')
    }
    db.addExamAttempt(notebookId, result.score, result.total, result.weakTopics)
    return result
  },
)

ipcMain.handle('ai:analyzeInstructor', async (_e, notebookId: string) => {
  const { key, model } = requireAi()
  const passages = db.retrievePassages(notebookId, '', { kinds: ['past_exam'], limit: 12 })
  if (!passages.length) throw new Error('אין שחזורי מבחנים פעילים לניתוח')
  const profile = await ai.analyzeInstructor(key, model, db.formatPassages(passages))
  const saved = { ...profile, notebook_id: notebookId, updated_at: new Date().toISOString() }
  db.saveInstructorProfile(saved)
  return saved
})

ipcMain.handle('profile:get', (_e, notebookId: string) => db.getInstructorProfile(notebookId))

ipcMain.handle('progress:concepts', (_e, notebookId: string) => db.listConcepts(notebookId))
ipcMain.handle('progress:exams', (_e, notebookId: string) => db.listExamAttempts(notebookId))
ipcMain.handle('progress:reset', (_e, notebookId: string) => {
  db.resetStudyProgress(notebookId)
  return true
})
ipcMain.handle(
  'progress:record',
  (_e, notebookId: string, concept: string, status: ConceptStatus) =>
    db.recordConcept(notebookId, concept, status),
)

ipcMain.handle('ai:openQuestion', async (_e, notebookId: string, focus: string) => {
  const { key, model } = requireAi()
  const passages = db.retrievePassages(notebookId, focus || '', { kinds: ['notes', 'material'], limit: 8 })
  return ai.generateOpenQuestion(key, model, db.formatPassages(passages), focus)
})

ipcMain.handle(
  'ai:evaluateOpen',
  async (
    _e,
    notebookId: string,
    input: { question: string; concept: string; answer: string; reveal: boolean },
  ) => {
    const { key, model } = requireAi()
    const passages = db.retrievePassages(notebookId, input.concept || input.question, {
      kinds: ['notes', 'material'],
      limit: 8,
    })
    const result = await ai.evaluateOpenAnswer(key, model, {
      ...input,
      materials: db.formatPassages(passages),
    })
    const status =
      result.verdict === 'correct'
        ? 'independent'
        : result.verdict === 'insufficient_sources'
          ? 'still_wrong'
          : input.reveal
            ? 'after_reveal'
            : 'after_hint'
    if (input.concept) db.recordConcept(notebookId, input.concept, status)
    return { ...result, sources: passages.map((p) => p.source) }
  },
)

ipcMain.handle(
  'ai:assist',
  async (
    _e,
    notebookId: string,
    action: 'explain' | 'summarize' | 'simplify' | 'expand' | 'questions',
    selection: string,
  ) => {
    const { key, model } = requireAi()
    const passages = db.retrievePassages(notebookId, selection, { kinds: ['notes', 'material'], limit: 4 })
    return ai.assistSelection(key, model, action, selection, db.formatPassages(passages))
  },
)

ipcMain.handle(
  'ai:feynman',
  async (_e, notebookId: string, topic: string, explanation: string) => {
    const key = secure.loadApiKey()
    if (!key) throw new Error('לא הוגדר מפתח API')
    const settings = db.getAppSettings(true)
    if (!settings.ai_enabled) throw new Error('מצב AI כבוי')
    const passages = db.retrievePassages(notebookId, topic, { kinds: ['notes', 'material'], limit: 8 })
    const result = await ai.runFeynman(
      key,
      settings.openai_model,
      topic,
      explanation,
      db.formatPassages(passages),
    )
    for (const gap of result.gaps) {
      db.upsertStrength(notebookId, gap, 'weak', 'זוהה מפיינמן')
    }
    for (const s of result.strengths) {
      db.upsertStrength(notebookId, s, 'strong', 'זוהה מפיינמן')
    }
    return result
  },
)

ipcMain.handle(
  'ai:chat',
  async (
    _e,
    notebookId: string,
    history: { role: 'user' | 'assistant'; content: string }[],
  ) => {
    const key = secure.loadApiKey()
    if (!key) throw new Error('לא הוגדר מפתח API')
    const settings = db.getAppSettings(true)
    if (!settings.ai_enabled) throw new Error('מצב AI כבוי')
    const passages = db.retrievePassages(
      notebookId,
      history[history.length - 1]?.content || '',
      { kinds: ['notes', 'material'], limit: 8 },
    )
    return ai.studyChat(key, settings.openai_model, db.formatPassages(passages), history)
  },
)

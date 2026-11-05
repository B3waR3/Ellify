import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  Notebook,
  Chapter,
  Page,
  Flashcard,
  Material,
  StrengthEntry,
  McQuestion,
  McExamResult,
  FeynmanResult,
  ExamConfig,
  InstructorProfile,
  ExamAttempt,
  ConceptProgress,
  ConceptStatus,
  OpenQuestion,
  OpenEvaluation,
} from './types'

const api = {
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    update: (partial: Partial<Omit<AppSettings, 'has_api_key'>>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:update', partial),
    setApiKey: (key: string): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:setApiKey', key),
    clearApiKey: (): Promise<AppSettings> => ipcRenderer.invoke('settings:clearApiKey'),
  },
  notebooks: {
    list: (): Promise<Notebook[]> => ipcRenderer.invoke('notebooks:list'),
    get: (id: string): Promise<Notebook | null> => ipcRenderer.invoke('notebooks:get', id),
    create: (name: string, color: string): Promise<Notebook> =>
      ipcRenderer.invoke('notebooks:create', name, color),
    update: (
      id: string,
      data: Partial<Pick<Notebook, 'name' | 'color' | 'exam_date'>>,
    ): Promise<Notebook | null> => ipcRenderer.invoke('notebooks:update', id, data),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('notebooks:delete', id),
  },
  chapters: {
    list: (notebookId: string): Promise<Chapter[]> =>
      ipcRenderer.invoke('chapters:list', notebookId),
    create: (notebookId: string, title: string): Promise<Chapter> =>
      ipcRenderer.invoke('chapters:create', notebookId, title),
    update: (id: string, title: string): Promise<Chapter | null> =>
      ipcRenderer.invoke('chapters:update', id, title),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('chapters:delete', id),
  },
  pages: {
    list: (chapterId: string): Promise<Page[]> => ipcRenderer.invoke('pages:list', chapterId),
    listByNotebook: (notebookId: string): Promise<Page[]> =>
      ipcRenderer.invoke('pages:listByNotebook', notebookId),
    get: (id: string): Promise<Page | null> => ipcRenderer.invoke('pages:get', id),
    create: (chapterId: string, title: string): Promise<Page> =>
      ipcRenderer.invoke('pages:create', chapterId, title),
    update: (
      id: string,
      data: Partial<Pick<Page, 'title' | 'content_json'>>,
    ): Promise<Page | null> => ipcRenderer.invoke('pages:update', id, data),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('pages:delete', id),
  },
  flashcards: {
    list: (notebookId: string): Promise<Flashcard[]> =>
      ipcRenderer.invoke('flashcards:list', notebookId),
    create: (notebookId: string, front: string, back: string, topic?: string): Promise<Flashcard> =>
      ipcRenderer.invoke('flashcards:create', notebookId, front, back, topic),
    update: (
      id: string,
      data: Partial<Pick<Flashcard, 'front' | 'back' | 'topic'>>,
    ): Promise<Flashcard | null> => ipcRenderer.invoke('flashcards:update', id, data),
    intervals: (): Promise<number[]> => ipcRenderer.invoke('flashcards:intervals'),
    setIntervals: (intervals: number[]): Promise<number[]> =>
      ipcRenderer.invoke('flashcards:setIntervals', intervals),
    resetStats: (notebookId: string): Promise<boolean> =>
      ipcRenderer.invoke('flashcards:resetStats', notebookId),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('flashcards:delete', id),
    due: (notebookId: string): Promise<Flashcard[]> =>
      ipcRenderer.invoke('flashcards:due', notebookId),
    countDue: (): Promise<number> => ipcRenderer.invoke('flashcards:countDue'),
    review: (id: string, correct: boolean): Promise<Flashcard | null> =>
      ipcRenderer.invoke('flashcards:review', id, correct),
  },
  materials: {
    list: (notebookId: string, kind?: 'material' | 'past_exam'): Promise<Material[]> =>
      ipcRenderer.invoke('materials:list', notebookId, kind),
    add: (notebookId: string, kind: 'material' | 'past_exam'): Promise<Material[]> =>
      ipcRenderer.invoke('materials:add', notebookId, kind),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('materials:delete', id),
    update: (
      id: string,
      data: { display_name?: string; enabled?: boolean },
    ): Promise<Material | null> => ipcRenderer.invoke('materials:update', id, data),
  },
  profile: {
    get: (notebookId: string): Promise<InstructorProfile | null> =>
      ipcRenderer.invoke('profile:get', notebookId),
  },
  progress: {
    concepts: (notebookId: string): Promise<ConceptProgress[]> =>
      ipcRenderer.invoke('progress:concepts', notebookId),
    exams: (notebookId: string): Promise<ExamAttempt[]> =>
      ipcRenderer.invoke('progress:exams', notebookId),
    reset: (notebookId: string): Promise<boolean> => ipcRenderer.invoke('progress:reset', notebookId),
    record: (notebookId: string, concept: string, status: ConceptStatus): Promise<ConceptProgress> =>
      ipcRenderer.invoke('progress:record', notebookId, concept, status),
  },
  strength: {
    list: (notebookId: string): Promise<StrengthEntry[]> =>
      ipcRenderer.invoke('strength:list', notebookId),
  },
  ai: {
    generateMcExam: (notebookId: string, config: ExamConfig): Promise<McQuestion[]> =>
      ipcRenderer.invoke('ai:generateMcExam', notebookId, config),
    analyzeInstructor: (notebookId: string): Promise<InstructorProfile> =>
      ipcRenderer.invoke('ai:analyzeInstructor', notebookId),
    openQuestion: (notebookId: string, focus: string): Promise<OpenQuestion> =>
      ipcRenderer.invoke('ai:openQuestion', notebookId, focus),
    evaluateOpen: (
      notebookId: string,
      input: { question: string; concept: string; answer: string; reveal: boolean },
    ): Promise<OpenEvaluation & { sources: string[] }> =>
      ipcRenderer.invoke('ai:evaluateOpen', notebookId, input),
    assist: (
      notebookId: string,
      action: 'explain' | 'summarize' | 'simplify' | 'expand' | 'questions',
      selection: string,
    ): Promise<string> => ipcRenderer.invoke('ai:assist', notebookId, action, selection),
    scoreMcExam: (
      questions: McQuestion[],
      answers: Record<string, number>,
      notebookId: string,
    ): Promise<McExamResult> =>
      ipcRenderer.invoke('ai:scoreMcExam', questions, answers, notebookId),
    feynman: (
      notebookId: string,
      topic: string,
      explanation: string,
    ): Promise<FeynmanResult> =>
      ipcRenderer.invoke('ai:feynman', notebookId, topic, explanation),
    chat: (
      notebookId: string,
      history: { role: 'user' | 'assistant'; content: string }[],
    ): Promise<string> => ipcRenderer.invoke('ai:chat', notebookId, history),
  },
}

contextBridge.exposeInMainWorld('ella', api)

export type EllaApi = typeof api

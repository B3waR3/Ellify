export type Notebook = {
  id: string
  name: string
  color: string
  exam_date: string | null
  created_at: string
}

export type Chapter = {
  id: string
  notebook_id: string
  title: string
  sort_order: number
}

export type Page = {
  id: string
  chapter_id: string
  title: string
  content_json: string
  sort_order: number
  updated_at: string
}

export type Flashcard = {
  id: string
  notebook_id: string
  front: string
  back: string
  topic: string
  box: number
  next_review_at: string
  created_at: string
  reviews: number
  successes: number
  failures: number
}

export type Material = {
  id: string
  notebook_id: string
  kind: 'material' | 'past_exam'
  filename: string
  display_name: string
  filepath: string
  extracted_text: string
  enabled: boolean
  created_at: string
}

export type Passage = {
  source: string
  kind: 'notes' | 'material' | 'past_exam'
  text: string
}

export type ExamConfig = {
  count: number
  difficulty: 'easy' | 'medium' | 'hard'
  topics: string
  matchInstructor: boolean
  focusMissed: boolean
  minutes: number | null
}

export type InstructorProfile = {
  notebook_id: string
  summary: string
  styles: string[]
  topics: { topic: string; frequency: string; confidence: 'low' | 'medium' | 'high' }[]
  examples: string[]
  limitations: string
  updated_at: string
}

export type ExamAttempt = {
  id: string
  notebook_id: string
  score: number
  total: number
  weak_topics: string[]
  created_at: string
}

export type ConceptStatus = 'independent' | 'after_hint' | 'after_reveal' | 'still_wrong'

export type ConceptProgress = {
  id: string
  notebook_id: string
  concept: string
  status: ConceptStatus
  updated_at: string
}

export type OpenQuestion = {
  prompt: string
  concept: string
  sourceLabels: string[]
}

export type OpenEvaluation = {
  verdict: 'correct' | 'partial' | 'incorrect' | 'insufficient_sources'
  correctPoints: string[]
  missing: string[]
  misconceptions: string[]
  hint: string
  enhancedParts: { text: string; added: boolean }[]
  followUp: string
  feedback: string
}

export type AppSettings = {
  onboarding_done: boolean
  ai_enabled: boolean
  openai_model: string
  has_api_key: boolean
}

export type StrengthEntry = {
  id: string
  notebook_id: string
  topic: string
  level: 'weak' | 'strong'
  notes: string
  updated_at: string
}

export type McQuestion = {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
  sources: string[]
}

export type McExamResult = {
  score: number
  total: number
  weakTopics: string[]
}

export type FeynmanResult = {
  gaps: string[]
  strengths: string[]
  feedback: string
}

import type {
  FeynmanResult,
  McQuestion,
  McExamResult,
  InstructorProfile,
  OpenQuestion,
  OpenEvaluation,
} from './types'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

async function chat(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  json = false,
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    temperature: 0.4,
    messages,
  }
  if (json) body.response_format = { type: 'json_object' }

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`שגיאת OpenAI (${res.status}): ${errText.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('תשובה ריקה מהמודל')
  return content
}

export function validateMcQuestions(raw: McQuestion[]): McQuestion[] {
  const seen = new Set<string>()
  const valid: McQuestion[] = []
  for (const question of raw) {
    if (!question?.prompt?.trim() || !Array.isArray(question.options)) continue
    const options = question.options.map((option) => String(option).trim()).filter(Boolean)
    if (options.length < 3 || new Set(options).size !== options.length) continue
    if (question.correctIndex < 0 || question.correctIndex >= options.length) continue
    const key = question.prompt.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    valid.push({
      id: question.id || `q${valid.length + 1}`,
      prompt: question.prompt.trim(),
      options,
      correctIndex: question.correctIndex,
      explanation: question.explanation || '',
      sources: question.sources || [],
    })
  }
  if (!valid.length) throw new Error('השאלות לא עברו בדיקה: חסרה תשובה אחת ברורה או שיש כפילויות')
  return valid
}

export async function generateMcExam(
  apiKey: string,
  model: string,
  input: {
    materials: string
    instructor: string
    missed: string
    count: number
    difficulty: string
    topics: string
    matchInstructor: boolean
  },
): Promise<McQuestion[]> {
  const system = `אתה כותב מבחן אמריקאי אקדמי בעברית.
העובדות מגיעות רק מחומרי הלימוד. שחזורים משמשים לסגנון השאלות בלבד, לא כמקור אמת.
לכל שאלה בדיוק תשובה נכונה אחת. המסיחים סבירים, לא מגוחכים, ולא זהים זה לזה.
אל תחזרי על אותה שאלה. אם אין בחומר בסיס לשאלה — אל תמציאי אותה.
החזר JSON:
{"questions":[{"id":"q1","prompt":"...","options":["א","ב","ג","ד"],"correctIndex":0,"explanation":"...","sources":["שם מקור"]}]}`

  const user = `מספר שאלות: ${input.count}
רמת קושי: ${input.difficulty}
נושאים: ${input.topics || 'כל החומר הזמין'}
התאמה לסגנון המרצה: ${input.matchInstructor ? 'כן, רק אם יש פרופיל' : 'לא'}
נושאים שכדאי לחזק: ${input.missed || 'אין'}

=== קטעים מחומרי הלימוד ===
${input.materials || '(אין קטעים)'}

=== פרופיל סגנון שאלות, אם קיים ===
${input.instructor || '(אין פרופיל)'}`

  const raw = await chat(apiKey, model, [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ], true)
  const parsed = JSON.parse(raw) as { questions?: McQuestion[] }
  return validateMcQuestions(parsed.questions || [])
}

export async function analyzeInstructor(
  apiKey: string,
  model: string,
  pastExams: string,
): Promise<Omit<InstructorProfile, 'notebook_id' | 'updated_at'>> {
  const system = `אתה מנתח שחזורי מבחנים כדי לזהות איך מרצה נוהג לנסח שאלות.
אל תתייחס לתשובות בשחזורים כנכונות. אל תנבא את המבחן האמיתי בוודאות.
אם יש מעט דוגמאות, ציין שהניתוח מוגבל.
החזר JSON:
{"summary":"...","styles":["..."],"topics":[{"topic":"...","frequency":"...","confidence":"low"}],"examples":["..."],"limitations":"..."}
confidence הוא רק low, medium או high.`

  const raw = await chat(apiKey, model, [
    { role: 'system', content: system },
    { role: 'user', content: pastExams.slice(0, 50000) || '(אין שחזורים)' },
  ], true)
  const parsed = JSON.parse(raw) as Omit<InstructorProfile, 'notebook_id' | 'updated_at'>
  return {
    summary: parsed.summary || '',
    styles: parsed.styles || [],
    topics: parsed.topics || [],
    examples: parsed.examples || [],
    limitations: parsed.limitations || 'הניתוח מבוסס על המסמכים שהועלו בלבד.',
  }
}

export async function generateOpenQuestion(
  apiKey: string,
  model: string,
  materials: string,
  focus: string,
): Promise<OpenQuestion> {
  const system = `כתוב שאלת שליפה פתוחה אחת בעברית, מתוך קטעי המקור בלבד.
אל תכלול את התשובה. החזר JSON:
{"prompt":"...","concept":"המושג המרכזי","sourceLabels":["מקור"]}`
  const raw = await chat(apiKey, model, [
    { role: 'system', content: system },
    { role: 'user', content: `מיקוד: ${focus || 'נושא מרכזי מהחומר'}\n\n${materials}` },
  ], true)
  const parsed = JSON.parse(raw) as OpenQuestion
  if (!parsed.prompt) throw new Error('לא נוצרה שאלה')
  return {
    prompt: parsed.prompt,
    concept: parsed.concept || focus || 'נושא כללי',
    sourceLabels: parsed.sourceLabels || [],
  }
}

export async function evaluateOpenAnswer(
  apiKey: string,
  model: string,
  input: { question: string; concept: string; answer: string; materials: string; reveal: boolean },
): Promise<OpenEvaluation> {
  const system = `אתה מעריך תשובה של סטודנטית מול קטעי מקור. כתוב בעברית.
הבחן בין טעות עובדתית, מידע חסר, ניסוח חלופי תקין, ומידע שאין במקורות.
אל תעניש ניסוח שונה אם הרעיון נכון.
אם reveal=false: אל תחזיר את התשובה המלאה. תן רמז שמכוון לשליפה בלי למסור את החסר. enhancedParts יישאר ריק.
אם reveal=true: enhancedParts הוא התשובה המורחבת כמקטעים. added=false לתוכן שהסטודנטית כתבה נכון, added=true רק לתוספת או תיקון שלך.
החזר JSON:
{"verdict":"correct|partial|incorrect|insufficient_sources","correctPoints":[],"missing":[],"misconceptions":[],"hint":"...","enhancedParts":[{"text":"...","added":false}],"followUp":"שאלת שליפה קצרה על החסר","feedback":"..."}`
  const raw = await chat(apiKey, model, [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `reveal=${input.reveal}
מושג: ${input.concept}
שאלה: ${input.question}
תשובת הסטודנטית (אין לשנות אותה):
${input.answer}

=== מקורות ===
${input.materials || '(אין מקורות)'}`,
    },
  ], true)
  const parsed = JSON.parse(raw) as OpenEvaluation
  return {
    verdict: parsed.verdict || 'partial',
    correctPoints: parsed.correctPoints || [],
    missing: parsed.missing || [],
    misconceptions: parsed.misconceptions || [],
    hint: parsed.hint || '',
    enhancedParts: input.reveal ? parsed.enhancedParts || [] : [],
    followUp: parsed.followUp || '',
    feedback: parsed.feedback || '',
  }
}

export async function assistSelection(
  apiKey: string,
  model: string,
  action: 'explain' | 'summarize' | 'simplify' | 'expand' | 'questions',
  selection: string,
  materials: string,
): Promise<string> {
  const labels = {
    explain: 'הסבירי את הקטע',
    summarize: 'סכמי את הקטע',
    simplify: 'פשטי את ההסבר',
    expand: 'הרחיבי את ההסבר',
    questions: 'כתבי שאלות תרגול קצרות על הקטע',
  }
  return chat(apiKey, model, [
    {
      role: 'system',
      content: `את עוזרת כתיבה בעברית. ${labels[action]}. אל תשני את הטקסט המקורי בעצמך — החזירי הצעה בלבד. אם אין מספיק הקשר, אמרי זאת.\n\nמקורות:\n${materials.slice(0, 12000)}`,
    },
    { role: 'user', content: selection.slice(0, 4000) },
  ], false)
}

export function scoreMcExam(
  questions: McQuestion[],
  answers: Record<string, number>,
): McExamResult {
  let score = 0
  const weakTopics: string[] = []
  for (const q of questions) {
    if (answers[q.id] === q.correctIndex) {
      score += 1
    } else {
      weakTopics.push(q.prompt.slice(0, 80))
    }
  }
  return { score, total: questions.length, weakTopics }
}

export async function runFeynman(
  apiKey: string,
  model: string,
  topic: string,
  explanation: string,
  materials: string,
): Promise<FeynmanResult> {
  const system = `אתה מעריך הבנה בשיטת פיינמן. הסטודנט מסביר בעל פה נושא מהזיכרון.
זהה פערים (חולשות) וחוזקות. כתוב בעברית.
החזר JSON:
{"gaps":["..."],"strengths":["..."],"feedback":"משוב קצר ומעשי"}`

  const user = `נושא: ${topic}

הסבר הסטודנט:
${explanation}

=== הקשר מחומרי הלימוד (אם יש) ===
${materials.slice(0, 40000) || '(אין)'}`

  const raw = await chat(
    apiKey,
    model,
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    true,
  )
  const parsed = JSON.parse(raw) as FeynmanResult
  return {
    gaps: parsed.gaps || [],
    strengths: parsed.strengths || [],
    feedback: parsed.feedback || '',
  }
}

export async function studyChat(
  apiKey: string,
  model: string,
  materials: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const system = `את עוזרת לימוד בעברית לסטודנטית. עני בבהירות, קצר ולעניין.
הסתמכי על חומרי הלימוד שסופקו כשיש. אם משהו לא בחומר — אמרי זאת.
אל תיצרי כרטיסיות אלא אם התבקשת במפורש להסביר נושא.

=== חומרי המחברת ===
${materials.slice(0, 50000) || '(אין חומרים שהועלו עדיין)'}`

  return chat(apiKey, model, [{ role: 'system', content: system }, ...history], false)
}

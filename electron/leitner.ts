/** Five Leitner boxes. Default intervals: 1, 2, 4, 8, 16 days. Box 5 stays at the longest interval. */

export const DEFAULT_INTERVALS = [1, 2, 4, 8, 16]

export function normalizeBox(box: number): number {
  if (!Number.isFinite(box) || box < 1) return 1
  return Math.min(Math.round(box), 5)
}

export function intervalDaysForBox(box: number, intervals: number[] = DEFAULT_INTERVALS): number {
  const level = normalizeBox(box)
  const days = intervals[level - 1]
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_INTERVALS[level - 1]
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export function todayIso(): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

export function clampBeforeExam(nextReview: string, examDate: string | null): string {
  if (!examDate) return nextReview
  const exam = new Date(examDate)
  exam.setHours(12, 0, 0, 0)
  const next = new Date(nextReview)
  if (next.getTime() > exam.getTime()) {
    // Keep a review on the day before exam when possible
    const dayBefore = new Date(exam)
    dayBefore.setDate(dayBefore.getDate() - 1)
    const now = new Date()
    now.setHours(12, 0, 0, 0)
    if (dayBefore.getTime() < now.getTime()) {
      return exam.toISOString()
    }
    return dayBefore.toISOString()
  }
  return nextReview
}

export function onCorrect(
  box: number,
  examDate: string | null,
  intervals: number[] = DEFAULT_INTERVALS,
): { box: number; next_review_at: string } {
  const nextBox = Math.min(normalizeBox(box) + 1, 5)
  const next = clampBeforeExam(addDays(todayIso(), intervalDaysForBox(nextBox, intervals)), examDate)
  return { box: nextBox, next_review_at: next }
}

export function onWrong(
  _box: number,
  examDate: string | null,
  intervals: number[] = DEFAULT_INTERVALS,
): { box: number; next_review_at: string } {
  const next = clampBeforeExam(addDays(todayIso(), intervalDaysForBox(1, intervals)), examDate)
  return { box: 1, next_review_at: next }
}

export function initialReview(): { box: number; next_review_at: string } {
  return { box: 1, next_review_at: todayIso() }
}

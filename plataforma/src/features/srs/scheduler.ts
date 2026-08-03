import type { Grade } from './types'

/** Días hasta el próximo repaso según la “caja” de Leitner. */
const INTERVALS_DAYS = [0, 1, 3, 7, 16, 35]
const MAX_BOX = INTERVALS_DAYS.length - 1

/** Lógica **pura** de la repetición espaciada. */
export function nextBox(prevBox: number, grade: Grade): number {
  if (grade === 'bad') return 0
  return Math.min(prevBox + 1, MAX_BOX)
}

export function intervalDays(box: number): number {
  return INTERVALS_DAYS[Math.min(Math.max(box, 0), MAX_BOX)] ?? 0
}

/** Fecha de próximo repaso a partir de la caja (ISO). */
export function dueDate(box: number, from: Date = new Date()): string {
  const date = new Date(from)
  date.setDate(date.getDate() + intervalDays(box))
  return date.toISOString()
}

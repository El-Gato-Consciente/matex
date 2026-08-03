/** Tipos del sistema de repetición espaciada (SRS), independientes del contenido. */

export type Grade = 'good' | 'bad'

/** Estado de un ítem (sistema Leitner). */
export interface Schedule {
  readonly box: number
  /** Próxima fecha de repaso (ISO 8601). */
  readonly dueAt: string
}

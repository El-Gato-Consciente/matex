/** PUERTO de persistencia del progreso del alumno. */

export interface LessonProgress {
  readonly lessonId: string
  /** ISO 8601. */
  readonly completedAt: string
}

export interface ProgressStore {
  isCompleted(lessonId: string): boolean
  markCompleted(lessonId: string): void
  /** Todas las lecciones completadas, para calcular avance por nivel. */
  all(): readonly LessonProgress[]
}

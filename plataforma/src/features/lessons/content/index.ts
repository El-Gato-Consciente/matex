import { levelSchema, type Lesson, type Level } from '../types'
import { nivel0 } from './nivel0'
import { nivel1 } from './nivel1'
import { nivel2 } from './nivel2'
import { nivel3 } from './nivel3'
import { nivel4 } from './nivel4'

/** Ruta de aprendizaje completa, validada con zod al cargar (falla temprano). */
export const levels: readonly Level[] = [nivel0, nivel1, nivel2, nivel3, nivel4].map((level) =>
  levelSchema.parse(level),
)

/** Todas las lecciones en orden de ruta (para navegación anterior/siguiente). */
export const allLessons: readonly Lesson[] = levels.flatMap((level) => level.lessons)

const firstCandidate = levels[0]?.lessons[0]
if (!firstCandidate) {
  throw new Error('content: la ruta de aprendizaje necesita al menos una lección')
}
/** Primera lección de la ruta (garantizada por la validación de arriba). */
export const firstLesson: Lesson = firstCandidate

export function findLesson(lessonId: string): Lesson | undefined {
  return allLessons.find((lesson) => lesson.id === lessonId)
}

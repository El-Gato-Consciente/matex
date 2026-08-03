import { filesInput, type CompileInput } from '@/features/compiler/types'
import type { Lesson } from './types'

/**
 * Construye el input de compilación de una lección: el archivo principal (cuyo
 * contenido es `source` — el ejemplo o el starter/solución que el alumno edita)
 * más los archivos acompañantes de la lección. Funciona igual para lecciones de
 * un solo archivo (`files` vacío).
 */
export function lessonCompileInput(lesson: Lesson, source: string): CompileInput {
  return filesInput(lesson.mainFile, source, lesson.files)
}

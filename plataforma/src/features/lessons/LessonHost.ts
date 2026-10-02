import { createContext, useContext } from 'react'
import type { LatexCompiler } from '@/features/compiler/LatexCompiler'
import type { ReviewStore } from '@/features/srs/ReviewStore'
import type { LessonDestination } from './types'

/**
 * Lo que los bloques **interactivos** de una lección necesitan de la app: los puertos
 * (compilador, SRS) y la navegación. Va por contexto para no perforar props a través
 * de lector, panel y contenido; la app lo provee una sola vez.
 */
export interface LessonHost {
  readonly compiler: LatexCompiler
  readonly reviewStore: ReviewStore
  /** Lleva a otra parte de la app (bloque `destinations`). */
  navigate(to: LessonDestination): void
  /** Se respondió una pregunta (para refrescar el contador de repaso). */
  onAnswered(): void
  /** El alumno acertó todo el chequeo de la lección (bloque `check`). */
  onCheckPassed(lessonId: string): void
}

const LessonHostContext = createContext<LessonHost | null>(null)

export const LessonHostProvider = LessonHostContext.Provider

export function useLessonHost(): LessonHost {
  const host = useContext(LessonHostContext)
  if (!host) throw new Error('useLessonHost: falta <LessonHostProvider> arriba en el árbol.')
  return host
}

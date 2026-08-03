import type { Grade, Schedule } from './types'

/** PUERTO de persistencia del SRS. localStorage hoy, backend luego. */
export interface ReviewStore {
  get(itemId: string): Schedule | undefined
  /** Registra una respuesta y reprograma el ítem. */
  review(itemId: string, grade: Grade): void
  /** ¿Toca repasarlo? Los ítems nuevos (sin estado) están vencidos. */
  isDue(itemId: string, now?: Date): boolean
}

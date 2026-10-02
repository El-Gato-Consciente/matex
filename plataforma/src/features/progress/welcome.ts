const STORAGE_KEY = 'matex.welcomed.v1'

interface WelcomeContext {
  /** Lecciones completadas: si ya hay, no es alguien nuevo. */
  readonly completedLessons: number
  /** Proyectos guardados: si ya hay, tampoco. */
  readonly projects: number
}

/**
 * ¿Hay que recibir al alumno con la Bienvenida del Curso? Solo la **primera vez**:
 * sin la marca y sin rastros de uso previo (así quien ya usaba la app antes de que
 * existiera la marca no termina en la Bienvenida). Solo lee: la marca la escribe
 * `markWelcomed`, aparte, para que leer dos veces (StrictMode) dé lo mismo.
 */
export function shouldWelcome(
  { completedLessons, projects }: WelcomeContext,
  storage: Storage = window.localStorage,
): boolean {
  return storage.getItem(STORAGE_KEY) === null && completedLessons === 0 && projects === 0
}

/** Registra que la Bienvenida ya se mostró (idempotente). */
export function markWelcomed(storage: Storage = window.localStorage): void {
  storage.setItem(STORAGE_KEY, new Date().toISOString())
}

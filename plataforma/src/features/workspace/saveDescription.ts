/**
 * **Qué decirle al usuario sobre el guardado** (lógica pura; el componente es `SaveStatus`).
 *
 * Hay dos guardados y son independientes:
 *  - **Local** (este navegador): siempre, con o sin cuenta.
 *  - **Nube** (con sesión): sube lo que ya está guardado localmente.
 * El mensaje dice siempre el estado *más débil* que sea cierto: nunca «en la nube» si el último
 * cambio todavía no subió.
 */

/** Estado de la nube para el documento abierto. */
export interface CloudSave {
  /** ¿Hay una pasada de sincronización corriendo? */
  readonly syncing: boolean
  /** ¿La copia de la nube es igual a la guardada en este navegador? */
  readonly synced: boolean
  /** La última pasada falló (sin conexión, la API no responde…). */
  readonly failed: boolean
}

export type SaveTone = 'busy' | 'local' | 'cloud' | 'warn'

export interface SaveDescription {
  readonly tone: SaveTone
  readonly label: string
  /** Versión corta del `label`, para cuando la barra no tiene lugar. */
  readonly short: string
  /** Explicación larga (tooltip). */
  readonly detail: string
}

export function describeSave(localSaved: boolean, cloud?: CloudSave): SaveDescription {
  if (!localSaved) {
    return { tone: 'busy', label: 'Guardando…', short: 'Guardando…', detail: 'Guardando los últimos cambios en este navegador.' }
  }
  if (!cloud) {
    return {
      tone: 'local',
      label: 'Guardado en este equipo',
      short: 'En este equipo',
      detail: 'Los cambios se guardan solos en este navegador. Iniciá sesión para tenerlos también en la nube.',
    }
  }
  if (cloud.synced) {
    return { tone: 'cloud', label: 'Guardado en la nube', short: 'En la nube', detail: 'El documento está guardado en este navegador y en tu cuenta.' }
  }
  if (cloud.syncing) {
    return { tone: 'busy', label: 'Subiendo a la nube…', short: 'Subiendo…', detail: 'Guardado en este navegador; subiendo los cambios a tu cuenta.' }
  }
  if (cloud.failed) {
    return {
      tone: 'warn',
      label: 'Guardado en este equipo, sin subir',
      short: 'Sin subir',
      detail: 'No se pudo subir a la nube (¿sin conexión?). Los cambios están guardados en este navegador y se reintenta solo.',
    }
  }
  return {
    tone: 'local',
    label: 'Guardado en este equipo',
    short: 'En este equipo',
    detail: 'Guardado en este navegador. Se sube a tu cuenta en unos segundos (o al cerrar el documento).',
  }
}

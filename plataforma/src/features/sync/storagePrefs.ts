/**
 * **Dónde se guardan los proyectos de la cuenta**: en nuestro S3 («Matex») o en el Google Drive
 * del usuario, y en qué carpeta de cada uno. Vive en el navegador (por cuenta), no en nuestras
 * tablas. Cada proyecto recuerda dónde vive el suyo: cambiar esto solo afecta a los nuevos, salvo
 * que el usuario pida mudar los que ya están.
 */

export type ContentStorage = 'matex' | 'drive'

export interface StoragePrefs {
  /** Dónde van los proyectos nuevos. */
  readonly defaultStorage: ContentStorage
  /** Carpeta dentro del espacio del usuario en nuestro S3. */
  readonly s3Path: string
  /** Carpeta en el Drive del usuario (desde la raíz); adentro se replica el árbol de Matex. */
  readonly drivePath: string
}

export const DEFAULT_PREFS: StoragePrefs = { defaultStorage: 'matex', s3Path: 'matex/projects', drivePath: 'Matex' }

const STORAGE_KEY = 'matex.storagePrefs.v1'

/** Mismo criterio que la lambda: hasta 6 niveles; letras (con tilde o ñ), números, espacio, `_`, `-`, `.`. */
const SEGMENT_RE = /^[\p{L}\p{N}_][\p{L}\p{N}_ .-]{0,63}$/u

/** Segmentos de una ruta escrita por el usuario (`" /Facultad/ Análisis/"` → `["Facultad", "Análisis"]`). */
export function pathSegments(path: string): string[] {
  return path
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

/** `null` si la ruta sirve; si no, por qué (para mostrarlo al lado del campo). */
export function pathProblem(path: string): string | null {
  const segments = pathSegments(path)
  if (segments.length === 0) return 'Elegí una carpeta.'
  if (segments.length > 6) return 'Hasta 6 niveles de carpetas.'
  const bad = segments.find((segment) => !SEGMENT_RE.test(segment) || segment.includes('..'))
  return bad ? `«${bad}» tiene caracteres no permitidos.` : null
}

export function loadPrefs(user: string, storage: Storage = window.localStorage): StoragePrefs {
  try {
    const all = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Partial<StoragePrefs>>
    const saved = all[user] ?? {}
    return {
      defaultStorage: saved.defaultStorage === 'drive' ? 'drive' : 'matex',
      s3Path: typeof saved.s3Path === 'string' && !pathProblem(saved.s3Path) ? saved.s3Path : DEFAULT_PREFS.s3Path,
      drivePath: typeof saved.drivePath === 'string' && !pathProblem(saved.drivePath) ? saved.drivePath : DEFAULT_PREFS.drivePath,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(user: string, prefs: StoragePrefs, storage: Storage = window.localStorage): void {
  let all: Record<string, StoragePrefs> = {}
  try {
    all = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as Record<string, StoragePrefs>
  } catch {
    all = {}
  }
  all[user] = { ...prefs, s3Path: pathSegments(prefs.s3Path).join('/'), drivePath: pathSegments(prefs.drivePath).join('/') }
  storage.setItem(STORAGE_KEY, JSON.stringify(all))
}

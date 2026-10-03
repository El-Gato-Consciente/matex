import type { Project } from '@/features/documents/types'

/**
 * **El archivo de un proyecto** (`.mtex`), tal como se guarda en la nube —en nuestro S3 o en el
 * Google Drive del usuario—. Es el proyecto entero (AST, archivos e imágenes en base64) dentro de
 * un sobre con formato y versión, para poder cambiarlo sin romper los archivos ya guardados.
 *
 * Un `.mtex` «suelto» (solo el AST, el que se exporta desde el editor) es otra cosa: lo distingue
 * `format`. La app sabe importar los dos.
 */

export const PROJECT_FILE_FORMAT = 'matex-project'
export const PROJECT_FILE_VERSION = 1

export interface ProjectFile {
  readonly format: typeof PROJECT_FILE_FORMAT
  readonly version: number
  readonly project: Project
}

export function toProjectFile(project: Project): ProjectFile {
  return { format: PROJECT_FILE_FORMAT, version: PROJECT_FILE_VERSION, project }
}

/** El proyecto que trae un archivo de la nube, o `undefined` si no es un archivo de proyecto. */
export function fromProjectFile(value: unknown): unknown {
  if (isProjectFile(value)) return value.project
  return undefined
}

export function isProjectFile(value: unknown): value is ProjectFile {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return record.format === PROJECT_FILE_FORMAT && typeof record.project === 'object' && record.project !== null
}

/** Nombre de archivo para Drive: el del proyecto, sin caracteres que Drive o los sistemas de archivos rechazan. */
export function projectFileName(project: Pick<Project, 'name'>): string {
  const base = project.name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Proyecto sin título'
  return `${base}.mtex`
}

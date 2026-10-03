import type { MatexDoc } from '@/features/matex/core'
import type { Folder, NewProjectInput, Project, ProjectFile } from './types'

/**
 * PUERTO de persistencia de proyectos y carpetas. Hoy `LocalProjectStore`
 * (localStorage); mañana, un adaptador a API/nube **sin tocar la UI**.
 */
export interface ProjectStore {
  // ── Proyectos ──
  /** Todos los proyectos, ordenados por última modificación (desc). */
  list(): Project[]
  get(id: string): Project | undefined
  create(input: NewProjectInput): Project
  /** Reemplaza el conjunto de archivos y el archivo principal del proyecto. */
  updateFiles(id: string, files: readonly ProjectFile[], mainFile: string): void
  /** Actualiza el AST (fuente de verdad) de un documento **Matex**. */
  updateAst(id: string, ast: MatexDoc): void
  rename(id: string, name: string): void
  remove(id: string): void
  /** Mueve el proyecto a una carpeta (`null` = raíz). */
  moveProject(id: string, folderId: string | null): void
  /**
   * Guarda el proyecto **tal cual** (mismo id y fechas): lo usa la sincronización para traer
   * lo que llega de la nube. Lo que no tiene forma de proyecto se ignora (devuelve `false`).
   */
  put(project: unknown): boolean

  // ── Carpetas ──
  listFolders(): Folder[]
  createFolder(name: string, parentId: string | null): Folder
  renameFolder(id: string, name: string): void
  /** Elimina la carpeta; su contenido (proyectos y subcarpetas) sube al padre. */
  removeFolder(id: string): void
  /** Reparenta una carpeta (`null` = raíz); ignora movimientos que crearían ciclos. */
  moveFolder(id: string, parentId: string | null): void
  /** Reemplaza el árbol de carpetas entero (sincronización). Lo inválido se descarta. */
  replaceFolders(folders: readonly unknown[]): void
}

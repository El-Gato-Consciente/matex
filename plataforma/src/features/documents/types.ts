import type { MatexDoc } from '@/features/matex/core'

/**
 * Modelo de **proyecto**: un documento que puede tener varios archivos. Hoy la
 * UI edita solo el principal, pero el modelo ya soporta multi-archivo para no
 * tener que migrar el storage más adelante. Los proyectos se organizan en
 * **carpetas anidadas** (`folderId` → `Folder.parentId`).
 */
export interface ProjectFile {
  readonly path: string
  /** Texto plano (`utf8`) o binario en base64 (`base64`, p. ej. imágenes). */
  readonly content: string
  // `| undefined` explícito por `exactOptionalPropertyTypes`: los archivos pueden
  // venir de datos zod (plantillas/ejemplares) cuyo `encoding` es `… | undefined`.
  readonly encoding?: 'utf8' | 'base64' | undefined
}

/** ¿Es un archivo binario (no editable como texto)? */
export function isBinary(file: ProjectFile): boolean {
  return file.encoding === 'base64'
}

/** Tipo de documento: LaTeX tradicional o Matex (visual, fuente de verdad = AST). */
export type ProjectKind = 'latex' | 'matex'

export interface Project {
  readonly id: string
  readonly name: string
  /** `latex` (edita `.tex`) o `matex` (edita el AST, `.tex` derivado). */
  readonly kind: ProjectKind
  readonly files: readonly ProjectFile[]
  /** Archivo que se compila (p. ej. `main.tex`). */
  readonly mainFile: string
  /** Fuente de verdad de un documento **Matex**. Ausente en documentos `latex`. */
  readonly ast?: MatexDoc | undefined
  /** Carpeta contenedora; `null` = raíz. */
  readonly folderId: string | null
  /** ISO 8601. */
  readonly createdAt: string
  readonly updatedAt: string
}

/** Carpeta del árbol de proyectos. `parentId = null` = carpeta raíz. */
export interface Folder {
  readonly id: string
  readonly name: string
  readonly parentId: string | null
  readonly createdAt: string
}

export interface NewProjectInput {
  readonly name: string
  /** Tipo de documento (default `latex`). */
  readonly kind?: ProjectKind
  /** Documento **Matex**: su AST (fuente de verdad). */
  readonly ast?: MatexDoc
  /** Carpeta destino; `null`/omitido = raíz. */
  readonly folderId?: string | null
  /** Single-archivo: contenido del principal (`main.tex`). */
  readonly mainContent?: string
  /** Multi-archivo: todos los archivos del proyecto (tiene prioridad). */
  readonly files?: readonly ProjectFile[]
  /** Nombre del archivo principal (default `main.tex`). */
  readonly mainFile?: string
}

/** Contenido del archivo principal del proyecto. */
export function mainContent(project: Project): string {
  return project.files.find((file) => file.path === project.mainFile)?.content ?? ''
}

import type { Project, ProjectFile } from '@/features/documents/types'
import { parseMatexDoc, type MatexDoc } from '@/features/matex/core'
import { isProjectFile, toProjectFile } from '@/features/sync/projectFile'

/**
 * **Qué viaja en un link `.mtex`** y cómo se lee del otro lado. Se comparte el archivo de
 * proyecto (`projectFile`): el documento con sus imágenes y recursos, para que quien lo importe
 * reciba lo mismo que tenía el autor.
 *
 * Lo que llega por un link es **contenido ajeno**: se valida entero antes de mostrarlo o
 * importarlo (`parseMatexDoc`), y nunca se confía en su forma.
 */
export interface SharedMatex {
  readonly ast: MatexDoc
  /** Imágenes y recursos del proyecto (sin el `main.tex` derivado, que se regenera). */
  readonly files: readonly ProjectFile[]
}

/** El archivo que se sube al compartir un proyecto Matex. */
export function sharedMtexBlob(project: Project): Blob {
  return new Blob([JSON.stringify(toProjectFile(project))], { type: 'application/json' })
}

/**
 * Lee el contenido de un link `.mtex`. Acepta el archivo de proyecto y también un `.mtex`
 * suelto (solo el documento). Tira si no es un documento Matex válido.
 */
export function readSharedMtex(json: unknown): SharedMatex {
  if (isProjectFile(json)) {
    const project = json.project as Partial<Project>
    if (!project.ast) throw new Error('El link no contiene un documento Matex.')
    return { ast: parseMatexDoc(project.ast), files: cleanFiles(project.files) }
  }
  return { ast: parseMatexDoc(json), files: [] }
}

/** Solo archivos bien formados, y sin el `.tex` principal (se deriva del documento al importar). */
function cleanFiles(files: unknown): ProjectFile[] {
  if (!Array.isArray(files)) return []
  return files.filter(
    (file): file is ProjectFile =>
      typeof file === 'object' &&
      file !== null &&
      typeof (file as ProjectFile).path === 'string' &&
      typeof (file as ProjectFile).content === 'string' &&
      (file as ProjectFile).path !== 'main.tex',
  )
}

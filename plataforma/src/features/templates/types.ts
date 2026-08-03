import type { MatexDoc } from '@/features/matex/core'

/** Plantilla: un documento completo que combina varios temas, listo para abrir. */
export interface Template {
  readonly id: string
  readonly title: string
  readonly category: string
  readonly description: string
  /** Contenido del archivo principal. */
  readonly source: string
  /** Archivos acompañantes (plantilla **multi-archivo**): capítulos, `refs.bib`, etc. */
  readonly files?: readonly { path: string; content: string }[]
  /** Nombre del archivo principal (default `main.tex`). */
  readonly mainFile?: string
  /**
   * **Versión Matex** (AST) de la plantilla (ME-23): si está, el selector de "nuevo documento"
   * ofrece además **«Matex»** para arrancar en el **editor visual** en vez del LaTeX crudo.
   * Solo la tienen las plantillas que el modelo Matex expresa (prosa/presentación).
   */
  readonly matex?: MatexDoc
}

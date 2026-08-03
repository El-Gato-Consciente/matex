/** Contratos del dominio "compilar LaTeX". No dependen de ninguna implementación. */

/** Un archivo del proyecto a compilar (ruta relativa + contenido). */
export interface CompileFile {
  readonly path: string
  /** Texto (`utf8`) o binario en base64 (`base64`, p. ej. imágenes). */
  readonly content: string
  // `| undefined` explícito: el contenido viene de datos validados con zod
  // (`.optional()` infiere `… | undefined`) y `exactOptionalPropertyTypes` lo exige.
  readonly encoding?: 'utf8' | 'base64' | undefined
}

export interface CompileInput {
  /** Todos los archivos del proyecto (uno o varios). */
  readonly files: readonly CompileFile[]
  /** Archivo principal a compilar (debe estar en `files`). */
  readonly mainFile: string
}

/** Atajo para el caso de un solo archivo (lecciones, ejemplos de la galería). */
export function singleFileInput(source: string, mainFile = 'main.tex'): CompileInput {
  return { files: [{ path: mainFile, content: source }], mainFile }
}

/** Input multi-archivo: el principal (cuyo contenido es `mainContent`) + los demás. */
export function filesInput(
  mainFile: string,
  mainContent: string,
  extraFiles: readonly CompileFile[],
): CompileInput {
  return { files: [{ path: mainFile, content: mainContent }, ...extraFiles], mainFile }
}

export type DiagnosticSeverity = 'error' | 'warning'

export interface CompileDiagnostic {
  readonly severity: DiagnosticSeverity
  readonly message: string
  /** Línea 1-based en la fuente, si el backend la reporta. */
  readonly line?: number
}

export interface CompileSuccess {
  readonly ok: true
  /** Bytes del PDF generado. */
  readonly pdf: Uint8Array
  /** Log crudo del compilador (para mostrar/depurar). */
  readonly log: string
}

export interface CompileFailure {
  readonly ok: false
  readonly diagnostics: readonly CompileDiagnostic[]
  readonly log: string
}

export type CompileResult = CompileSuccess | CompileFailure

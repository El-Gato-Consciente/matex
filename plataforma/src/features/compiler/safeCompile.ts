import type { LatexCompiler } from './LatexCompiler'
import type { CompileInput, CompileResult } from './types'

/**
 * Compila sin lanzar nunca: si el adaptador rechaza (p. ej. el backend está caído
 * o la red falla), devuelve un `CompileFailure` con un mensaje claro en vez de
 * dejar la promesa rechazada (que se traduce en “ni error ni PDF” en la UI).
 */
export async function safeCompile(compiler: LatexCompiler, input: CompileInput): Promise<CompileResult> {
  try {
    return await compiler.compile(input)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      diagnostics: [],
      log: `No se pudo contactar al compilador (¿el backend está corriendo?). Detalle: ${detail}`,
    }
  }
}

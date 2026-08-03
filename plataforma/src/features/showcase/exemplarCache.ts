import type { CompileResult } from '@/features/compiler/types'

/**
 * Caché en memoria de ejemplares ya compilados (clave = fuente). Los ejemplares
 * son estáticos y caros de compilar (pgfplots, varias pasadas), así que reabrir
 * uno en la misma sesión es instantáneo en vez de esperar la compilación de nuevo.
 *
 * Solo cachea éxitos. Vive mientras dura la pestaña; para persistir entre recargas
 * habría que mover esto a IndexedDB (futuro).
 */
const cache = new Map<string, CompileResult>()

export function getCachedCompile(key: string): CompileResult | undefined {
  return cache.get(key)
}

export function setCachedCompile(key: string, result: CompileResult): void {
  if (result.ok) cache.set(key, result)
}

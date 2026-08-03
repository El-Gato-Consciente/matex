import type { PosterBlockNode, PosterMeta } from './ast'

/**
 * Maquetación del **póster**: cómo se reparten sus bloques en la grilla de columnas.
 *
 * Vive en un módulo propio (puro, sin backend) porque la decisión es **semántica** —«este
 * bloque va en la columna 2», «los demás se distribuyen parejos»— y por lo tanto la
 * comparten los dos backends: `compile.ts` la emite como `\column` de tikzposter y
 * `html.ts` como columnas flex. Tenerla acá evita que las dos maquetaciones se separen.
 */

/** Columnas efectivas de la grilla: 1–4, default 2. */
export function posterColumns(poster: PosterMeta): number {
  return Math.max(1, Math.min(4, Math.round(poster.columns ?? 2)))
}

/**
 * Reparte los bloques en `cols` columnas. Un bloque con `column` (1-based) cae en la que
 * pide —clampeada al rango disponible—; los demás se distribuyen **en orden** para que las
 * columnas queden parejas.
 */
export function distributePosterBlocks(blocks: readonly PosterBlockNode[], cols: number): PosterBlockNode[][] {
  const buckets: PosterBlockNode[][] = Array.from({ length: cols }, () => [])
  blocks.forEach((block, i) => {
    const fixed = block.column != null ? Math.max(1, Math.min(cols, Math.round(block.column))) - 1 : null
    const target = fixed ?? Math.min(cols - 1, Math.floor((i * cols) / blocks.length))
    buckets[target]!.push(block)
  })
  return buckets
}

/**
 * Contratos de las **vistas previas** de plantillas y ejemplares: cómo se ve el documento ya
 * compilado, antes de crearlo.
 *
 * Las imágenes **no** son parte del bundle: son assets estáticos en `public/previews/` que el
 * navegador pide por URL (`<img loading="lazy">`). Lo único que la app importa es el manifiesto
 * —una lista de rutas y tamaños— así que agregar previews no engorda el JS ni obliga a que las
 * plantillas conozcan a las imágenes: el vínculo es el `id`, y lo resuelve `previewFor`.
 */

/** De qué colección es el documento. Evita que un `id` repetido pise el preview del otro. */
export type PreviewKind = 'template' | 'exemplar'

/** Una página del PDF, ya rasterizada y publicada. */
export interface PreviewPage {
  /** Ruta pública del asset, absoluta desde la raíz del sitio. */
  readonly src: string
  /** Número de página 1-based en el PDF original (se muestra al usuario). */
  readonly page: number
  /** Tamaño real del bitmap. La UI lo usa para reservar el espacio con la proporción del papel:
   *  A4 vertical, 16:9 de una presentación y un póster A1 no se pueden dibujar con un `aspect`
   *  fijo sin deformar o recortar alguno. */
  readonly width: number
  readonly height: number
}

/** Las páginas representativas de un documento + cuántas tiene en total. */
export interface Preview {
  /** En orden de aparición; al menos una. La primera es la portada. */
  readonly pages: readonly PreviewPage[]
  /** Páginas del PDF completo, que puede tener muchas más que las capturadas. */
  readonly pageCount: number
}

/** Manifiesto: `kind:id` → preview. Lo emite `npm run build:previews`. */
export type PreviewManifest = Readonly<Record<string, Preview>>

/** Clave del manifiesto. Es la **única** forma de armarla: la comparten app y generador. */
export function previewKey(kind: PreviewKind, id: string): string {
  return `${kind}:${id}`
}

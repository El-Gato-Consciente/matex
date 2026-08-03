/**
 * **Adaptador de rasterizado: PDF → imágenes.** Lo único de todo el repo que sabe que existe
 * un rasterizador; el resto del pipeline de vistas previas habla de "páginas con bytes".
 *
 * Corre **solo en la generación** (`npm run build:previews`), nunca en el navegador ni en el
 * bundle: por eso `pdfjs` y `@napi-rs/canvas` entran por `import()` dinámico y viven en
 * `devDependencies`.
 *
 * Se rasteriza acá, en Node, y no capturando la pantalla del sitio con un navegador headless,
 * porque el insumo es el **PDF que produce el compilador de producción**: es la misma imagen
 * que ve el usuario, sin depender de que la app esté levantada ni de qué versión está
 * desplegada. Además el PDF trae, gratis, el tamaño real del papel de cada página (A4 vertical,
 * 16:9 de una presentación, un póster A1) — que es lo que la UI necesita para no deformar nada.
 */

/**
 * `pdfjs` usa `ArrayBuffer.prototype.transferToFixedLength` (Node ≥21) al cargar las fuentes
 * embebidas del PDF. En Node 20 —la versión con la que se buildea y despliega— el método no
 * existe: `pdfjs` **traga el error** y devuelve la página **en blanco**, sin fallar. El síntoma
 * es un preview vacío, no una excepción, así que sin este shim el bug pasa desapercibido.
 *
 * La copia no *detacha* el buffer original (un `transfer` de verdad sí lo hace). Para el uso que
 * le da `pdfjs` —copiar los bytes de una fuente y no volver a tocar el origen— es equivalente.
 */
if (!('transferToFixedLength' in ArrayBuffer.prototype)) {
  Object.defineProperty(ArrayBuffer.prototype, 'transferToFixedLength', {
    value(this: ArrayBuffer, length?: number): ArrayBuffer {
      const size = length ?? this.byteLength
      const out = new ArrayBuffer(size)
      new Uint8Array(out).set(new Uint8Array(this, 0, Math.min(size, this.byteLength)))
      return out
    },
    configurable: true,
    writable: true,
  })
}

/** Una página ya rasterizada, con el tamaño real del bitmap. */
export interface RenderedPage {
  /** Número de página 1-based en el PDF. */
  readonly page: number
  readonly width: number
  readonly height: number
  /** Bytes del WebP. */
  readonly bytes: Uint8Array
}

export interface RasterizeOptions {
  /** Ancho del bitmap en px (el alto sale del papel). */
  readonly width: number
  /** Cuántas páginas capturar como máximo. */
  readonly maxPages: number
  /** Calidad del WebP (0–100). */
  readonly quality: number
}

export interface RasterizeResult {
  readonly pages: readonly RenderedPage[]
  /** Páginas del PDF completo (puede ser mayor que `pages.length`). */
  readonly pageCount: number
}

/**
 * Elige qué páginas representan mejor al documento, dada la cantidad de texto de cada una.
 *
 * Tres criterios:
 *
 *  1. **La página 1 entra siempre.** Es la portada: la cara del documento y lo que la tarjeta
 *     usa de carátula. Por poco texto que tenga —y una portada tiene poco— no se descarta.
 *  2. **Descartar las casi vacías** del resto. El umbral es *relativo* a la página más cargada
 *     del propio documento, no un número fijo de caracteres: una presentación tiene slides de 20
 *     palabras y una tesina párrafos de 400, así que un umbral absoluto o deja pasar hojas en
 *     blanco en la tesina o descarta la presentación entera.
 *  3. **Repartir a lo largo del documento** en vez de tomar las primeras N: se trata de mostrar
 *     cómo *es* el documento, y las páginas 2 y 3 de casi todos son el índice.
 */
export function pickPages(textLengths: readonly number[], maxPages: number): readonly number[] {
  if (textLengths.length === 0 || maxPages < 1) return []

  const busiest = Math.max(...textLengths)
  const threshold = Math.max(20, busiest * 0.15)
  const candidates = textLengths
    .map((length, index) => ({ page: index + 1, length }))
    .slice(1)
    .filter((entry) => entry.length >= threshold)
    .map((entry) => entry.page)

  return [1, ...spread(candidates, maxPages - 1)]
}

/** `slots` elementos repartidos uniformemente sobre `items` (extremos incluidos). */
function spread(items: readonly number[], slots: number): readonly number[] {
  if (slots < 1 || items.length === 0) return []
  if (items.length <= slots) return items
  if (slots === 1) return [items[Math.floor((items.length - 1) / 2)]!]

  const picked = new Set<number>()
  for (let slot = 0; slot < slots; slot++) {
    picked.add(items[Math.round((slot * (items.length - 1)) / (slots - 1))]!)
  }
  return [...picked].sort((a, b) => a - b)
}

/** Rasteriza las páginas representativas de un PDF a WebP. */
export async function rasterize(pdf: Uint8Array, options: RasterizeOptions): Promise<RasterizeResult> {
  const { createCanvas } = await import('@napi-rs/canvas')
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  // Sin `canvasFactory` propia: corriendo en Node, `pdfjs` usa su `NodeCanvasFactory`, que se
  // apoya justamente en `@napi-rs/canvas` — el mismo canvas que usamos acá para el encode.
  const loading = pdfjs.getDocument({
    // `pdfjs` se queda con el buffer (lo *detacha*), así que va una copia: quien nos llamó
    // sigue siendo dueño de sus bytes.
    data: new Uint8Array(pdf),
    // Sin esto, un PDF que use una de las 14 fuentes estándar sin embeberla sale en blanco.
    standardFontDataUrl: new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)
      .href,
  })
  const doc = await loading.promise

  const textLengths: number[] = []
  for (let page = 1; page <= doc.numPages; page++) {
    const content = await (await doc.getPage(page)).getTextContent()
    textLengths.push(content.items.reduce((sum, item) => sum + ('str' in item ? item.str.length : 0), 0))
  }

  const pages: RenderedPage[] = []
  for (const pageNumber of pickPages(textLengths, options.maxPages)) {
    const page = await doc.getPage(pageNumber)
    const scale = options.width / page.getViewport({ scale: 1 }).width
    const viewport = page.getViewport({ scale })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const context = canvas.getContext('2d')
    // El PDF no pinta el fondo del papel; sin esto el WebP sale con el papel transparente
    // (negro sobre el tema oscuro de la app).
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, viewport, canvas }).promise
    pages.push({
      page: pageNumber,
      width: canvas.width,
      height: canvas.height,
      bytes: await canvas.encode('webp', options.quality),
    })
  }

  const pageCount = doc.numPages
  await loading.destroy()
  return { pages, pageCount }
}

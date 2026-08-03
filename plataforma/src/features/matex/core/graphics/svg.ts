/**
 * **Constructor de SVG como string, puro** (sin DOM). Es la infraestructura del **backend web**
 * de los gráficos: `relationSvg.ts` y `chartSvg.ts` arman el `<svg>` con estos helpers y devuelven
 * markup, igual que el backend LaTeX devuelve `.tex`. Al no tocar el DOM, viven en `core/`
 * (co-localizados con su par LaTeX), son testeables sin jsdom, y sirven de base al 2º backend HTML.
 * El editor solo inyecta el string resultante (`insertAdjacentHTML`).
 */

/** Escapa texto para contenido/atributos XML (`&`, `<`, `>`, comillas). */
export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  )
}

/** Valor de atributo: los números se serializan tal cual; los strings se escapan. */
type Attr = string | number
type Attrs = Record<string, Attr | undefined>

function attrsToStr(attrs: Attrs): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined) continue
    parts.push(`${k}="${typeof v === 'number' ? String(v) : escapeXml(v)}"`)
  }
  return parts.length ? ` ${parts.join(' ')}` : ''
}

/**
 * Un elemento SVG. Sin `inner` → self-closing (`<rect .../>`). Con `inner` string → se toma como
 * **texto** y se escapa (para `<text>`); con `inner` array → se toma como **markup hijo** ya armado.
 */
export function svgTag(tag: string, attrs: Attrs, inner?: string | string[]): string {
  const open = `<${tag}${attrsToStr(attrs)}`
  if (inner === undefined) return `${open}/>`
  const body = typeof inner === 'string' ? escapeXml(inner) : inner.join('')
  return `${open}>${body}</${tag}>`
}

/**
 * **Qué se puede insertar en el documento**, como datos: una sola lista alimenta el menú
 * **Insertar** del header y el menú **`/`** del lienzo, así no divergen. Las acciones (`run`) las
 * pone el workspace, que es quien tiene el editor; acá solo vive la forma y el filtro (puro).
 */

export type InsertGroup = 'Matemática' | 'Bloques' | 'Figuras' | 'Referencias' | 'Estructura' | 'Avanzado'

/** Orden de los grupos en ambos menús. */
export const INSERT_GROUPS: readonly InsertGroup[] = [
  'Matemática',
  'Bloques',
  'Figuras',
  'Referencias',
  'Estructura',
  'Avanzado',
]

export interface InsertItem {
  readonly id: string
  readonly group: InsertGroup
  readonly label: string
  /** Para qué sirve, en pocas palabras (se muestra en el menú `/`). */
  readonly description: string
  /** Signo que lo identifica en el menú (∑, ∎, ∿…). */
  readonly glyph: string
  /** Atajo de teclado o de escritura, si existe (`$$`, `@`, `#`). */
  readonly hint?: string
  /** Sinónimos para el buscador (sin tildes, en minúscula): «ecuacion», «grafico»… */
  readonly keywords?: string
  readonly run: () => void
}

/** Minúsculas y sin tildes: «Fórmula» y «formula» tienen que encontrarse. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Ítems que coinciden con lo escrito después de `/`. Primero los que **empiezan** con la
 * búsqueda (por etiqueta), después los que la contienen en la etiqueta, la descripción o los
 * sinónimos. Sin búsqueda, todos en su orden.
 */
export function filterInsertItems(items: readonly InsertItem[], query: string): InsertItem[] {
  const q = normalize(query.trim())
  if (!q) return [...items]
  const starts: InsertItem[] = []
  const contains: InsertItem[] = []
  for (const item of items) {
    const label = normalize(item.label)
    if (label.startsWith(q) || label.split(/\s+/).some((word) => word.startsWith(q))) starts.push(item)
    else if (`${label} ${normalize(item.description)} ${item.keywords ?? ''}`.includes(q)) contains.push(item)
  }
  return [...starts, ...contains]
}

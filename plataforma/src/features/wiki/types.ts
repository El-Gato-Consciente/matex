import type { WikiAnimationId } from './animations'

/**
 * Modelo de la wiki «Cómo funciona Matex». Las páginas son **datos** (como las
 * lecciones): escribir documentación no toca la lógica del lector. Las animaciones
 * se referencian por id y viven en `animations/` (un componente por id).
 */

export type WikiBlock =
  /** Párrafo(s) en Markdown. */
  | { kind: 'prose'; markdown: string }
  /** Aviso destacado. */
  | { kind: 'callout'; tone: 'tip' | 'note' | 'warning'; markdown: string }
  /** Ilustración animada, con epígrafe opcional. */
  | { kind: 'animation'; id: WikiAnimationId; caption?: string }
  /** Pasos numerados (se revelan en cascada). */
  | { kind: 'steps'; items: ReadonlyArray<{ title: string; markdown: string }> }
  /** Grilla de tarjetas (capacidades, opciones). */
  | { kind: 'cards'; items: ReadonlyArray<{ title: string; markdown: string; tag?: string }> }
  /** Tabla de atajos: teclas → qué hacen. */
  | { kind: 'keys'; items: ReadonlyArray<{ keys: readonly string[]; desc: string }> }
  /** Llamado a la acción hacia la app. */
  | { kind: 'cta'; action: WikiAction; label: string; markdown?: string }

/** Acciones que una página puede pedirle a la app. */
export type WikiAction = 'start-matex' | 'projects'

export interface WikiPage {
  /** Estable: es la clave de navegación. */
  readonly id: string
  readonly title: string
  /** Bajada de una línea (va en el encabezado y en las tarjetas de anterior/siguiente). */
  readonly summary: string
  readonly blocks: readonly WikiBlock[]
}

export interface WikiGroup {
  readonly title: string
  readonly pages: readonly WikiPage[]
}

import type { CvMeta, DocMeta, ExamMeta, LetterMeta, PosterMeta } from './ast'

/**
 * **Familia de documento** a la que pertenece un `meta`.
 *
 * Desde AR-09 la familia es una **unión discriminada** (`meta.family`), así que las familias son
 * mutuamente excluyentes por construcción: `documentFamily` solo lee el discriminante. Este
 * módulo centraliza además los accesores a la metadata de cada familia, para que los backends
 * narrowen en un solo lugar.
 */
export type DocFamily = 'presentation' | 'letter' | 'exam' | 'cv' | 'poster' | 'document'

/** Familia efectiva de un documento (`document` si no pertenece a ninguna). */
export function documentFamily(meta: DocMeta | undefined): DocFamily {
  return meta?.family?.kind ?? 'document'
}

/** Metadata de carta, o `undefined` si el documento no es una carta. */
export function letterMeta(meta: DocMeta | undefined): LetterMeta | undefined {
  return meta?.family?.kind === 'letter' ? meta.family.letter : undefined
}
/** Metadata de examen, o `undefined` si el documento no es un examen. */
export function examMeta(meta: DocMeta | undefined): ExamMeta | undefined {
  return meta?.family?.kind === 'exam' ? meta.family.exam : undefined
}
/** Metadata de CV, o `undefined` si el documento no es un CV. */
export function cvMeta(meta: DocMeta | undefined): CvMeta | undefined {
  return meta?.family?.kind === 'cv' ? meta.family.cv : undefined
}
/** Metadata de póster, o `undefined` si el documento no es un póster. */
export function posterMeta(meta: DocMeta | undefined): PosterMeta | undefined {
  return meta?.family?.kind === 'poster' ? meta.family.poster : undefined
}

/** Etiqueta legible de una familia (para avisos en la UI). */
export const FAMILY_LABEL: Record<DocFamily, string> = {
  presentation: 'presentación',
  letter: 'carta',
  exam: 'examen',
  cv: 'currículum',
  poster: 'póster',
  document: 'documento',
}

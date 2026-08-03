import type { BlockNode, MatexDoc } from '../../src/features/matex/core/ast'

const section = (text: string, level: 1 | 2 | 3 = 1): BlockNode => ({
  type: 'heading',
  level,
  content: [{ type: 'text', text }],
})

// `label` (no solo `id`) fuerza al compilador a emitir `\label{id}` aunque nadie lo referencie,
// para que el número quede en el `.aux`. (El compilador omite labels de objetos no referenciados.)
const theorem = (
  variant: Extract<BlockNode, { type: 'theorem' }>['variant'],
  id: string,
  title?: string,
): BlockNode => ({
  type: 'theorem',
  variant,
  id,
  label: id,
  ...(title ? { title } : {}),
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
})

const part = (id: string): BlockNode => ({
  type: 'part',
  id,
  label: id,
  content: [{ type: 'text', text: 'Parte' }],
})

/**
 * Documento representativo para QA-08: teoremas antes y dentro de secciones, todas las
 * variantes numerables, `proof`/`remark` (que no numeran), y partes en romano (ME-46: la parte
 * no reinicia la numeración del resto).
 */
export const numberingSample: MatexDoc = {
  type: 'doc',
  version: 4,
  content: [
    part('pI'),
    theorem('theorem', 'antes', 'Antes de sección'),
    section('Primera'),
    theorem('theorem', 't1'),
    theorem('definition', 'd1'),
    theorem('remark', 'r1'),
    theorem('proof', 'p1'),
    section('Sub', 2),
    theorem('lemma', 'l1'),
    part('pII'),
    section('Segunda'),
    theorem('corollary', 'c1'),
  ],
}

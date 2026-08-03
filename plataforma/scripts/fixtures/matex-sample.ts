import type { MatexDoc } from '../../src/features/matex/core'

/**
 * Documento Matex de referencia: ejercita el compilador Matex→LaTeX sobre un surtido amplio de
 * nodos (encabezados, marcas, matemática inline y display, listas, teoremas con variantes,
 * tabla con caption, y referencias cruzadas a los tres tipos de objeto numerable).
 *
 * Vive acá y no dentro del script porque es un **fixture**, y porque tipado como `MatexDoc` el
 * compilador de TS avisa cuando el AST cambia — antes era un literal `any` de 80 líneas dentro
 * de `verify-content`, donde una migración del modelo podía dejarlo obsoleto sin que nada lo
 * notara.
 */
export const matexSample: MatexDoc = {
  type: 'doc',
  version: 2,
  meta: { title: 'Documento Matex', author: 'Estudiante', titlePage: true, toc: true },
  content: [
    { type: 'heading', level: 1, content: [{ type: 'text', text: 'Introducción' }], label: 'sec:intro' },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Un ' },
        { type: 'text', text: 'énfasis', marks: ['emph'] },
        { type: 'text', text: ' con matemática ' },
        { type: 'mathInline', tex: 'x^2 + 1' },
        { type: 'text', text: ' y el 50% de símbolos_raros.' },
      ],
    },
    {
      type: 'bulletList',
      items: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'uno' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'dos' }] }] },
      ],
    },
    {
      type: 'theorem',
      variant: 'definition',
      title: 'Continuidad',
      label: 'def:cont',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Una función es continua si…' }] }],
    },
    {
      type: 'theorem',
      variant: 'theorem',
      label: 'thm:tvi',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Teorema del valor intermedio.' }] }],
    },
    { type: 'mathDisplay', rows: [{ tex: 'e^{i\\pi} + 1 = 0', label: 'eq:euler' }] },
    {
      type: 'table',
      header: true,
      align: ['left', 'right'],
      caption: 'Resultados',
      label: 'tab:res',
      rows: [
        {
          type: 'tableRow',
          cells: [
            { type: 'tableCell', content: [{ type: 'text', text: 'Método' }] },
            { type: 'tableCell', content: [{ type: 'text', text: 'error' }] },
          ],
        },
        {
          type: 'tableRow',
          cells: [
            { type: 'tableCell', content: [{ type: 'text', text: 'Euler' }] },
            { type: 'tableCell', content: [{ type: 'mathInline', tex: '10^{-3}' }] },
          ],
        },
      ],
    },
    {
      type: 'theorem',
      variant: 'proof',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Por ' },
            { type: 'ref', target: 'thm:tvi' },
            { type: 'text', text: ', ' },
            { type: 'ref', target: 'eq:euler' },
            { type: 'text', text: ' y ' },
            { type: 'ref', target: 'sec:intro' },
            { type: 'text', text: '.' },
          ],
        },
      ],
    },
  ],
}

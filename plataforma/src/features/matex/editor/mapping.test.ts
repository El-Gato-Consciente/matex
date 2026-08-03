import { describe, expect, it } from 'vitest'
import type { MatexDoc } from '../core'
import { astToTiptap, tiptapToAst } from './mapping'

const doc: MatexDoc = {
  type: 'doc',
  version: 4,
  content: [
    { type: 'heading', level: 2, content: [{ type: 'text', text: 'Título' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'a ' },
        { type: 'text', text: 'negrita', marks: ['strong'] },
        { type: 'text', text: ' y ', marks: [] as never },
        { type: 'mathInline', tex: 'x^2' },
      ],
    },
    {
      type: 'bulletList',
      items: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'uno' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'dos' }] }] },
      ],
    },
    { type: 'mathDisplay', rows: [{ tex: 'e^{i\\pi}=-1' }] },
    { type: 'rawLatex', latex: '\\vspace{1em}' },
    { type: 'include', target: 'figuras/x.tex' },
    { type: 'paragraph', content: [] },
  ],
}

describe('mapping AST↔TipTap', () => {
  it('round-trip: AST → TipTap → AST devuelve el mismo AST', () => {
    // Normalizamos el `marks: []` del fixture (el editor nunca emite marcas vacías).
    const normalized: MatexDoc = JSON.parse(JSON.stringify(doc))
    const para = normalized.content[1]
    if (para?.type === 'paragraph') delete (para.content[2] as { marks?: unknown }).marks
    expect(tiptapToAst(astToTiptap(normalized))).toEqual(normalized)
  })

  it('codeBlock round-trippea (código + language por attrs)', () => {
    const withCode: MatexDoc = {
      type: 'doc',
      version: 4,
      content: [{ type: 'codeBlock', code: 'def f(x):\n  return x + 1', language: 'python' }],
    }
    expect(tiptapToAst(astToTiptap(withCode))).toEqual(withCode)
  })

  it('citas inline round-trippean (keys + style)', () => {
    // La bibliografía (`references`) vive fuera de TipTap → no viaja por el mapping (se
    // preserva aparte, como `meta`); acá verificamos las citas en la prosa.
    const withCites: MatexDoc = {
      type: 'doc',
      version: 4,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Según ' },
            { type: 'cite', keys: ['knuth1984'], style: 'textual' },
            { type: 'text', text: ' y ' },
            { type: 'cite', keys: ['a', 'b'] },
            { type: 'text', text: '. Aclaración' },
            { type: 'footnote', text: 'ver el apéndice' },
          ],
        },
      ],
    }
    expect(tiptapToAst(astToTiptap(withCites))).toEqual(withCites)
  })

  it('marcas: strong↔bold, emph↔italic, code↔code', () => {
    const pm = astToTiptap({
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: ['strong', 'emph', 'code'] }] }],
    })
    const textNode = pm.content?.[0]?.content?.[0]
    expect(textNode?.marks?.map((m) => m.type)).toEqual(['bold', 'italic', 'code'])
  })

  it('matemática y rawLatex viajan por attrs', () => {
    const pm = astToTiptap(doc)
    expect(
      pm.content?.some(
        (n) => n.type === 'mathDisplay' && (n.attrs?.rows as { tex: string }[] | undefined)?.[0]?.tex === 'e^{i\\pi}=-1',
      ),
    ).toBe(true)
    expect(pm.content?.some((n) => n.type === 'rawLatex' && n.attrs?.latex === '\\vspace{1em}')).toBe(true)
  })

  it('round-trip de los nodos académicos (teorema, ref, label, numeración)', () => {
    const academic: MatexDoc = {
      type: 'doc',
      version: 4,
      content: [
        { type: 'heading', level: 1, content: [{ type: 'text', text: 'Cap' }], label: 'sec:cap' },
        {
          type: 'theorem',
          variant: 'definition',
          title: 'Continuidad',
          label: 'def:cont',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'def…' }] }],
        },
        { type: 'theorem', variant: 'proof', proves: 'sec:cap', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'qed' }] }] },
        { type: 'mathDisplay', rows: [{ tex: 'a=b', numbered: true, label: 'eq:x' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'ver ' }, { type: 'ref', target: 'eq:x' }] },
        {
          type: 'callout',
          variant: 'tip',
          title: 'Consejo',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ojo con esto' }] }],
        },
      ],
    }
    expect(tiptapToAst(astToTiptap(academic))).toEqual(academic)
  })

  it('la tabla round-trippea a la estructura TipTap y de vuelta sin pérdida', () => {
    const withTable: MatexDoc = {
      type: 'doc',
      version: 4,
      content: [
        {
          type: 'table',
          header: true,
          align: ['left', 'right'],
          caption: 'Datos',
          label: 'tab:x',
          rows: [
            {
              type: 'tableRow',
              cells: [
                { type: 'tableCell', content: [{ type: 'text', text: 'a' }] },
                { type: 'tableCell', content: [{ type: 'mathInline', tex: '\\pi' }] },
              ],
            },
          ],
        },
      ],
    }
    expect(tiptapToAst(astToTiptap(withTable))).toEqual(withTable)
  })

  it('la figura round-trippea (imagen y gráfico como partes)', () => {
    const withFigure: MatexDoc = {
      type: 'doc',
      version: 4,
      content: [
        {
          type: 'figure',
          caption: 'Cap',
          id: 'f1',
          label: 'fig:a',
          items: [{ kind: 'image', src: 'a.png', width: 0.7 }],
        },
        { type: 'figure', items: [{ kind: 'image', src: 'b.png' }] }, // mínimo
        {
          type: 'figure',
          items: [
            {
              kind: 'plot',
              spec: {
                functions: [
                  { expr: 'x^2', legend: 'p', color: 'orange', style: 'dashed', domain: [0, 2] },
                  { expr: 'x', disabled: true },
                  {
                    expr: '',
                    markJumps: true,
                    pieces: [
                      { expr: '-1', from: -2, to: 0 },
                      { expr: '1', from: 0, to: 2 },
                    ],
                  },
                ],
                domain: [-4, 4],
                grid: true,
                equalAxes: true,
                legend: true,
                legendPos: 'bottom-right',
                piTicks: true,
                tangents: [{ fn: 0, at: 1, label: 't' }],
                data: [{ points: [[0, 0], [1, 1]], legend: 'd', color: 'teal', line: true, style: 'dashed', open: true }],
                parametrics: [{ x: 'cos(t)', y: 'sin(t)', tmin: 0, tmax: 6.283, legend: 'círculo', color: 'violet', style: 'dotted' }],
                polars: [{ r: '1 + cos(t)', tmin: 0, tmax: 6.283, legend: 'cardioide', color: 'orange', style: 'dashed' }],
                implicits: [{ equation: 'x^2 + y^2 = 4', legend: 'círculo', color: 'blue', style: 'dashed', disabled: true }],
                intersections: [{ a: { kind: 'function', i: 0 }, b: { kind: 'implicit', i: 0 }, label: 'X', color: 'red' }],
                title: 'Demo',
                samples: 250,
                texts: [{ x: 1, y: 2, text: 'acá' }],
                areas: [{ fn: 0, from: 0, to: 2, toFn: 1 }],
                points: [{ x: 1, y: 1, label: 'P', open: true, fn: 0 }],
                vlines: [{ x: 2, label: 'a' }],
                hlines: [{ y: 0, label: 'as' }],
                parameters: [{ name: 'a', value: 2, min: 0, max: 5 }, { name: 'k', value: -1 }],
              },
            },
          ],
        },
      ],
    }
    expect(tiptapToAst(astToTiptap(withFigure))).toEqual(withFigure)
  })

  it('la parte "chart" (barras/torta) round-trippea', () => {
    const withChart: MatexDoc = {
      type: 'doc',
      version: 4,
      content: [
        {
          type: 'figure',
          caption: 'Datos',
          items: [
            {
              kind: 'chart',
              spec: {
                form: 'bar',
                categories: ['A', 'B', 'C'],
                series: [
                  { label: 'S1', values: [3, 5, 2], color: 'teal' },
                  { values: [1, 2, 3] },
                ],
                title: 'T',
                legend: true,
                ylabel: 'Y',
              },
            },
            { kind: 'chart', spec: { form: 'pie', categories: ['x', 'y'], series: [{ values: [10, 20] }] } },
          ],
        },
      ],
    }
    expect(tiptapToAst(astToTiptap(withChart))).toEqual(withChart)
  })

  it('el nodo "derivation" round-trippea (título + pasos con nota/boxed)', () => {
    const withDeriv: MatexDoc = {
      type: 'doc',
      version: 4,
      content: [
        {
          type: 'derivation',
          title: 'Resolución',
          steps: [{ tex: 'x^2 - 1 &= 0', note: 'condición' }, { tex: 'x^2 &= 1' }, { tex: 'x &= \\pm 1', boxed: true }],
        },
      ],
    }
    expect(tiptapToAst(astToTiptap(withDeriv))).toEqual(withDeriv)
  })

  it('el nodo "reasoning" (dos columnas, celdas ricas) round-trippea', () => {
    const withReasoning: MatexDoc = {
      type: 'doc',
      version: 4,
      content: [
        {
          type: 'reasoning',
          title: 'Resolución',
          rows: [
            { left: [{ type: 'paragraph', content: [{ type: 'text', text: 'Partimos de' }] }, { type: 'mathDisplay', rows: [{ tex: 'x = 1' }] }], right: [{ type: 'paragraph', content: [{ type: 'text', text: 'la condición' }] }], boxed: true },
            { left: [{ type: 'paragraph', content: [{ type: 'text', text: 'listo' }] }], right: [{ type: 'paragraph', content: [{ type: 'text', text: 'qed' }] }] },
          ],
        },
      ],
    }
    expect(tiptapToAst(astToTiptap(withReasoning))).toEqual(withReasoning)
  })

  it('la parte "diagram" (conmutativo: nodos en grilla + aristas) round-trippea', () => {
    const withDiagram: MatexDoc = {
      type: 'doc',
      version: 4,
      content: [
        {
          type: 'figure',
          caption: 'Cuadrado',
          items: [
            {
              kind: 'diagram',
              spec: {
                form: 'commutative',
                nodes: [
                  { id: 'a', label: 'A', row: 0, col: 0 },
                  { id: 'b', label: 'B', row: 0, col: 1 },
                  { id: 'c', label: 'C', row: 1, col: 0 },
                  { id: 'd', label: 'D', row: 1, col: 1 },
                ],
                edges: [
                  { from: 'a', to: 'b', label: 'f' },
                  { from: 'a', to: 'c', label: 'g', style: 'dashed' },
                  { from: 'b', to: 'd', label: 'h', tip: 'mono' },
                  { from: 'c', to: 'd', label: 'k', bend: 'right' },
                ],
                title: 'T',
              },
            },
          ],
        },
      ],
    }
    expect(tiptapToAst(astToTiptap(withDiagram))).toEqual(withDiagram)
  })

  it('la parte "tree" (árbol jerárquico) round-trippea', () => {
    const withTree: MatexDoc = {
      type: 'doc',
      version: 4,
      content: [
        {
          type: 'figure',
          caption: 'Taxonomía',
          items: [
            {
              kind: 'tree',
              spec: {
                form: 'tree',
                nodes: [
                  { id: 'r', label: 'Seres vivos' },
                  { id: 'a', label: 'Animales', parent: 'r' },
                  { id: 'p', label: 'Plantas', parent: 'r' },
                  { id: 'm', label: 'Mamíferos', parent: 'a' },
                ],
                title: 'T',
              },
            },
          ],
        },
      ],
    }
    expect(tiptapToAst(astToTiptap(withTree))).toEqual(withTree)
  })

  it('la parte "distribution" (histograma/boxplot) round-trippea', () => {
    const withDist: MatexDoc = {
      type: 'doc',
      version: 4,
      content: [
        {
          type: 'figure',
          items: [
            { kind: 'distribution', spec: { form: 'histogram', data: [{ label: 'A', samples: [1, 2, 3, 4], color: 'teal' }], bins: 5, title: 'H', xlabel: 'x', legend: true } },
            { kind: 'distribution', spec: { form: 'boxplot', data: [{ samples: [1, 2, 3] }, { label: 'B', samples: [2, 4, 6, 8] }] } },
          ],
        },
      ],
    }
    expect(tiptapToAst(astToTiptap(withDist))).toEqual(withDist)
  })

  it('ignora nodos no soportados al volver al AST', () => {
    const ast = tiptapToAst({
      type: 'doc',
      content: [
        { type: 'horizontalRule' },
        { type: 'paragraph', content: [{ type: 'text', text: 'ok' }] },
      ],
    })
    expect(ast.content).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: 'ok' }] }])
  })
})

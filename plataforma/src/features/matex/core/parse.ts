import { z } from 'zod'
import { parseBibtex } from './bibtex'
import type {
  AccentColor,
  BlockNode,
  BulletListNode,
  CalloutNode,
  DocKind,
  DocStyle,
  ListItemNode,
  MatexDoc,
  ColumnsNode,
  ExamQuestionNode,
  CvEntryNode,
  PosterBlockNode,
  OrderedListNode,
  ReasoningNode,
  SlideNode,
  TheoremNode,
} from './ast'

/**
 * (De)serialización del AST Matex a/desde JSON, con **validación** (zod) al cargar
 * — falla temprano si un documento persistido está mal formado. El AST **es** JSON;
 * esto solo asegura su forma. La recursión (listas que contienen bloques) se maneja
 * con `z.lazy`.
 */

const markSchema = z.enum(['strong', 'emph', 'code'])

const textNode = z.object({
  type: z.literal('text'),
  text: z.string(),
  marks: z.array(markSchema).optional(),
})
const mathInline = z.object({ type: z.literal('mathInline'), tex: z.string() })
const ref = z.object({ type: z.literal('ref'), target: z.string() })
const cite = z.object({
  type: z.literal('cite'),
  keys: z.array(z.string()),
  style: z.enum(['parenthetical', 'textual']).optional(),
})
const footnote = z.object({ type: z.literal('footnote'), text: z.string() })
const inlineNode = z.discriminatedUnion('type', [textNode, mathInline, ref, cite, footnote])

const heading = z.object({
  type: z.literal('heading'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  content: z.array(inlineNode),
  id: z.string().optional(),
  label: z.string().optional(),
})
// ME-46: parte (`\part`), la división por encima del capítulo.
const part = z.object({
  type: z.literal('part'),
  content: z.array(inlineNode),
  id: z.string().optional(),
  label: z.string().optional(),
})
const paragraph = z.object({ type: z.literal('paragraph'), content: z.array(inlineNode) })
const equationRow = z.object({
  tex: z.string(),
  numbered: z.boolean().optional(),
  id: z.string().optional(),
  label: z.string().optional(),
})

/**
 * Migración de `mathDisplay` a la forma actual (filas + `aligned`):
 * - **v1** (`tex` de bloque) → `rows`; `align`/`gather` viejos se parten por `\\`; el
 *   `id`/`label`/`numbered` de bloque van a la primera fila.
 * - **`kind` → `aligned`** (en v1 y en la v2 intermedia): `gather` era centrado
 *   (`aligned:false`); `align`/`plain` quedan alineadas (default, se omite el campo).
 * El campo `kind` desaparece del modelo (el entorno lo deriva el compilador).
 */
function migrateMathDisplay(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const r = raw as Record<string, unknown>
  if (r.type !== 'mathDisplay') return raw
  const kind = r.kind
  const alignedField = kind === 'gather' ? { aligned: false } : {} // default = alineado
  if (Array.isArray(r.rows)) {
    // Ya usa `rows`; si además trae `kind`, lo convertimos a `aligned` y lo dropeamos.
    if (kind === undefined) return raw
    return { type: 'mathDisplay', rows: r.rows, ...alignedField }
  }
  const tex = String(r.tex ?? '')
  const carry = (row: Record<string, unknown>): Record<string, unknown> => {
    if (r.numbered === true) row.numbered = true
    if (typeof r.id === 'string') row.id = r.id
    if (typeof r.label === 'string') row.label = r.label
    return row
  }
  if (kind === 'align' || kind === 'gather') {
    const lines = tex.split(/\\\\/).map((s) => s.trim()).filter((s) => s.length > 0)
    const rows = (lines.length > 0 ? lines : [tex]).map((t, i) =>
      i === 0 ? carry({ tex: t }) : { tex: t, ...(r.numbered === true ? { numbered: true } : {}) },
    )
    return { type: 'mathDisplay', rows, ...alignedField }
  }
  return { type: 'mathDisplay', rows: [carry({ tex })], ...alignedField }
}

const mathDisplay = z.preprocess(
  migrateMathDisplay,
  z.object({
    type: z.literal('mathDisplay'),
    aligned: z.boolean().optional(),
    rows: z.array(equationRow),
  }),
)
const derivation = z.object({
  type: z.literal('derivation'),
  title: z.string().optional(),
  steps: z.array(z.object({ tex: z.string(), note: z.string().optional(), boxed: z.boolean().optional() })),
  id: z.string().optional(),
  label: z.string().optional(),
})
const theoremVariant = z.enum([
  'theorem', 'lemma', 'proposition', 'corollary', 'definition', 'example', 'remark', 'proof',
])
const tableCell = z.object({ type: z.literal('tableCell'), content: z.array(inlineNode) })
const tableRow = z.object({ type: z.literal('tableRow'), cells: z.array(tableCell) })
const table = z.object({
  type: z.literal('table'),
  rows: z.array(tableRow),
  align: z.array(z.enum(['left', 'center', 'right'])).optional(),
  header: z.boolean().optional(),
  rules: z.enum(['none', 'horizontal']).optional(),
  caption: z.string().optional(),
  id: z.string().optional(),
  label: z.string().optional(),
})
const plotPiece = z.object({ expr: z.string(), from: z.number(), to: z.number() })
const plotFunction = z.object({
  expr: z.string(),
  fromData: z.object({ series: z.number().int(), method: z.enum(['linear', 'step', 'spline', 'monotone', 'polynomial', 'regression', 'reg-exp', 'reg-log', 'reg-power', 'polyline', 'smooth']), degree: z.number().optional() }).optional(),
  legend: z.string().optional(),
  disabled: z.boolean().optional(),
  domain: z.tuple([z.number(), z.number()]).optional(),
  color: z.string().optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
  width: z.enum(['xthin', 'thin', 'normal', 'thick', 'xthick']).optional(),
  role: z.enum(['primary', 'secondary', 'derivative', 'auxiliary', 'highlight', 'region']).optional(),
  pieces: z.array(plotPiece).optional(),
  markJumps: z.boolean().optional(),
  markRoots: z.boolean().optional(),
  markExtrema: z.boolean().optional(),
  markInflections: z.boolean().optional(),
  markAsymptotes: z.boolean().optional(),
  markYIntercept: z.boolean().optional(),
  featureCoords: z.boolean().optional(),
  inverse: z.boolean().optional(),
  endLabel: z.boolean().optional(),
  shade: z.enum(['above', 'below']).optional(),
})
const plotSpec = z.object({
  functions: z.array(plotFunction),
  domain: z.tuple([z.number(), z.number()]),
  range: z.tuple([z.number(), z.number()]).optional(),
  xlabel: z.string().optional(),
  ylabel: z.string().optional(),
  grid: z.boolean().optional(),
  legend: z.boolean().optional(),
  featureLegend: z.boolean().optional(),
  title: z.string().optional(),
  samples: z.number().optional(),
  piTicks: z.boolean().optional(),
  hideTicks: z.boolean().optional(),
  // Migra valores viejos (pgfplots) → posición semántica (docs persistidos antes del cambio).
  legendPos: z
    .preprocess(
      (v) =>
        typeof v === 'string'
          ? ({ 'north west': 'top-left', 'north east': 'top-right', 'south west': 'bottom-left', 'south east': 'bottom-right', 'outer north east': 'outside-right' }[v] ?? v)
          : v,
      z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'outside-right']).optional(),
    ),
  syntax: z.enum(['ascii', 'latex']).optional(),
  equalAxes: z.boolean().optional(),
  areas: z
    .array(
      z.object({
        fn: z.number(),
        from: z.number(),
        to: z.number(),
        toFn: z.number().optional(),
        pattern: z.enum(['solid', 'lines', 'lines-alt', 'crosshatch', 'dots', 'grid', 'horizontal', 'vertical']).optional(),
        showValue: z.boolean().optional(),
        fromExpr: z.string().optional(),
        toExpr: z.string().optional(),
        riemann: z.enum(['left', 'right', 'mid', 'trapezoid']).optional(),
        riemannN: z.number().optional(),
        labelPos: z.enum(['auto', 'above', 'below']).optional(),
      }),
    )
    .optional(),
  points: z.array(z.object({ x: z.number(), y: z.number(), label: z.string().optional(), open: z.boolean().optional(), fn: z.number().int().optional(), xExpr: z.string().optional() })).optional(),
  vlines: z.array(z.object({ x: z.number(), label: z.string().optional(), xExpr: z.string().optional() })).optional(),
  hlines: z.array(z.object({ y: z.number(), label: z.string().optional(), yExpr: z.string().optional() })).optional(),
  tangents: z.array(z.object({ fn: z.number(), at: z.number(), label: z.string().optional(), showValue: z.boolean().optional(), atExpr: z.string().optional(), labelPos: z.enum(['auto', 'above', 'below']).optional() })).optional(),
  data: z
    .array(
      z.object({
        points: z.array(z.tuple([z.number(), z.number()])),
        legend: z.string().optional(),
        color: z.string().optional(),
        line: z.boolean().optional(),
        style: z.enum(['solid', 'dashed', 'dotted']).optional(),
        width: z.enum(['xthin', 'thin', 'normal', 'thick', 'xthick']).optional(),
        interpolate: z.enum(['linear', 'step', 'spline', 'monotone', 'polynomial', 'regression', 'reg-exp', 'reg-log', 'reg-power', 'polyline', 'smooth']).optional(),
        interpDegree: z.number().optional(),
        closed: z.boolean().optional(),
        open: z.boolean().optional(),
        disabled: z.boolean().optional(),
      }),
    )
    .optional(),
  parametrics: z
    .array(
      z.object({
        x: z.string(),
        y: z.string(),
        tmin: z.number(),
        tmax: z.number(),
        legend: z.string().optional(),
        color: z.string().optional(),
        style: z.enum(['solid', 'dashed', 'dotted']).optional(),
        width: z.enum(['xthin', 'thin', 'normal', 'thick', 'xthick']).optional(),
        disabled: z.boolean().optional(),
      }),
    )
    .optional(),
  polars: z
    .array(
      z.object({
        r: z.string(),
        tmin: z.number(),
        tmax: z.number(),
        legend: z.string().optional(),
        color: z.string().optional(),
        style: z.enum(['solid', 'dashed', 'dotted']).optional(),
        width: z.enum(['xthin', 'thin', 'normal', 'thick', 'xthick']).optional(),
        disabled: z.boolean().optional(),
      }),
    )
    .optional(),
  implicits: z
    .array(
      z.object({
        equation: z.string(),
        legend: z.string().optional(),
        color: z.string().optional(),
        style: z.enum(['solid', 'dashed', 'dotted']).optional(),
        width: z.enum(['xthin', 'thin', 'normal', 'thick', 'xthick']).optional(),
        disabled: z.boolean().optional(),
      }),
    )
    .optional(),
  conics: z
    .array(
      z.object({
        kind: z.enum(['circle', 'ellipse', 'parabola', 'hyperbola']),
        cx: z.number(),
        cy: z.number(),
        r: z.number().optional(),
        a: z.number().optional(),
        b: z.number().optional(),
        p: z.number().optional(),
        opens: z.enum(['up', 'down', 'left', 'right']).optional(),
        angle: z.number().optional(),
        legend: z.string().optional(),
        color: z.string().optional(),
        style: z.enum(['solid', 'dashed', 'dotted']).optional(),
        width: z.enum(['xthin', 'thin', 'normal', 'thick', 'xthick']).optional(),
        disabled: z.boolean().optional(),
      }),
    )
    .optional(),
  intersections: z
    .array(
      z.object({
        a: z.object({ kind: z.enum(['function', 'implicit', 'parametric', 'polar', 'xaxis', 'yaxis']), i: z.number().int() }),
        b: z.object({ kind: z.enum(['function', 'implicit', 'parametric', 'polar', 'xaxis', 'yaxis']), i: z.number().int() }),
        label: z.string().optional(),
        color: z.string().optional(),
        showCoords: z.boolean().optional(),
        disabled: z.boolean().optional(),
      }),
    )
    .optional(),
  texts: z.array(z.object({ x: z.number(), y: z.number(), text: z.string() })).optional(),
  parameters: z
    .array(z.object({ name: z.string(), value: z.number(), min: z.number().optional(), max: z.number().optional(), step: z.number().optional() }))
    .optional(),
})
const figureImage = z.object({
  kind: z.literal('image'),
  src: z.string(),
  width: z.number().optional(),
  subcaption: z.string().optional(),
  id: z.string().optional(),
  label: z.string().optional(),
})
const figurePlot = z.object({
  kind: z.literal('plot'),
  spec: plotSpec,
  width: z.number().optional(),
  subcaption: z.string().optional(),
  id: z.string().optional(),
  label: z.string().optional(),
})
const chartSpec = z.object({
  form: z.enum(['bar', 'stackedBar', 'hbar', 'line', 'pie']),
  categories: z.array(z.string()),
  series: z.array(
    z.object({
      label: z.string().optional(),
      values: z.array(z.number()),
      color: z.string().optional(),
    }),
  ),
  title: z.string().optional(),
  legend: z.boolean().optional(),
  ylabel: z.string().optional(),
})
const figureChart = z.object({
  kind: z.literal('chart'),
  spec: chartSpec,
  width: z.number().optional(),
  subcaption: z.string().optional(),
  id: z.string().optional(),
  label: z.string().optional(),
})
const distSpec = z.object({
  form: z.enum(['histogram', 'boxplot']),
  data: z.array(z.object({ label: z.string().optional(), samples: z.array(z.number()), color: z.string().optional() })),
  bins: z.number().optional(),
  title: z.string().optional(),
  xlabel: z.string().optional(),
  ylabel: z.string().optional(),
  legend: z.boolean().optional(),
})
const figureDist = z.object({
  kind: z.literal('distribution'),
  spec: distSpec,
  width: z.number().optional(),
  subcaption: z.string().optional(),
  id: z.string().optional(),
  label: z.string().optional(),
})
const diagramSpec = z.object({
  form: z.enum(['commutative']),
  nodes: z.array(z.object({ id: z.string(), label: z.string(), row: z.number().int(), col: z.number().int() })),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      label: z.string().optional(),
      // v3 (LE-02): las puntas pasaron del vocabulario de `tikz-cd` al del morfismo.
      tip: z.preprocess((v) => TIP_V2_TO_V3[v as string] ?? v, z.enum(['arrow', 'mono', 'epi', 'mapsto']).optional()),
      style: z.enum(['solid', 'dashed', 'dotted']).optional(),
      bend: z.enum(['left', 'right']).optional(),
    }),
  ),
  title: z.string().optional(),
})
const figureDiagram = z.object({
  kind: z.literal('diagram'),
  spec: diagramSpec,
  width: z.number().optional(),
  subcaption: z.string().optional(),
  id: z.string().optional(),
  label: z.string().optional(),
})
const treeSpec = z.object({
  form: z.enum(['tree']),
  nodes: z.array(z.object({ id: z.string(), label: z.string(), parent: z.string().optional() })),
  title: z.string().optional(),
})
const figureTree = z.object({
  kind: z.literal('tree'),
  spec: treeSpec,
  width: z.number().optional(),
  subcaption: z.string().optional(),
  id: z.string().optional(),
  label: z.string().optional(),
})
const figureItem = z.discriminatedUnion('kind', [figureImage, figurePlot, figureChart, figureDist, figureDiagram, figureTree])

/** Migración de la figura de 1 imagen (`{src, width}`) al contenedor de partes (`items`). */
function migrateFigure(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const r = raw as Record<string, unknown>
  if (r.type !== 'figure' || Array.isArray(r.items)) return raw // ya es el modelo nuevo
  const item: Record<string, unknown> = { kind: 'image', src: String(r.src ?? '') }
  if (typeof r.width === 'number') item.width = r.width
  const out: Record<string, unknown> = { type: 'figure', items: [item] }
  if (typeof r.caption === 'string') out.caption = r.caption
  if (typeof r.id === 'string') out.id = r.id
  if (typeof r.label === 'string') out.label = r.label
  return out
}

const figure = z.preprocess(
  migrateFigure,
  z.object({
    type: z.literal('figure'),
    caption: z.string().optional(),
    id: z.string().optional(),
    label: z.string().optional(),
    items: z.array(figureItem),
  }),
)
const codeBlock = z.object({ type: z.literal('codeBlock'), code: z.string(), language: z.string().optional() })
const bibStyle = z.enum(['numeric', 'authoryear', 'alphabetic'])
const bibEntry = z.object({
  key: z.string(),
  type: z.enum(['book', 'article', 'incollection', 'inproceedings', 'thesis', 'online', 'misc']),
  author: z.string().optional(),
  title: z.string().optional(),
  year: z.string().optional(),
  journal: z.string().optional(),
  booktitle: z.string().optional(),
  publisher: z.string().optional(),
  institution: z.string().optional(),
  volume: z.string().optional(),
  number: z.string().optional(),
  pages: z.string().optional(),
  edition: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  note: z.string().optional(),
})
const include = z.object({ type: z.literal('include'), target: z.string() })
const rawLatex = z.object({ type: z.literal('rawLatex'), latex: z.string() })

// Recursivos: bloques → listas/teoremas → bloques. `z.lazy` + anotación de tipo
// rompen el ciclo sin evaluación anticipada.
const blockNode: z.ZodType<BlockNode> = z.lazy(() =>
  z.union([part, heading, paragraph, bulletList, orderedList, mathDisplay, derivation, reasoning, theorem, table, figure, codeBlock, callout, include, rawLatex, slide, columns, examQuestion, cvEntry, posterBlock]),
)
const slide: z.ZodType<SlideNode> = z.lazy(() =>
  z.object({
    type: z.literal('slide'),
    title: z.string().optional(),
    content: z.array(blockNode),
    reveal: z.boolean().optional(),
  }),
)
const examQuestion: z.ZodType<ExamQuestionNode> = z.lazy(() =>
  z.object({
    type: z.literal('examQuestion'),
    points: z.number().optional(),
    content: z.array(blockNode),
    solution: z.array(blockNode).optional(),
  }),
)
const posterBlock: z.ZodType<PosterBlockNode> = z.lazy(() =>
  z.object({
    type: z.literal('posterBlock'),
    title: z.string().optional(),
    content: z.array(blockNode),
    column: z.number().optional(),
  }),
)
const cvEntry: z.ZodType<CvEntryNode> = z.lazy(() =>
  z.object({
    type: z.literal('cvEntry'),
    period: z.string().optional(),
    role: z.string().optional(),
    org: z.string().optional(),
    place: z.string().optional(),
    detail: z.string().optional(),
  }),
)
const columns: z.ZodType<ColumnsNode> = z.lazy(() =>
  z.object({
    type: z.literal('columns'),
    columns: z.array(z.object({ ratio: z.number().optional(), content: z.array(blockNode) })),
  }),
)
const reasoning: z.ZodType<ReasoningNode> = z.lazy(() =>
  z.object({
    type: z.literal('reasoning'),
    title: z.string().optional(),
    rows: z.array(z.object({ left: z.array(blockNode), right: z.array(blockNode), boxed: z.boolean().optional() })),
    id: z.string().optional(),
    label: z.string().optional(),
  }),
)
const theorem: z.ZodType<TheoremNode> = z.lazy(() =>
  z.object({
    type: z.literal('theorem'),
    variant: theoremVariant,
    title: z.string().optional(),
    id: z.string().optional(),
    label: z.string().optional(),
    proves: z.string().optional(),
    content: z.array(blockNode),
  }),
)
const callout: z.ZodType<CalloutNode> = z.lazy(() =>
  z.object({
    type: z.literal('callout'),
    variant: z.enum(['note', 'tip', 'warning', 'important']),
    title: z.string().optional(),
    content: z.array(blockNode),
  }),
)
const listItem: z.ZodType<ListItemNode> = z.lazy(() =>
  z.object({ type: z.literal('listItem'), content: z.array(blockNode) }),
)
const bulletList: z.ZodType<BulletListNode> = z.lazy(() =>
  z.object({ type: z.literal('bulletList'), items: z.array(listItem) }),
)
const orderedList: z.ZodType<OrderedListNode> = z.lazy(() =>
  z.object({ type: z.literal('orderedList'), items: z.array(listItem) }),
)

const author = z.object({
  name: z.string(),
  affiliation: z.string().optional(),
  email: z.string().optional(),
})
/* ── Migración v2→v3 (LE-02): del vocabulario de LaTeX al diseño semántico ────────────── */

/** Puntas de flecha: del vocabulario de `tikz-cd` al del morfismo. */
const TIP_V2_TO_V3: Record<string, string> = { to: 'arrow', hook: 'mono', twoheads: 'epi', mapsto: 'mapsto' }

/** Clase LaTeX → estructura del documento. Las KOMA (`scr*`) y `memoir` mapean igual que su par. */
const CLASS_TO_KIND: Record<string, DocKind> = {
  article: 'article',
  scrartcl: 'article',
  report: 'report',
  scrreprt: 'report',
  book: 'book',
  scrbook: 'book',
  memoir: 'book',
}

/** Temas de color de beamer → acento semántico (los que tienen un color declarado). */
const BEAMER_COLOR_TO_ACCENT: Record<string, AccentColor> = {
  beaver: 'red',
  rose: 'red',
  seahorse: 'blue',
  dolphin: 'blue',
  whale: 'blue',
  crane: 'orange',
  orchid: 'purple',
  spruce: 'green',
  lily: 'grey',
}

/** Estilos de moderncv → familia de diseño. */
const CV_STYLE_TO_DOCSTYLE: Record<string, DocStyle> = {
  banking: 'standard',
  classic: 'classic',
  oldstyle: 'classic',
  casual: 'modern',
  fancy: 'modern',
}

/** Temas de tikzposter → familia de diseño. */
const POSTER_THEME_TO_DOCSTYLE: Record<string, DocStyle> = {
  Default: 'standard',
  Basic: 'standard',
  Simple: 'standard',
  Rays: 'modern',
  Envelope: 'classic',
  Board: 'classic',
  Autumn: 'classic',
}

/** Paletas de tikzposter → acento semántico. */
const POSTER_PALETTE_TO_ACCENT: Record<string, AccentColor> = {
  BlueGrayOrange: 'blue',
  GreenGrayViolet: 'green',
  PurpleGrayBlue: 'purple',
}

const ACCENTS = new Set(['blue', 'green', 'orange', 'red', 'purple', 'grey', 'black'])

/**
 * **v2→v3 (LE-02).** Desarma la línea cruda `\documentclass` y traduce los nombres de temas
 * de paquete (beamer/moderncv/tikzposter) al vocabulario semántico del AST
 * (`docKind`/`style`/`accent`/`paperSize`/`baseFontSize`).
 *
 * Es **idempotente** —solo actúa si encuentra campos legados— y **conservadora**: nunca pisa
 * un campo semántico ya presente. Lo que no tiene equivalente (el tema exacto: `metropolis` vs
 * `Warsaw`) se colapsa a la familia de diseño más cercana; ese es el costo aceptado de no
 * guardar vocabulario de backend en el modelo.
 */
function migrateDesign(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const r = { ...(raw as Record<string, unknown>) }
  // Parsear **normaliza la versión**: lo que entra viejo, sale al día (los nodos v1 los migra
  // `migrateMathDisplay`, por forma). Sin meta no hay nada de diseño que traducir.
  if (typeof r.version === 'number' && r.version >= 1 && r.version <= 3) r.version = 3
  if (typeof r.meta !== 'object' || r.meta === null) return r
  const meta = { ...(r.meta as Record<string, unknown>) }

  // El primero que aporta un valor gana; nunca se pisa lo que ya venía en forma semántica.
  const put = (key: string, value: string | number | boolean | undefined): void => {
    if (value !== undefined && meta[key] === undefined) meta[key] = value
  }

  // 1) La línea `\documentclass[opciones]{clase}` se desarma en sus partes semánticas.
  if (typeof meta.documentclass === 'string') {
    const line = meta.documentclass
    const cls = /\{([A-Za-z]+)\}\s*$/.exec(line)?.[1]
    const opts = (/\[([^\]]*)\]/.exec(line)?.[1] ?? '').split(',').map((o) => o.trim().toLowerCase())
    if (cls) {
      put('docKind', CLASS_TO_KIND[cls] ?? 'article')
      // Las clases KOMA y memoir son, en esencia, una familia de diseño distinta.
      if (cls.startsWith('scr') || cls === 'memoir') put('style', 'modern')
    }
    if (opts.includes('titlepage')) put('titlePage', true)
    for (const size of [10, 11, 12]) if (opts.includes(`${size}pt`)) put('baseFontSize', size)
    if (opts.includes('letterpaper')) put('paperSize', 'letter')
    else if (opts.includes('a4paper')) put('paperSize', 'a4')
    delete meta.documentclass
  }

  // 2) Temas de beamer → familia de diseño + acento.
  if (typeof meta.theme === 'string') {
    // `metropolis` es el look moderno por antonomasia; el resto de los temas de beamer
    // (Madrid, Warsaw, Berlin…) son la estética clásica con barras y sombreados.
    put('style', meta.theme.trim().toLowerCase() === 'metropolis' ? 'modern' : 'classic')
    delete meta.theme
  }
  if (typeof meta.colortheme === 'string') {
    put('accent', BEAMER_COLOR_TO_ACCENT[meta.colortheme.trim().toLowerCase()])
    delete meta.colortheme
  }

  // 3) CV: estilo y color de moderncv → los campos del documento.
  if (typeof meta.cv === 'object' && meta.cv !== null) {
    const cv = { ...(meta.cv as Record<string, unknown>) }
    if (typeof cv.style === 'string') put('style', CV_STYLE_TO_DOCSTYLE[cv.style.trim().toLowerCase()])
    if (typeof cv.color === 'string' && ACCENTS.has(cv.color.trim().toLowerCase())) put('accent', cv.color.trim().toLowerCase())
    delete cv.style
    delete cv.color
    meta.cv = cv
  }

  // 4) Póster: tema y paleta de tikzposter → ídem.
  if (typeof meta.poster === 'object' && meta.poster !== null) {
    const poster = { ...(meta.poster as Record<string, unknown>) }
    if (typeof poster.theme === 'string') put('style', POSTER_THEME_TO_DOCSTYLE[poster.theme.trim()])
    if (typeof poster.colorPalette === 'string') put('accent', POSTER_PALETTE_TO_ACCENT[poster.colorPalette.trim()])
    delete poster.theme
    delete poster.colorPalette
    meta.poster = poster
  }

  r.meta = meta
  return r
}

/**
 * **v3→v4 (AR-09).** Los cinco flags de familia sueltos (`presentation`/`letter`/`exam`/`cv`/
 * `poster`) se unifican en `meta.family` (unión discriminada), con la **misma precedencia** que
 * usaba el compilador si por un bug había varios a la vez. `exam.showSolutions` se **descarta**:
 * pasó a ser una ocasión de emisión (`opts`), no una propiedad del documento (Regla 2 §2).
 * Idempotente (si ya hay `family`, no toca nada) y conservadora.
 */
function migrateFamily(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const r = { ...(raw as Record<string, unknown>) }
  if (typeof r.version === 'number' && r.version >= 1 && r.version <= 4) r.version = 4
  if (typeof r.meta !== 'object' || r.meta === null) return r
  const meta = { ...(r.meta as Record<string, unknown>) }

  const legacy = ['presentation', 'letter', 'exam', 'cv', 'poster']
  const hasLegacy = legacy.some((k) => meta[k] !== undefined)
  if (meta.family === undefined && hasLegacy) {
    // Precedencia (igual que la vieja cadena de `if` del compilador): presentación > carta >
    // examen > CV > póster.
    if (meta.presentation === true) meta.family = { kind: 'presentation' }
    else if (meta.letter && typeof meta.letter === 'object') meta.family = { kind: 'letter', letter: meta.letter }
    else if (meta.exam && typeof meta.exam === 'object') {
      const { showSolutions: _drop, ...exam } = meta.exam as Record<string, unknown> // showSolutions → opts (se descarta)
      meta.family = { kind: 'exam', exam }
    } else if (meta.cv && typeof meta.cv === 'object') meta.family = { kind: 'cv', cv: meta.cv }
    else if (meta.poster && typeof meta.poster === 'object') meta.family = { kind: 'poster', poster: meta.poster }
  }
  for (const k of legacy) delete meta[k]

  r.meta = meta
  return r
}

/** Metadata de cada familia de documento (AR-09). Todos los campos son opcionales. */
const letterMetaSchema = z.object({
  to: z.string().optional(),
  toAddress: z.string().optional(),
  from: z.string().optional(),
  fromAddress: z.string().optional(),
  opening: z.string().optional(),
  closing: z.string().optional(),
  signature: z.string().optional(),
  encl: z.string().optional(),
  cc: z.string().optional(),
})
const examMetaSchema = z.object({ instructions: z.string().optional() })
const cvMetaSchema = z.object({ email: z.string().optional(), address: z.string().optional(), subtitle: z.string().optional() })
const posterMetaSchema = z.object({ columns: z.number().optional() })

/** **Familia del documento** (unión discriminada por `kind`); reemplaza a los 5 flags sueltos. */
const docFamily = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('presentation') }),
  z.object({ kind: z.literal('letter'), letter: letterMetaSchema }),
  z.object({ kind: z.literal('exam'), exam: examMetaSchema }),
  z.object({ kind: z.literal('cv'), cv: cvMetaSchema }),
  z.object({ kind: z.literal('poster'), poster: posterMetaSchema }),
])

const docMeta = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  authors: z.array(author).optional(),
  institution: z.string().optional(),
  abstract: z.string().optional(),
  date: z.string().optional(),
  titlePage: z.boolean().optional(),
  toc: z.boolean().optional(),
  // v3 (LE-02): diseño semántico — nada de vocabulario de clases/paquetes LaTeX.
  docKind: z.enum(['article', 'report', 'book']).optional(),
  style: z.enum(['standard', 'classic', 'modern']).optional(),
  accent: z.enum(['blue', 'green', 'orange', 'red', 'purple', 'grey', 'black']).optional(),
  paperSize: z.enum(['a4', 'letter']).optional(),
  baseFontSize: z.union([z.literal(10), z.literal(11), z.literal(12)]).optional(),
  columns: z.union([z.literal(1), z.literal(2)]).optional(),
  margin: z.string().optional(),
  bibStyle: bibStyle.optional(),
  bibTitle: z.string().optional(),
  // v4 (AR-09): familia como unión discriminada (antes, 5 flags sueltos → estados imposibles).
  family: docFamily.optional(),
})

/**
 * Migración de bibliografía al modelo actual: el bloque `bibliography` (marcador) ya **no
 * existe** en el contenido (la biblioteca vive en `doc.references` y el estilo/título en
 * `meta`; `\printbibliography` se emite al final). Si un doc viejo tiene ese nodo en
 * `content`, lo **quitamos** y subimos sus datos: `entries` (string `.bib`) → `references`,
 * `style`/`title` → `meta.bibStyle`/`meta.bibTitle`.
 */
function migrateReferences(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.content)) return raw
  const marker = r.content.find((n) => (n as Record<string, unknown> | null)?.type === 'bibliography') as
    | Record<string, unknown>
    | undefined
  if (!marker) return raw
  const content = r.content.filter((n) => (n as Record<string, unknown> | null)?.type !== 'bibliography')
  const references =
    r.references !== undefined ? r.references
    : typeof marker.entries === 'string' && marker.entries.trim() ? parseBibtex(marker.entries)
    : undefined
  const metaIn = (typeof r.meta === 'object' && r.meta !== null ? r.meta : {}) as Record<string, unknown>
  const meta = {
    ...metaIn,
    ...(metaIn.bibStyle === undefined && typeof marker.style === 'string' ? { bibStyle: marker.style } : {}),
    ...(metaIn.bibTitle === undefined && typeof marker.title === 'string' ? { bibTitle: marker.title } : {}),
  }
  return { ...r, content, meta, ...(references !== undefined ? { references } : {}) }
}

const matexDocSchema: z.ZodType<MatexDoc> = z.preprocess(
  // Migraciones a nivel documento, en orden: referencias → diseño (v2→v3) → familia (v3→v4).
  // `mathDisplay` (v1) se migra por nodo, según su forma.
  (raw) => migrateFamily(migrateDesign(migrateReferences(raw))),
  z.object({
    type: z.literal('doc'),
    version: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    meta: docMeta.optional(),
    content: z.array(blockNode),
    references: z.array(bibEntry).optional(),
  }),
)

/** Valida y devuelve el documento Matex (lanza si la forma es inválida). */
export function parseMatexDoc(data: unknown): MatexDoc {
  return matexDocSchema.parse(data)
}

/** Serializa el AST a JSON (formato canónico de persistencia de un doc Matex). */
export function serializeMatexDoc(doc: MatexDoc): string {
  return JSON.stringify(doc, null, 2)
}

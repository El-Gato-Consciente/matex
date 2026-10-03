import { MATEX_AST_VERSION } from '../core'
import type {
  AreaPattern,
  BlockNode,
  ChartForm,
  ChartSpec,
  CurveRef,
  DiagramSpec,
  DiagramTip,
  DiagramEdgeStyle,
  TreeSpec,
  DistForm,
  DistSpec,
  EquationRow,
  FigureItem,
  InlineNode,
  ListItemNode,
  Mark,
  MatexDoc,
  PlotSpec,
  TableAlign,
  TableRowNode,
  TheoremVariant,
} from '../core'

/**
 * **El borde limpio** entre el editor (TipTap/ProseMirror) y Matex: convierte el
 * documento de TipTap (JSON de ProseMirror) ↔ **AST Matex** (la fuente de verdad).
 * Funciones **puras y testeables**; acá vive todo el acoplamiento al framework, así
 * `matex-core` queda intacto. TipTap es efímero; el AST es lo que se persiste.
 */

/** Nodo del JSON de ProseMirror (forma mínima que usamos). */
export interface PmNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PmNode[]
  text?: string
  marks?: { type: string }[]
}

const MARK_TO_PM: Record<Mark, string> = { strong: 'bold', emph: 'italic', code: 'code' }
const PM_TO_MARK: Record<string, Mark> = { bold: 'strong', italic: 'emph', code: 'code' }

const THEOREM_VARIANTS: readonly TheoremVariant[] = [
  'theorem', 'lemma', 'proposition', 'corollary', 'definition', 'example', 'remark', 'proof',
]

/** Lee un atributo string no vacío, o `undefined` (para omitir el opcional). */
function strOrUndef(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Estilo de trazo válido (`dashed`/`dotted`/`solid`), o `undefined`. */
function lineStyle(value: unknown): 'solid' | 'dashed' | 'dotted' | undefined {
  return value === 'dashed' || value === 'dotted' || value === 'solid' ? value : undefined
}

function lineWidth(value: unknown): 'xthin' | 'thin' | 'normal' | 'thick' | 'xthick' | undefined {
  return value === 'xthin' || value === 'thin' || value === 'normal' || value === 'thick' || value === 'xthick' ? value : undefined
}

const INTERP_METHOD_VALUES = ['linear', 'step', 'spline', 'monotone', 'polynomial', 'regression', 'reg-exp', 'reg-log', 'reg-power', 'polyline', 'smooth'] as const
function interpMethod(value: unknown): (typeof INTERP_METHOD_VALUES)[number] | undefined {
  return typeof value === 'string' && (INTERP_METHOD_VALUES as readonly string[]).includes(value) ? (value as (typeof INTERP_METHOD_VALUES)[number]) : undefined
}

const PLOT_ROLE_VALUES = ['primary', 'secondary', 'derivative', 'auxiliary', 'highlight', 'region'] as const
function plotRole(value: unknown): (typeof PLOT_ROLE_VALUES)[number] | undefined {
  return typeof value === 'string' && (PLOT_ROLE_VALUES as readonly string[]).includes(value) ? (value as (typeof PLOT_ROLE_VALUES)[number]) : undefined
}

function variantOrDefault(value: unknown): TheoremVariant {
  return typeof value === 'string' && (THEOREM_VARIANTS as readonly string[]).includes(value)
    ? (value as TheoremVariant)
    : 'theorem'
}

// ── AST → TipTap ────────────────────────────────────────────────────────────

/**
 * Inlines → ProseMirror, **sin textos vacíos**: el modelo los tolera (p. ej. un `p(t(''))` de
 * plantilla), pero ProseMirror no («Empty text nodes are not allowed») y TipTap, ante contenido
 * inválido, abre el documento VACÍO — y el autosave lo pisaba. Un párrafo sin texto queda como
 * párrafo vacío, que es válido.
 */
function inlinesToPm(nodes: readonly InlineNode[]): PmNode[] {
  return nodes.filter((node) => node.type !== 'text' || node.text !== '').map(inlineToPm)
}

function inlineToPm(node: InlineNode): PmNode {
  if (node.type === 'mathInline') return { type: 'mathInline', attrs: { tex: node.tex } }
  if (node.type === 'ref') return { type: 'ref', attrs: { target: node.target } }
  if (node.type === 'cite') return { type: 'cite', attrs: { keys: node.keys, style: node.style ?? null } }
  if (node.type === 'footnote') return { type: 'footnote', attrs: { text: node.text } }
  const marks = (node.marks ?? []).map((m) => ({ type: MARK_TO_PM[m] }))
  return marks.length > 0 ? { type: 'text', text: node.text, marks } : { type: 'text', text: node.text }
}

function blockToPm(node: BlockNode): PmNode {
  switch (node.type) {
    case 'part':
      return {
        type: 'part',
        attrs: { id: node.id ?? null, label: node.label ?? null },
        content: inlinesToPm(node.content),
      }
    case 'heading':
      return {
        type: 'heading',
        attrs: { level: node.level, id: node.id ?? null, label: node.label ?? null },
        content: inlinesToPm(node.content),
      }
    case 'paragraph':
      return node.content.length > 0
        ? { type: 'paragraph', content: inlinesToPm(node.content) }
        : { type: 'paragraph' }
    case 'bulletList':
      return { type: 'bulletList', content: node.items.map(itemToPm) }
    case 'orderedList':
      return { type: 'orderedList', content: node.items.map(itemToPm) }
    case 'mathDisplay':
      return { type: 'mathDisplay', attrs: { aligned: node.aligned ?? true, rows: node.rows } }
    case 'derivation':
      return { type: 'derivation', attrs: { title: node.title ?? null, steps: node.steps, id: node.id ?? null, label: node.label ?? null } }
    case 'reasoning':
      return {
        type: 'reasoning',
        attrs: { title: node.title ?? null, id: node.id ?? null, label: node.label ?? null },
        content: node.rows.map((r) => ({
          type: 'reasoningRow',
          attrs: { boxed: r.boxed ?? false },
          content: [
            { type: 'reasoningCell', content: r.left.length > 0 ? r.left.map(blockToPm) : [{ type: 'paragraph' }] },
            { type: 'reasoningCell', content: r.right.length > 0 ? r.right.map(blockToPm) : [{ type: 'paragraph' }] },
          ],
        })),
      }
    case 'theorem':
      return {
        type: 'theorem',
        attrs: {
          variant: node.variant,
          title: node.title ?? null,
          id: node.id ?? null,
          label: node.label ?? null,
          proves: node.proves ?? null,
        },
        content: node.content.map(blockToPm),
      }
    case 'table':
      return {
        type: 'table',
        attrs: { caption: node.caption ?? null, id: node.id ?? null, label: node.label ?? null, rules: node.rules ?? null },
        content: node.rows.map((row, i) => ({
          type: 'tableRow',
          content: row.cells.map((cell, ci) => {
            // La alineación por columna del AST se aplica a cada celda (así se ve).
            const a = node.align?.[ci]
            return {
              type: node.header && i === 0 ? 'tableHeader' : 'tableCell',
              attrs: { align: a && a !== 'left' ? a : null },
              content:
                cell.content.length > 0
                  ? [{ type: 'paragraph', content: inlinesToPm(cell.content) }]
                  : [{ type: 'paragraph' }],
            }
          }),
        })),
      }
    case 'figure':
      return {
        type: 'figure',
        attrs: {
          items: node.items,
          caption: node.caption ?? null,
          id: node.id ?? null,
          label: node.label ?? null,
        },
      }
    case 'codeBlock':
      return {
        type: 'codeBlock',
        attrs: { language: node.language ?? null },
        content: node.code ? [{ type: 'text', text: node.code }] : [],
      }
    case 'callout':
      return {
        type: 'callout',
        attrs: { variant: node.variant, title: node.title ?? null },
        content: node.content.map(blockToPm),
      }
    case 'include':
      return { type: 'include', attrs: { target: node.target } }
    case 'rawLatex':
      return { type: 'rawLatex', attrs: { latex: node.latex } }
    case 'slide':
      // Presentación (ME-23): nodo estructural. La UI del editor visual es fase futura; por ahora
      // round-trippea a nivel AST↔JSON (el `.mtex` conserva las slides aunque no se editen aún).
      return { type: 'slide', attrs: { title: node.title ?? null, reveal: node.reveal ?? false }, content: node.content.map(blockToPm) }
    case 'posterBlock':
      return { type: 'posterBlock', attrs: { title: node.title ?? null, column: node.column ?? null }, content: node.content.map(blockToPm) }
    case 'cvEntry':
      return {
        type: 'cvEntry',
        attrs: { period: node.period ?? null, role: node.role ?? null, org: node.org ?? null, place: node.place ?? null, detail: node.detail ?? null },
      }
    case 'examQuestion':
      // La solución es un sub-bloque editable (`examSolution`) al final de la pregunta.
      return {
        type: 'examQuestion',
        attrs: { points: node.points ?? null },
        content: [
          ...node.content.map(blockToPm),
          ...(node.solution && node.solution.length > 0
            ? [{ type: 'examSolution', content: node.solution.map(blockToPm) }]
            : []),
        ],
      }
    case 'columns':
      return {
        type: 'columns',
        content: node.columns.map((col) => ({ type: 'column', attrs: { ratio: col.ratio ?? null }, content: col.content.map(blockToPm) })),
      }
  }
}

function itemToPm(item: ListItemNode): PmNode {
  return { type: 'listItem', content: item.content.map(blockToPm) }
}

/** AST Matex → documento de TipTap (para inicializar el editor). */
export function astToTiptap(doc: MatexDoc): PmNode {
  return { type: 'doc', content: doc.content.map(blockToPm) }
}

// ── TipTap → AST ────────────────────────────────────────────────────────────

function clampLevel(value: unknown): 1 | 2 | 3 {
  const n = Number(value)
  if (n >= 3) return 3
  if (n === 2) return 2
  return 1
}

function pmToInline(node: PmNode): InlineNode | null {
  if (node.type === 'mathInline') return { type: 'mathInline', tex: String(node.attrs?.tex ?? '') }
  if (node.type === 'ref') return { type: 'ref', target: String(node.attrs?.target ?? '') }
  if (node.type === 'cite') {
    const keys = Array.isArray(node.attrs?.keys) ? node.attrs.keys.map((k) => String(k)) : []
    const style = node.attrs?.style === 'textual' ? ('textual' as const) : node.attrs?.style === 'parenthetical' ? ('parenthetical' as const) : undefined
    return { type: 'cite', keys, ...(style ? { style } : {}) }
  }
  if (node.type === 'footnote') return { type: 'footnote', text: String(node.attrs?.text ?? '') }
  if (node.type === 'text') {
    const marks = (node.marks ?? [])
      .map((m) => PM_TO_MARK[m.type])
      .filter((m): m is Mark => m != null)
    return marks.length > 0 ? { type: 'text', text: node.text ?? '', marks } : { type: 'text', text: node.text ?? '' }
  }
  return null
}

function pmToItem(node: PmNode): ListItemNode | null {
  if (node.type !== 'listItem') return null
  return { type: 'listItem', content: pmBlocks(node.content) }
}

function pmToBlock(node: PmNode): BlockNode | null {
  switch (node.type) {
    case 'part': {
      const id = strOrUndef(node.attrs?.id)
      const label = strOrUndef(node.attrs?.label)
      return {
        type: 'part',
        content: pmInlines(node.content),
        ...(id ? { id } : {}),
        ...(label ? { label } : {}),
      }
    }
    case 'heading': {
      const id = strOrUndef(node.attrs?.id)
      const label = strOrUndef(node.attrs?.label)
      return {
        type: 'heading',
        level: clampLevel(node.attrs?.level),
        content: pmInlines(node.content),
        ...(id ? { id } : {}),
        ...(label ? { label } : {}),
      }
    }
    case 'paragraph':
      return { type: 'paragraph', content: pmInlines(node.content) }
    case 'bulletList':
      return { type: 'bulletList', items: (node.content ?? []).map(pmToItem).filter((i): i is ListItemNode => i != null) }
    case 'orderedList':
      return { type: 'orderedList', items: (node.content ?? []).map(pmToItem).filter((i): i is ListItemNode => i != null) }
    case 'mathDisplay': {
      // `aligned` default true → se omite; solo persistimos `aligned:false` (centrado).
      const aligned = node.attrs?.aligned === false ? { aligned: false as const } : {}
      return { type: 'mathDisplay', ...aligned, rows: normalizeRows(node.attrs?.rows) }
    }
    case 'derivation': {
      const title = strOrUndef(node.attrs?.title)
      const id = strOrUndef(node.attrs?.id)
      const label = strOrUndef(node.attrs?.label)
      const steps = (Array.isArray(node.attrs?.steps) ? node.attrs.steps : [])
        .map((s) => {
          const so = (s ?? {}) as Record<string, unknown>
          const tex = typeof so.tex === 'string' ? so.tex : ''
          const note = strOrUndef(so.note)
          return { tex, ...(note ? { note } : {}), ...(so.boxed === true ? { boxed: true } : {}) }
        })
      return { type: 'derivation', steps, ...(title ? { title } : {}), ...(id ? { id } : {}), ...(label ? { label } : {}) }
    }
    case 'reasoning': {
      const title = strOrUndef(node.attrs?.title)
      const id = strOrUndef(node.attrs?.id)
      const label = strOrUndef(node.attrs?.label)
      const rows = (node.content ?? [])
        .filter((r) => r.type === 'reasoningRow')
        .map((r) => {
          const cells = (r.content ?? []).filter((c) => c.type === 'reasoningCell')
          return {
            left: pmBlocks(cells[0]?.content),
            right: pmBlocks(cells[1]?.content),
            ...(r.attrs?.boxed === true ? { boxed: true } : {}),
          }
        })
      return { type: 'reasoning', rows, ...(title ? { title } : {}), ...(id ? { id } : {}), ...(label ? { label } : {}) }
    }
    case 'theorem': {
      const title = strOrUndef(node.attrs?.title)
      const id = strOrUndef(node.attrs?.id)
      const label = strOrUndef(node.attrs?.label)
      const proves = strOrUndef(node.attrs?.proves)
      return {
        type: 'theorem',
        variant: variantOrDefault(node.attrs?.variant),
        ...(title ? { title } : {}),
        ...(id ? { id } : {}),
        ...(label ? { label } : {}),
        ...(proves ? { proves } : {}),
        content: pmBlocks(node.content),
      }
    }
    case 'table': {
      const rows = (node.content ?? []).filter((r) => r.type === 'tableRow')
      const firstCells = rows[0]?.content ?? []
      const header = firstCells.length > 0 && firstCells.every((c) => c.type === 'tableHeader')
      const astRows: TableRowNode[] = rows.map((r) => ({
        type: 'tableRow',
        cells: (r.content ?? []).map((c) => ({ type: 'tableCell', content: pmCellInlines(c) })),
      }))
      // Alineación por columna = la de la primera celda con align en esa columna.
      const ncol = rows.reduce((m, r) => Math.max(m, r.content?.length ?? 0), 0)
      const alignArr: TableAlign[] = Array.from({ length: ncol }, (_, ci) => columnAlign(rows, ci))
      const align = alignArr.every((a) => a === 'left') ? undefined : alignArr
      const rules = node.attrs?.rules === 'none' ? ('none' as const) : undefined
      const caption = strOrUndef(node.attrs?.caption)
      const id = strOrUndef(node.attrs?.id)
      const label = strOrUndef(node.attrs?.label)
      return {
        type: 'table',
        rows: astRows,
        ...(header ? { header: true } : {}),
        ...(align ? { align } : {}),
        ...(rules ? { rules } : {}),
        ...(caption ? { caption } : {}),
        ...(id ? { id } : {}),
        ...(label ? { label } : {}),
      }
    }
    case 'figure': {
      const caption = strOrUndef(node.attrs?.caption)
      const id = strOrUndef(node.attrs?.id)
      const label = strOrUndef(node.attrs?.label)
      return {
        type: 'figure',
        items: normalizeFigureItems(node.attrs?.items),
        ...(caption ? { caption } : {}),
        ...(id ? { id } : {}),
        ...(label ? { label } : {}),
      }
    }
    case 'codeBlock': {
      const code = (node.content ?? []).map((c) => c.text ?? '').join('')
      const language = strOrUndef(node.attrs?.language)
      return { type: 'codeBlock', code, ...(language ? { language } : {}) }
    }
    case 'callout': {
      const v = node.attrs?.variant
      const variant = v === 'tip' || v === 'warning' || v === 'important' ? v : 'note'
      const title = strOrUndef(node.attrs?.title)
      return { type: 'callout', variant, ...(title ? { title } : {}), content: pmBlocks(node.content) }
    }
    case 'include':
      return { type: 'include', target: String(node.attrs?.target ?? '') }
    case 'rawLatex':
      return { type: 'rawLatex', latex: String(node.attrs?.latex ?? '') }
    case 'slide': {
      const title = strOrUndef(node.attrs?.title)
      return { type: 'slide', ...(title ? { title } : {}), ...(node.attrs?.reveal === true ? { reveal: true } : {}), content: pmBlocks(node.content) }
    }
    case 'posterBlock': {
      const title = strOrUndef(node.attrs?.title)
      const col = numOrUndef(node.attrs?.column)
      return { type: 'posterBlock', ...(title ? { title } : {}), ...(col != null ? { column: col } : {}), content: pmBlocks(node.content) }
    }
    case 'cvEntry': {
      const f = (k: string): string | undefined => strOrUndef(node.attrs?.[k])
      return {
        type: 'cvEntry',
        ...(f('period') ? { period: f('period')! } : {}),
        ...(f('role') ? { role: f('role')! } : {}),
        ...(f('org') ? { org: f('org')! } : {}),
        ...(f('place') ? { place: f('place')! } : {}),
        ...(f('detail') ? { detail: f('detail')! } : {}),
      }
    }
    case 'examQuestion': {
      const pts = numOrUndef(node.attrs?.points)
      const children = node.content ?? []
      const solutionNode = children.find((child) => child.type === 'examSolution')
      // Compat: documentos editados antes de que la solución fuera sub-bloque la traían como atributo.
      const legacy = Array.isArray(node.attrs?.solution) ? (node.attrs.solution as BlockNode[]) : undefined
      const sol = solutionNode ? pmBlocks(solutionNode.content) : legacy
      return {
        type: 'examQuestion',
        ...(pts != null ? { points: pts } : {}),
        ...(sol && sol.length > 0 ? { solution: sol } : {}),
        content: pmBlocks(children.filter((child) => child.type !== 'examSolution')),
      }
    }
    case 'columns':
      return {
        type: 'columns',
        columns: (node.content ?? []).map((col) => {
          const ratio = numOrUndef(col.attrs?.ratio)
          return { ...(ratio != null ? { ratio } : {}), content: pmBlocks(col.content) }
        }),
      }
    default:
      return null // nodos no soportados se ignoran (el schema los evita)
  }
}

/** Normaliza el attr `rows` de una fórmula en bloque a `EquationRow[]` (mínimo 1 fila). */
function normalizeRows(value: unknown): EquationRow[] {
  if (!Array.isArray(value) || value.length === 0) return [{ tex: '' }]
  return value.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>
    const row: EquationRow = { tex: String(o.tex ?? '') }
    if (o.numbered === true) row.numbered = true
    if (typeof o.id === 'string' && o.id) row.id = o.id
    if (typeof o.label === 'string' && o.label) row.label = o.label
    return row
  })
}

/** Número finito o `undefined`. */
function numOrUndef(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Normaliza la `spec` de un gráfico (funciones, dominio, opciones). */
function normalizePlotSpec(value: unknown): PlotSpec {
  const o = (value ?? {}) as Record<string, unknown>
  const functions = Array.isArray(o.functions)
    ? o.functions.map((f) => {
        const fo = (f ?? {}) as Record<string, unknown>
        const legend = strOrUndef(fo.legend)
        const color = strOrUndef(fo.color)
        const style = lineStyle(fo.style)
        const width = lineWidth(fo.width)
        const role = plotRole(fo.role)
        const fd = Array.isArray(fo.domain) ? fo.domain : null
        const d0 = fd ? numOrUndef(fd[0]) : undefined
        const d1 = fd ? numOrUndef(fd[1]) : undefined
        const pieces = Array.isArray(fo.pieces)
          ? fo.pieces.map((p) => {
              const po = (p ?? {}) as Record<string, unknown>
              return { expr: String(po.expr ?? ''), from: numOrUndef(po.from) ?? 0, to: numOrUndef(po.to) ?? 1 }
            })
          : undefined
        const fdo = (fo.fromData ?? null) as Record<string, unknown> | null
        const fromMethod = fdo ? interpMethod(fdo.method) : undefined
        const fromData =
          fdo && fromMethod != null && numOrUndef(fdo.series) != null
            ? { series: numOrUndef(fdo.series)!, method: fromMethod, ...(numOrUndef(fdo.degree) != null ? { degree: numOrUndef(fdo.degree)! } : {}) }
            : undefined
        const shade: 'above' | 'below' | undefined = fo.shade === 'above' ? 'above' : fo.shade === 'below' ? 'below' : undefined
        return {
          expr: String(fo.expr ?? ''),
          ...(fromData ? { fromData } : {}),
          ...(legend ? { legend } : {}),
          ...(fo.disabled === true ? { disabled: true } : {}),
          ...(d0 != null && d1 != null ? { domain: [d0, d1] as [number, number] } : {}),
          ...(color ? { color } : {}),
          ...(style ? { style } : {}),
          ...(width ? { width } : {}),
          ...(role ? { role } : {}),
          ...(pieces && pieces.length > 0 ? { pieces } : {}),
          ...(fo.markJumps === true ? { markJumps: true } : {}),
          ...(fo.markRoots === true ? { markRoots: true } : {}),
          ...(fo.markExtrema === true ? { markExtrema: true } : {}),
          ...(fo.markInflections === true ? { markInflections: true } : {}),
          ...(fo.markAsymptotes === true ? { markAsymptotes: true } : {}),
          ...(fo.markYIntercept === true ? { markYIntercept: true } : {}),
          ...(fo.featureCoords === true ? { featureCoords: true } : {}),
          ...(fo.inverse === true ? { inverse: true } : {}),
          ...(fo.endLabel === true ? { endLabel: true } : {}),
          ...(shade ? { shade } : {}),
        }
      })
    : []
  const dom = Array.isArray(o.domain) ? o.domain : []
  const domain: [number, number] = [numOrUndef(dom[0]) ?? -5, numOrUndef(dom[1]) ?? 5]
  const rng = Array.isArray(o.range) ? o.range : null
  const r0 = rng ? numOrUndef(rng[0]) : undefined
  const r1 = rng ? numOrUndef(rng[1]) : undefined
  const xlabel = strOrUndef(o.xlabel)
  const ylabel = strOrUndef(o.ylabel)
  const areas = Array.isArray(o.areas)
    ? o.areas.map((a) => {
        const ao = (a ?? {}) as Record<string, unknown>
        const toFn = numOrUndef(ao.toFn)
        const pattern = AREA_PATTERNS.includes(ao.pattern as AreaPattern) ? (ao.pattern as AreaPattern) : undefined
        const fromExpr = strOrUndef(ao.fromExpr)
        const toExpr = strOrUndef(ao.toExpr)
        const riemann: 'left' | 'right' | 'mid' | 'trapezoid' | undefined =
          ao.riemann === 'left' ? 'left' : ao.riemann === 'right' ? 'right' : ao.riemann === 'mid' ? 'mid' : ao.riemann === 'trapezoid' ? 'trapezoid' : undefined
        const riemannN = numOrUndef(ao.riemannN)
        const labelPos: 'above' | 'below' | undefined = ao.labelPos === 'above' ? 'above' : ao.labelPos === 'below' ? 'below' : undefined
        return {
          fn: numOrUndef(ao.fn) ?? 0,
          from: numOrUndef(ao.from) ?? 0,
          to: numOrUndef(ao.to) ?? 1,
          ...(toFn != null ? { toFn } : {}),
          ...(pattern && pattern !== 'solid' ? { pattern } : {}),
          ...(ao.showValue === true ? { showValue: true } : {}),
          ...(fromExpr ? { fromExpr } : {}),
          ...(toExpr ? { toExpr } : {}),
          ...(riemann ? { riemann } : {}),
          ...(riemann && riemannN != null ? { riemannN } : {}),
          ...(labelPos ? { labelPos } : {}),
        }
      })
    : undefined
  const points = Array.isArray(o.points)
    ? o.points.map((p) => {
        const po = (p ?? {}) as Record<string, unknown>
        const label = strOrUndef(po.label)
        const fn = numOrUndef(po.fn)
        const xExpr = strOrUndef(po.xExpr)
        return {
          x: numOrUndef(po.x) ?? 0,
          y: numOrUndef(po.y) ?? 0,
          ...(label ? { label } : {}),
          ...(po.open === true ? { open: true } : {}),
          ...(fn != null ? { fn: Math.round(fn) } : {}),
          ...(xExpr ? { xExpr } : {}),
        }
      })
    : undefined
  const vlines = Array.isArray(o.vlines)
    ? o.vlines.map((v) => {
        const vo = (v ?? {}) as Record<string, unknown>
        const label = strOrUndef(vo.label)
        const xExpr = strOrUndef(vo.xExpr)
        return { x: numOrUndef(vo.x) ?? 0, ...(label ? { label } : {}), ...(xExpr ? { xExpr } : {}) }
      })
    : undefined
  const hlines = Array.isArray(o.hlines)
    ? o.hlines.map((h) => {
        const ho = (h ?? {}) as Record<string, unknown>
        const label = strOrUndef(ho.label)
        const yExpr = strOrUndef(ho.yExpr)
        return { y: numOrUndef(ho.y) ?? 0, ...(label ? { label } : {}), ...(yExpr ? { yExpr } : {}) }
      })
    : undefined
  const tangents = Array.isArray(o.tangents)
    ? o.tangents.map((t) => {
        const to = (t ?? {}) as Record<string, unknown>
        const label = strOrUndef(to.label)
        const atExpr = strOrUndef(to.atExpr)
        const labelPos: 'above' | 'below' | undefined = to.labelPos === 'above' ? 'above' : to.labelPos === 'below' ? 'below' : undefined
        return { fn: numOrUndef(to.fn) ?? 0, at: numOrUndef(to.at) ?? 0, ...(label ? { label } : {}), ...(to.showValue === true ? { showValue: true } : {}), ...(atExpr ? { atExpr } : {}), ...(labelPos ? { labelPos } : {}) }
      })
    : undefined
  const data = Array.isArray(o.data)
    ? o.data.map((s) => {
        const so = (s ?? {}) as Record<string, unknown>
        const legend = strOrUndef(so.legend)
        const color = strOrUndef(so.color)
        const points = (Array.isArray(so.points) ? so.points : [])
          .map((p) => {
            const arr = Array.isArray(p) ? p : []
            const x = numOrUndef(arr[0])
            const y = numOrUndef(arr[1])
            return x != null && y != null ? ([x, y] as [number, number]) : null
          })
          .filter((p): p is [number, number] => p != null)
        const interp = interpMethod(so.interpolate)
        const deg = numOrUndef(so.interpDegree)
        return {
          points,
          ...(legend ? { legend } : {}),
          ...(color ? { color } : {}),
          ...(so.line === true ? { line: true } : {}),
          ...(lineStyle(so.style) ? { style: lineStyle(so.style)! } : {}),
          ...(lineWidth(so.width) ? { width: lineWidth(so.width)! } : {}),
          ...(interp ? { interpolate: interp } : {}),
          ...(interp === 'regression' && deg != null ? { interpDegree: deg } : {}),
          ...((interp === 'polyline' || interp === 'smooth') && so.closed === true ? { closed: true } : {}),
          ...(so.open === true ? { open: true } : {}),
          ...(so.disabled === true ? { disabled: true } : {}),
        }
      })
    : undefined
  const parametrics = Array.isArray(o.parametrics)
    ? o.parametrics.map((p) => {
        const po = (p ?? {}) as Record<string, unknown>
        const legend = strOrUndef(po.legend)
        const color = strOrUndef(po.color)
        return {
          x: String(po.x ?? ''),
          y: String(po.y ?? ''),
          tmin: numOrUndef(po.tmin) ?? 0,
          tmax: numOrUndef(po.tmax) ?? 6.283,
          ...(legend ? { legend } : {}),
          ...(color ? { color } : {}),
          ...(lineStyle(po.style) ? { style: lineStyle(po.style)! } : {}),
          ...(lineWidth(po.width) ? { width: lineWidth(po.width)! } : {}),
          ...(po.disabled === true ? { disabled: true } : {}),
        }
      })
    : undefined
  const polars = Array.isArray(o.polars)
    ? o.polars.map((p) => {
        const po = (p ?? {}) as Record<string, unknown>
        const legend = strOrUndef(po.legend)
        const color = strOrUndef(po.color)
        return {
          r: String(po.r ?? ''),
          tmin: numOrUndef(po.tmin) ?? 0,
          tmax: numOrUndef(po.tmax) ?? 6.283,
          ...(legend ? { legend } : {}),
          ...(color ? { color } : {}),
          ...(lineStyle(po.style) ? { style: lineStyle(po.style)! } : {}),
          ...(lineWidth(po.width) ? { width: lineWidth(po.width)! } : {}),
          ...(po.disabled === true ? { disabled: true } : {}),
        }
      })
    : undefined
  const implicits = Array.isArray(o.implicits)
    ? o.implicits
        .map((im) => {
          const io = (im ?? {}) as Record<string, unknown>
          const equation = strOrUndef(io.equation)
          if (!equation) return null
          const legend = strOrUndef(io.legend)
          const color = strOrUndef(io.color)
          return {
            equation,
            ...(legend ? { legend } : {}),
            ...(color ? { color } : {}),
            ...(lineStyle(io.style) ? { style: lineStyle(io.style)! } : {}),
            ...(lineWidth(io.width) ? { width: lineWidth(io.width)! } : {}),
            ...(io.disabled === true ? { disabled: true } : {}),
          }
        })
        .filter((im): im is NonNullable<typeof im> => im != null)
    : undefined
  const conics = Array.isArray(o.conics)
    ? o.conics
        .map((cn) => {
          const co = (cn ?? {}) as Record<string, unknown>
          const kind: 'circle' | 'ellipse' | 'parabola' | 'hyperbola' | null =
            co.kind === 'circle' ? 'circle' : co.kind === 'ellipse' ? 'ellipse' : co.kind === 'parabola' ? 'parabola' : co.kind === 'hyperbola' ? 'hyperbola' : null
          if (!kind) return null
          const opens: 'up' | 'down' | 'left' | 'right' | undefined =
            co.opens === 'up' ? 'up' : co.opens === 'down' ? 'down' : co.opens === 'left' ? 'left' : co.opens === 'right' ? 'right' : undefined
          const num = (k: string) => numOrUndef(co[k])
          const legend = strOrUndef(co.legend)
          const color = strOrUndef(co.color)
          return {
            kind,
            cx: num('cx') ?? 0,
            cy: num('cy') ?? 0,
            ...(num('r') != null ? { r: num('r')! } : {}),
            ...(num('a') != null ? { a: num('a')! } : {}),
            ...(num('b') != null ? { b: num('b')! } : {}),
            ...(num('p') != null ? { p: num('p')! } : {}),
            ...(opens ? { opens } : {}),
            ...(num('angle') != null ? { angle: num('angle')! } : {}),
            ...(legend ? { legend } : {}),
            ...(color ? { color } : {}),
            ...(lineStyle(co.style) ? { style: lineStyle(co.style)! } : {}),
            ...(lineWidth(co.width) ? { width: lineWidth(co.width)! } : {}),
            ...(co.disabled === true ? { disabled: true } : {}),
          }
        })
        .filter((cn): cn is NonNullable<typeof cn> => cn != null)
    : undefined
  const intersections = Array.isArray(o.intersections)
    ? o.intersections
        .map((it) => {
          const io = (it ?? {}) as Record<string, unknown>
          const a = normCurveRef(io.a)
          const b = normCurveRef(io.b)
          if (!a || !b) return null
          const label = strOrUndef(io.label)
          const color = strOrUndef(io.color)
          return {
            a,
            b,
            ...(label ? { label } : {}),
            ...(color ? { color } : {}),
            ...(io.showCoords === true ? { showCoords: true } : {}),
            ...(io.disabled === true ? { disabled: true } : {}),
          }
        })
        .filter((it): it is NonNullable<typeof it> => it != null)
    : undefined
  const legendPos =
    o.legendPos === 'top-left' || o.legendPos === 'top-right' || o.legendPos === 'bottom-left' ||
    o.legendPos === 'bottom-right' || o.legendPos === 'outside-right'
      ? o.legendPos
      : undefined
  const title = strOrUndef(o.title)
  const samples = numOrUndef(o.samples)
  const texts = Array.isArray(o.texts)
    ? o.texts
        .map((t) => {
          const to = (t ?? {}) as Record<string, unknown>
          const text = strOrUndef(to.text)
          return text != null ? { x: numOrUndef(to.x) ?? 0, y: numOrUndef(to.y) ?? 0, text } : null
        })
        .filter((t): t is { x: number; y: number; text: string } => t != null)
    : undefined
  const parameters = Array.isArray(o.parameters)
    ? o.parameters
        .map((p) => {
          const po = (p ?? {}) as Record<string, unknown>
          const name = strOrUndef(po.name)
          const value = numOrUndef(po.value)
          if (name == null || value == null) return null
          const min = numOrUndef(po.min)
          const max = numOrUndef(po.max)
          const step = numOrUndef(po.step)
          return { name, value, ...(min != null ? { min } : {}), ...(max != null ? { max } : {}), ...(step != null ? { step } : {}) }
        })
        .filter((p): p is { name: string; value: number; min?: number; max?: number; step?: number } => p != null)
    : undefined
  return {
    functions,
    domain,
    ...(r0 != null && r1 != null ? { range: [r0, r1] as [number, number] } : {}),
    ...(xlabel ? { xlabel } : {}),
    ...(ylabel ? { ylabel } : {}),
    ...(o.grid === true ? { grid: true } : {}),
    ...(o.legend === true ? { legend: true } : {}),
    ...(o.featureLegend === true ? { featureLegend: true } : {}),
    ...(title ? { title } : {}),
    ...(samples != null ? { samples } : {}),
    ...(o.piTicks === true ? { piTicks: true } : {}),
    ...(o.hideTicks === true ? { hideTicks: true } : {}),
    ...(legendPos ? { legendPos } : {}),
    ...(o.syntax === 'ascii' || o.syntax === 'latex' ? { syntax: o.syntax } : {}),
    ...(o.equalAxes === true ? { equalAxes: true } : {}),
    ...(areas && areas.length > 0 ? { areas } : {}),
    ...(points && points.length > 0 ? { points } : {}),
    ...(vlines && vlines.length > 0 ? { vlines } : {}),
    ...(hlines && hlines.length > 0 ? { hlines } : {}),
    ...(tangents && tangents.length > 0 ? { tangents } : {}),
    ...(data && data.length > 0 ? { data } : {}),
    ...(parametrics && parametrics.length > 0 ? { parametrics } : {}),
    ...(polars && polars.length > 0 ? { polars } : {}),
    ...(implicits && implicits.length > 0 ? { implicits } : {}),
    ...(conics && conics.length > 0 ? { conics } : {}),
    ...(intersections && intersections.length > 0 ? { intersections } : {}),
    ...(texts && texts.length > 0 ? { texts } : {}),
    ...(parameters && parameters.length > 0 ? { parameters } : {}),
  }
}

/** Normaliza el attr `items` de una figura (imagen | gráfico), con sus opcionales. */
function normalizeFigureItems(value: unknown): FigureItem[] {
  if (!Array.isArray(value)) return []
  return value.map((raw): FigureItem => {
    const o = (raw ?? {}) as Record<string, unknown>
    const width = numOrUndef(o.width)
    const subcaption = strOrUndef(o.subcaption)
    const id = strOrUndef(o.id)
    const label = strOrUndef(o.label)
    const common = {
      ...(width != null ? { width } : {}),
      ...(subcaption ? { subcaption } : {}),
      ...(id ? { id } : {}),
      ...(label ? { label } : {}),
    }
    if (o.kind === 'plot') return { kind: 'plot', spec: normalizePlotSpec(o.spec), ...common }
    if (o.kind === 'chart') return { kind: 'chart', spec: normalizeChartSpec(o.spec), ...common }
    if (o.kind === 'distribution') return { kind: 'distribution', spec: normalizeDistSpec(o.spec), ...common }
    if (o.kind === 'diagram') return { kind: 'diagram', spec: normalizeDiagramSpec(o.spec), ...common }
    if (o.kind === 'tree') return { kind: 'tree', spec: normalizeTreeSpec(o.spec), ...common }
    return { kind: 'image', src: String(o.src ?? ''), ...common }
  })
}

/** Normaliza la `spec` de un diagrama conmutativo (nodos en grilla + aristas). */
function normalizeDiagramSpec(value: unknown): DiagramSpec {
  const o = (value ?? {}) as Record<string, unknown>
  const nodes = Array.isArray(o.nodes)
    ? o.nodes.map((n) => {
        const no = (n ?? {}) as Record<string, unknown>
        return { id: String(no.id ?? ''), label: String(no.label ?? ''), row: Math.round(numOrUndef(no.row) ?? 0), col: Math.round(numOrUndef(no.col) ?? 0) }
      })
    : []
  const TIPS: readonly DiagramTip[] = ['arrow', 'mono', 'epi', 'mapsto']
  const STYLES: readonly DiagramEdgeStyle[] = ['solid', 'dashed', 'dotted']
  const edges = Array.isArray(o.edges)
    ? o.edges.map((e) => {
        const eo = (e ?? {}) as Record<string, unknown>
        const label = strOrUndef(eo.label)
        const tip = (TIPS as readonly string[]).includes(String(eo.tip)) ? (eo.tip as DiagramTip) : undefined
        const style = (STYLES as readonly string[]).includes(String(eo.style)) ? (eo.style as DiagramEdgeStyle) : undefined
        const bend = eo.bend === 'left' || eo.bend === 'right' ? (eo.bend as 'left' | 'right') : undefined
        return {
          from: String(eo.from ?? ''),
          to: String(eo.to ?? ''),
          ...(label ? { label } : {}),
          ...(tip ? { tip } : {}),
          ...(style ? { style } : {}),
          ...(bend ? { bend } : {}),
        }
      })
    : []
  const title = strOrUndef(o.title)
  return { form: 'commutative', nodes, edges, ...(title ? { title } : {}) }
}

/** Normaliza la `spec` de un árbol (nodos con padre). */
function normalizeTreeSpec(value: unknown): TreeSpec {
  const o = (value ?? {}) as Record<string, unknown>
  const nodes = Array.isArray(o.nodes)
    ? o.nodes.map((n) => {
        const no = (n ?? {}) as Record<string, unknown>
        const parent = strOrUndef(no.parent)
        return { id: String(no.id ?? ''), label: String(no.label ?? ''), ...(parent ? { parent } : {}) }
      })
    : []
  const title = strOrUndef(o.title)
  return { form: 'tree', nodes, ...(title ? { title } : {}) }
}

/** Normaliza la `spec` de una distribución (forma, muestras crudas por serie). */
function normalizeDistSpec(value: unknown): DistSpec {
  const o = (value ?? {}) as Record<string, unknown>
  const form: DistForm = o.form === 'boxplot' ? 'boxplot' : 'histogram'
  const data = Array.isArray(o.data)
    ? o.data.map((s) => {
        const so = (s ?? {}) as Record<string, unknown>
        const label = strOrUndef(so.label)
        const color = strOrUndef(so.color)
        const samples = (Array.isArray(so.samples) ? so.samples : []).map((v) => numOrUndef(v)).filter((v): v is number => v != null)
        return { samples, ...(label ? { label } : {}), ...(color ? { color } : {}) }
      })
    : []
  const bins = numOrUndef(o.bins)
  const title = strOrUndef(o.title)
  const xlabel = strOrUndef(o.xlabel)
  const ylabel = strOrUndef(o.ylabel)
  return {
    form,
    data,
    ...(bins != null ? { bins: Math.round(bins) } : {}),
    ...(title ? { title } : {}),
    ...(xlabel ? { xlabel } : {}),
    ...(ylabel ? { ylabel } : {}),
    ...(o.legend === true ? { legend: true } : {}),
  }
}

/** Normaliza la `spec` de un gráfico categórico (forma, categorías, series). */
function normalizeChartSpec(value: unknown): ChartSpec {
  const o = (value ?? {}) as Record<string, unknown>
  const FORMS: readonly ChartForm[] = ['bar', 'stackedBar', 'hbar', 'line', 'pie']
  const form: ChartForm = (FORMS as readonly string[]).includes(String(o.form)) ? (o.form as ChartForm) : 'bar'
  const categories = Array.isArray(o.categories) ? o.categories.map((c) => String(c)) : []
  const series = Array.isArray(o.series)
    ? o.series.map((s) => {
        const so = (s ?? {}) as Record<string, unknown>
        const label = strOrUndef(so.label)
        const color = strOrUndef(so.color)
        const values = (Array.isArray(so.values) ? so.values : []).map((v) => numOrUndef(v) ?? 0)
        return { values, ...(label ? { label } : {}), ...(color ? { color } : {}) }
      })
    : []
  const title = strOrUndef(o.title)
  const ylabel = strOrUndef(o.ylabel)
  return {
    form,
    categories,
    series,
    ...(title ? { title } : {}),
    ...(o.legend === true ? { legend: true } : {}),
    ...(ylabel ? { ylabel } : {}),
  }
}

/** Inline de una celda TipTap = inline de su primer párrafo (las celdas son inline en el AST). */
function pmCellInlines(cell: PmNode): InlineNode[] {
  const para = (cell.content ?? []).find((n) => n.type === 'paragraph')
  return pmInlines(para?.content)
}

/** Normaliza una referencia a curva `{ kind, i }` (para intersecciones), o `null` si inválida. */
function normCurveRef(v: unknown): CurveRef | null {
  const o = (v ?? {}) as Record<string, unknown>
  const kind = o.kind
  if (kind === 'xaxis' || kind === 'yaxis') return { kind, i: 0 } // ejes: `i` no aplica
  if (kind !== 'function' && kind !== 'implicit' && kind !== 'parametric' && kind !== 'polar') return null
  const i = numOrUndef(o.i)
  return i == null ? null : { kind, i: Math.round(i) }
}

const AREA_PATTERNS: readonly AreaPattern[] = ['solid', 'lines', 'lines-alt', 'crosshatch', 'dots', 'grid', 'horizontal', 'vertical']

const TABLE_ALIGNS: readonly TableAlign[] = ['left', 'center', 'right']

/** Alineación de una columna = la primera celda (por fila) con `align` válido, si no `left`. */
function columnAlign(rows: PmNode[], ci: number): TableAlign {
  for (const row of rows) {
    const a = row.content?.[ci]?.attrs?.align
    if (typeof a === 'string' && (TABLE_ALIGNS as readonly string[]).includes(a)) return a as TableAlign
  }
  return 'left'
}

function pmInlines(nodes: PmNode[] | undefined): InlineNode[] {
  return (nodes ?? []).map(pmToInline).filter((n): n is InlineNode => n != null)
}
function pmBlocks(nodes: PmNode[] | undefined): BlockNode[] {
  return (nodes ?? []).map(pmToBlock).filter((n): n is BlockNode => n != null)
}

/** Documento de TipTap → AST Matex (la fuente de verdad tras cada cambio). */
export function tiptapToAst(doc: PmNode): MatexDoc {
  return { type: 'doc', version: MATEX_AST_VERSION, content: pmBlocks(doc.content) }
}

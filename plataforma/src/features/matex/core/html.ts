// Import relativo (no el alias `@/`) a propósito: mantiene `matex-core` portable /
// headless, igual que `compile.ts`.
import katex from 'katex'
import { equationPlan } from './equation'
import { matexKatexMacros } from './macros'
import { plotToSvg, plotDisplayWindow, plotLegendHtml, plotFeatureLegendHtml, type PlotView } from './graphics/relationSvg'
import { chartToSvg } from './graphics/chartSvg'
import { distToSvg } from './graphics/distributionSvg'
import { diagramToSvg } from './graphics/diagramSvg'
import { treeToSvg } from './graphics/treeSvg'
import { PLOT_RUNTIME_JS } from './plotRuntime.generated'
import { distributePosterBlocks, posterColumns } from './poster'
import { createDocNumbering } from './policy/numbering'
import { cvMeta, documentFamily, examMeta, letterMeta, posterMeta } from './family'
import type {
  PlotSpec,
  BlockNode,
  CalloutVariant,
  DerivationNode,
  DocMeta,
  EquationRow,
  FigureItem,
  FigureNode,
  InlineNode,
  ListItemNode,
  MathDisplayNode,
  MatexDoc,
  Mark,
  PosterBlockNode,
  PosterMeta,
  ReasoningNode,
  TableNode,
  TheoremNode,
  TheoremVariant,
} from './ast'

/**
 * **Segundo backend: Matex → HTML** (LE-03). Función pura sobre el mismo AST que
 * `compileToLatex` — *la prueba concreta de la tesis semántica*: un solo modelo, dos
 * salidas de calidad (PDF vía LaTeX, HTML vía este módulo), sin una línea de sintaxis
 * nueva. Es headless: no toca el DOM (devuelve un string), reusa los emisores **SVG**
 * de gráficos (`core/graphics/*Svg`) y lleva la matemática (`tex`, la lingua franca)
 * a **MathML** con KaTeX (`renderToString`, sin DOM, auto-contenido: sin CSS/fuentes
 * externas). El HTML resultante es un documento standalone con estilos embebidos.
 *
 * Escotillas (por diseño, ver LE-02): `rawLatex` no se puede renderizar → aviso;
 * `include` (archivo `.tex` crudo) → aviso. La numeración de refs cruzadas se computa
 * acá (HTML no tiene cleveref/amsthm) — no busca coincidir dígito a dígito con el PDF,
 * sino ser un documento correcto y navegable por sí mismo.
 */

const KATEX_MACROS = matexKatexMacros()

/** Escapa texto para HTML (contenido y atributos). */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Matemática `tex` → MathML (KaTeX SSR, sin DOM ni fuentes externas). */
function renderMath(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, {
      output: 'mathml',
      displayMode: display,
      throwOnError: false,
      macros: { ...KATEX_MACROS },
    })
  } catch {
    // Ante cualquier fallo inesperado, no romper el documento: mostrar el tex crudo.
    return `<code class="mx-math-error">${esc(tex)}</code>`
  }
}

// ─── Numeración y referencias cruzadas ──────────────────────────────────────
// HTML no tiene cleveref/amsthm: numeramos nosotros en orden de documento y
// resolvemos cada `ref` a "figura 1", "Teorema 2", "ecuación (3)", con ancla+link.

interface RefInfo {
  anchor: string
  /** Texto que muestra un `\cref` (p. ej. "figura 1", "Teorema 2", "(3)"). */
  display: string
}

/** Nombre visible por tipo de teorema (estilo amsthm, español). */
const THEOREM_NAME: Record<TheoremVariant, string> = {
  theorem: 'Teorema',
  lemma: 'Lema',
  proposition: 'Proposición',
  corollary: 'Corolario',
  definition: 'Definición',
  example: 'Ejemplo',
  remark: 'Observación',
  proof: 'Demostración',
}

interface HtmlRefs {
  /** Info de numeración de un nodo/fila referenciable (por identidad de objeto). */
  ofNode: Map<object, RefInfo>
  /** Resolución de un `target` de `ref` (por `id`/`label`). */
  byKey: Map<string, RefInfo>
}

/**
 * Pre-pasada: asigna números a lo referenciable (secciones, ecuaciones, teoremas,
 * figuras, tablas) en orden de documento y arma los mapas por identidad y por clave.
 *
 * La **numeración** no se decide acá: la aporta `createDocNumbering()`, la política única
 * compartida con los otros backends (ver `core/policy/numbering.ts`). Este recorrido solo la
 * alimenta en orden de documento y arma los anclas/textos de HTML.
 */
function buildHtmlRefs(doc: MatexDoc): HtmlRefs {
  const ofNode = new Map<object, RefInfo>()
  const byKey = new Map<string, RefInfo>()
  const num = createDocNumbering()

  const register = (node: { id?: string | undefined; label?: string | undefined }, info: RefInfo): void => {
    ofNode.set(node, info)
    const key = node.label ?? node.id
    if (key) byKey.set(key, info)
  }

  const scan = (b: BlockNode): void => {
    switch (b.type) {
      case 'part': {
        const n = num.part()
        register(b, { anchor: `mx-part-${n}`, display: `parte ${n}` })
        break
      }
      case 'heading': {
        const n = num.section(b.level)
        register(b, { anchor: `mx-sec-${n.replace(/\./g, '-')}`, display: `sección ${n}` })
        break
      }
      case 'mathDisplay': {
        const nums = num.equation(b.rows, b.aligned)
        b.rows.forEach((row, i) => {
          const n = nums[i]
          if (n) register(row, { anchor: `mx-eq-${n}`, display: `ecuación (${n})` })
        })
        break
      }
      case 'theorem': {
        const n = num.theorem(b.variant)
        if (n) register(b, { anchor: `mx-thm-${n.replace(/\./g, '-')}`, display: `${THEOREM_NAME[b.variant]} ${n}` })
        b.content.forEach(scan)
        break
      }
      case 'callout':
        b.content.forEach(scan)
        break
      case 'reasoning':
        for (const row of b.rows) {
          row.left.forEach(scan)
          row.right.forEach(scan)
        }
        break
      case 'bulletList':
      case 'orderedList':
        for (const item of b.items) item.content.forEach(scan)
        break
      case 'table': {
        const n = num.table(!!b.caption)
        if (n) register(b, { anchor: `mx-tab-${n}`, display: `tabla ${n}` })
        break
      }
      case 'figure': {
        const n = num.figure(!!b.caption)
        if (n) {
          register(b, { anchor: `mx-fig-${n}`, display: `figura ${n}` })
          // Subfiguras (≥2 partes): cada parte referenciable → "figura 1a".
          if (b.items.length >= 2) {
            b.items.forEach((item, i) => {
              const letter = String.fromCharCode(97 + i)
              register(item, { anchor: `mx-fig-${n}${letter}`, display: `figura ${n}${letter}` })
            })
          }
        }
        break
      }
      case 'paragraph':
      case 'derivation':
      case 'codeBlock':
      case 'include':
      case 'rawLatex':
        break
    }
  }
  doc.content.forEach(scan)
  return { ofNode, byKey }
}

/** Contexto de render: refs + footnotes acumuladas + imágenes disponibles. */
interface Ctx {
  refs: HtmlRefs
  /** Textos de nota al pie en orden de aparición (índice+1 = número). */
  footnotes: string[]
  /** `nombre de archivo → data URI` (el que llama provee los bytes; core es puro). */
  images: Record<string, string>
  /** Contador para ids únicos de widgets interactivos (sliders de gráficos). */
  widgetSeq: { n: number }
  /** Se prende si algún gráfico interactivo necesita el runtime embebido (ME-37); se inyecta 1 vez. */
  needsRuntime: { on: boolean }
  /** Examen: imprimir las soluciones de las preguntas (`meta.exam.showSolutions`). */
  showSolutions?: boolean | undefined
}

// ─── Inline ─────────────────────────────────────────────────────────────────

function applyMarks(inner: string, marks: Mark[] = []): string {
  let out = inner
  if (marks.includes('code')) out = `<code>${out}</code>`
  if (marks.includes('emph')) out = `<em>${out}</em>`
  if (marks.includes('strong')) out = `<strong>${out}</strong>`
  return out
}

function inlineToHtml(nodes: InlineNode[], ctx: Ctx): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
          return applyMarks(esc(n.text), n.marks)
        case 'mathInline':
          return renderMath(n.tex, false)
        case 'ref': {
          const info = ctx.refs.byKey.get(n.target)
          return info ? `<a href="#${info.anchor}" class="mx-ref">${esc(info.display)}</a>` : '<strong class="mx-ref-broken">??</strong>'
        }
        case 'cite': {
          const keys = n.keys.map((k) => k.trim()).filter((k) => k.length > 0)
          if (keys.length === 0) return '<strong class="mx-ref-broken">??</strong>'
          const links = keys.map((k) => `<a href="#mx-bib-${esc(k)}" class="mx-cite">${esc(k)}</a>`).join(', ')
          return n.style === 'textual' ? links : `[${links}]`
        }
        case 'footnote': {
          ctx.footnotes.push(n.text)
          const i = ctx.footnotes.length
          return `<sup class="mx-fnref" id="mx-fnref-${i}"><a href="#mx-fn-${i}">${i}</a></sup>`
        }
      }
    })
    .join('')
}

// ─── Bloques ──────────────────────────────────────────────────────────────────

function anchorAttr(node: object, ctx: Ctx): string {
  const info = ctx.refs.ofNode.get(node)
  return info ? ` id="${info.anchor}"` : ''
}

function partToHtml(node: Extract<BlockNode, { type: 'part' }>, ctx: Ctx): string {
  const info = ctx.refs.ofNode.get(node)
  const num = info ? info.display.replace(/^parte\s+/, '') : ''
  const prefix = num ? `<span class="mx-partnum">Parte ${esc(num)}</span> ` : ''
  return `<h1${anchorAttr(node, ctx)} class="mx-part">${prefix}${inlineToHtml(node.content, ctx)}</h1>`
}

function headingToHtml(node: Extract<BlockNode, { type: 'heading' }>, ctx: Ctx): string {
  const info = ctx.refs.ofNode.get(node)
  const num = info ? info.display.replace(/^sección\s+/, '') : ''
  const tag = `h${Math.min(node.level + 1, 6)}` // h1 lo reserva el título del documento
  const prefix = num ? `<span class="mx-secnum">${esc(num)}</span> ` : ''
  return `<${tag}${anchorAttr(node, ctx)} class="mx-heading">${prefix}${inlineToHtml(node.content, ctx)}</${tag}>`
}

function listToHtml(tag: 'ul' | 'ol', items: ListItemNode[], ctx: Ctx): string {
  const body = items.map((item) => `<li>${blocksToHtml(item.content, ctx)}</li>`).join('\n')
  return `<${tag}>\n${body}\n</${tag}>`
}

/**
 * Fórmula en bloque. `equationPlan` decide (misma política que LaTeX/PDF): 1 fila →
 * display suelto; ≥2 → `aligned`/`gathered`. Las filas numeradas llevan su `(n)` a la
 * derecha con un ancla para poder linkearlas.
 */
function mathDisplayToHtml(node: MathDisplayNode, ctx: Ctx): string {
  const rows = node.rows.filter((r) => r.tex.trim() !== '')
  if (rows.length === 0) return ''
  const plan = equationPlan(node.rows, node.aligned)
  const numFor = (row: EquationRow): string => {
    const info = ctx.refs.ofNode.get(row)
    return info ? `<span class="mx-eqno" id="${info.anchor}">(${info.display.replace(/^\D+\(?|\)$/g, '')})</span>` : ''
  }
  if (!plan.multiline) {
    const row = rows[0]!
    return `<div class="mx-eq">${renderMath(row.tex, true)}${numFor(row)}</div>`
  }
  // Multilínea: un solo bloque MathML con `aligned`/`gathered`; los números van en una
  // columna aparte, fila por fila, para poder anclarlos individualmente.
  const envInner = rows.map((r) => r.tex).join(' \\\\ ')
  const env = plan.env === 'gather' ? 'gathered' : 'aligned'
  const math = renderMath(`\\begin{${env}}${envInner}\\end{${env}}`, true)
  const anyNumbered = rows.some((r) => ctx.refs.ofNode.has(r))
  if (!anyNumbered) return `<div class="mx-eq">${math}</div>`
  const nums = rows.map((r) => `<div class="mx-eqno-row">${numFor(r)}</div>`).join('\n')
  return `<div class="mx-eq mx-eq-multi"><div class="mx-eq-body">${math}</div><div class="mx-eqnos">${nums}</div></div>`
}

/**
 * **Derivación** (paso a paso): grilla de dos columnas (matemática | justificación).
 * Cada paso se envuelve en `aligned` para que KaTeX acepte el `&` de alineación; `boxed`
 * recuadra (sin el `&`, como en LaTeX/PDF). Es estructura, no maquetación — el mismo
 * nodo que el PDF, renderizado nativo en HTML (la prueba de la tesis LE-03).
 */
function derivationToHtml(node: DerivationNode): string {
  const steps = node.steps.filter((s) => s.tex.trim() !== '')
  if (steps.length === 0) return node.title ? `<p class="mx-deriv-title">${esc(node.title)}</p>` : ''
  const rows = steps
    .map((s) => {
      const body = s.boxed ? `\\boxed{${s.tex.replace(/&/g, '')}}` : s.tex
      const math = renderMath(`\\begin{aligned}${body}\\end{aligned}`, true)
      const note = s.note && s.note.trim() ? renderMath(`\\text{${s.note.replace(/&/g, '')}}`, false) : ''
      return `<div class="mx-deriv-step"><div class="mx-deriv-math">${math}</div><div class="mx-deriv-note">${note}</div></div>`
    })
    .join('\n')
  const title = node.title ? `<p class="mx-deriv-title">${esc(node.title)}</p>` : ''
  return `<div class="mx-derivation">${title}<div class="mx-deriv-grid">${rows}</div></div>`
}

/**
 * **Razonamiento a dos columnas** (contenido rico recursivo). Grilla de 2 columnas por
 * fila; cada celda es contenido de bloque arbitrario (párrafos, math, tablas, figuras).
 * `boxed` recuadra la fila. (En LaTeX/PDF esto son dos `minipage`; acá, CSS grid.)
 */
function reasoningToHtml(node: ReasoningNode, ctx: Ctx): string {
  const title = node.title ? `<p class="mx-reasoning-title">${esc(node.title)}</p>` : ''
  const rows = node.rows
    .map((r) => {
      const left = `<div class="mx-reasoning-cell">${blocksToHtml(r.left, ctx)}</div>`
      const right = `<div class="mx-reasoning-cell">${blocksToHtml(r.right, ctx)}</div>`
      return `<div class="mx-reasoning-row${r.boxed ? ' is-boxed' : ''}">${left}${right}</div>`
    })
    .join('\n')
  return `<div class="mx-reasoning">${title}${rows}</div>`
}

function theoremToHtml(node: TheoremNode, ctx: Ctx): string {
  if (node.variant === 'proof') {
    const provesInfo = node.proves ? ctx.refs.byKey.get(node.proves) : undefined
    const head = provesInfo
      ? `Demostración de <a href="#${provesInfo.anchor}" class="mx-ref">${esc(provesInfo.display)}</a>`
      : node.title
        ? esc(node.title)
        : 'Demostración'
    return `<div class="mx-theorem mx-proof"><p class="mx-thm-head"><em>${head}.</em></p>${blocksToHtml(node.content, ctx)}</div>`
  }
  const info = ctx.refs.ofNode.get(node)
  const name = info ? info.display : THEOREM_NAME[node.variant]
  const title = node.title ? ` (${esc(node.title)})` : ''
  return `<div class="mx-theorem mx-thm-${node.variant}"${anchorAttr(node, ctx)}><p class="mx-thm-head"><strong>${esc(name)}${title}.</strong></p>${blocksToHtml(node.content, ctx)}</div>`
}

const ALIGN_CSS: Record<string, string> = { left: 'left', center: 'center', right: 'right' }

function tableToHtml(node: TableNode, ctx: Ctx): string {
  const ncol = node.rows.reduce((max, row) => Math.max(max, row.cells.length), 0)
  if (ncol === 0) return ''
  const aligns = node.align ?? []
  const renderRow = (row: TableNode['rows'][number], header: boolean): string => {
    const cells = Array.from({ length: ncol }, (_, i) => {
      const align = ALIGN_CSS[aligns[i] ?? 'left'] ?? 'left'
      const content = row.cells[i] ? inlineToHtml(row.cells[i]!.content, ctx) : ''
      const tag = header ? 'th' : 'td'
      return `<${tag} style="text-align:${align}">${content}</${tag}>`
    })
    return `<tr>${cells.join('')}</tr>`
  }
  const hasHeader = node.header === true && node.rows.length > 0
  const head = hasHeader ? `<thead>${renderRow(node.rows[0]!, true)}</thead>` : ''
  const bodyRows = (hasHeader ? node.rows.slice(1) : node.rows).map((r) => renderRow(r, false)).join('\n')
  const info = ctx.refs.ofNode.get(node)
  const caption = node.caption
    ? `<figcaption class="mx-caption"><span class="mx-caplabel">${info ? esc(info.display.replace(/^(\w)/, (m) => m.toUpperCase())) : 'Tabla'}.</span> ${esc(node.caption)}</figcaption>`
    : ''
  const table = `<table class="mx-table"><colgroup>${Array.from({ length: ncol }, () => '<col>').join('')}</colgroup>${head}<tbody>\n${bodyRows}\n</tbody></table>`
  return `<figure class="mx-table-wrap"${anchorAttr(node, ctx)}>${table}${caption}</figure>`
}

/** Una parte de figura → HTML (reusa los emisores SVG puros; imágenes vía data URI). */
const PARAM_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Ventana estable (unión de rangos): así el gráfico **no salta** cuando el lector desliza. Se
 *  muestrea cada parámetro en sus extremos (más el valor actual) — sin combinar (barato). */
function stableView(spec: PlotSpec, ranged: readonly NonNullable<PlotSpec['parameters']>[number][]): PlotView {
  const params = spec.parameters ?? []
  const wins = [plotDisplayWindow(spec)]
  for (const p of ranged) {
    for (const value of [p.min!, p.max!]) {
      wins.push(plotDisplayWindow({ ...spec, parameters: params.map((q) => (q === p ? { ...q, value } : q)) }))
    }
  }
  return {
    xmin: Math.min(...wins.map((w) => w.xmin)),
    xmax: Math.max(...wins.map((w) => w.xmax)),
    ymin: Math.min(...wins.map((w) => w.ymin)),
    ymax: Math.max(...wins.map((w) => w.ymax)),
  }
}

/**
 * **Gráfico interactivo con renderer en vivo (ME-37 + zoom/pan).** Todo plot del HTML del lector es
 * **explorable como en el editor**: **arrastrar = desplazar**, **Ctrl/⌘ + rueda = zoom** (centrado en
 * el cursor), **⟲ = restablecer vista**; y si tiene parámetros con rango, **un slider por parámetro**.
 * Cada interacción recomputa el SVG con el **mismo `plotToSvg` del editor** (embebido, `PLOT_RUNTIME_JS`):
 * continuo, sin `eval` del usuario. La ventana arranca **estable** (precomputada) → sin saltos.
 */
function plotToInteractiveHtml(spec: PlotSpec, ctx: Ctx): string {
  ctx.needsRuntime.on = true
  const ranged = (spec.parameters ?? []).filter((p) => p.min != null && p.max != null && p.min < p.max && PARAM_IDENT.test(p.name))
  const view = ranged.length > 0 ? stableView(spec, ranged) : plotDisplayWindow(spec)
  const uid = `mxplot${ctx.widgetSeq.n++}`
  const initial = plotToSvg(spec, view) // estado inicial (valores actuales), ya usable sin JS
  const sliders = ranged
    .map((p) => {
      const step = p.step && p.step > 0 ? p.step : Number(((p.max! - p.min!) / 100).toPrecision(3))
      return (
        `<div class="mx-pslider"><label><span class="mx-pname">${esc(p.name)}</span> = <span class="mx-pval">${esc(String(p.value))}</span></label>` +
        `<input type="range" data-name="${esc(p.name)}" min="${p.min}" max="${p.max}" step="${step}" value="${p.value}" aria-label="Deslizador de ${esc(p.name)}">` +
        `<button type="button" class="mx-panim" title="Animar ${esc(p.name)} (recorre el rango)" aria-label="Animar ${esc(p.name)}">▶</button></div>`
      )
    })
    .join('')
  // El controlador (sliders, pan, zoom, hover, animación) vive **tipado** en `plotRuntime.entry.ts`
  // como `window.__mxInitPlot` (AR-11); acá solo emitimos la llamada parametrizada. `spec` viaja
  // como JSON string (el runtime lo parsea); `view` es la ventana inicial estable.
  const script = `<script>window.addEventListener('load',function(){if(window.__mxInitPlot)window.__mxInitPlot(${JSON.stringify(uid)},${JSON.stringify(JSON.stringify(spec))},${JSON.stringify(view)});});</script>`
  const tools =
    `<div class="mx-plot-tools">` +
    `<button type="button" data-fx="0.8" data-fy="0.8" title="Acercar (ambos ejes) · Ctrl+rueda" aria-label="Acercar ambos ejes">⊕</button>` +
    `<button type="button" data-fx="1.25" data-fy="1.25" title="Alejar (ambos ejes) · Ctrl+rueda" aria-label="Alejar ambos ejes">⊖</button>` +
    `<button type="button" data-fx="0.8" data-fy="1" title="Acercar horizontal (eje x) · Shift+rueda" aria-label="Acercar eje x">↔﹢</button>` +
    `<button type="button" data-fx="1.25" data-fy="1" title="Alejar horizontal (eje x) · Shift+rueda" aria-label="Alejar eje x">↔﹣</button>` +
    `<button type="button" data-fx="1" data-fy="0.8" title="Acercar vertical (eje y) · Alt+rueda" aria-label="Acercar eje y">↕﹢</button>` +
    `<button type="button" data-fx="1" data-fy="1.25" title="Alejar vertical (eje y) · Alt+rueda" aria-label="Alejar eje y">↕﹣</button>` +
    `<button type="button" class="mx-plot-equal" title="Igualar la escala de los ejes (1 unidad en x = 1 en y)" aria-label="Igualar escala de ejes">1:1</button>` +
    `<button type="button" class="mx-plot-reset" title="Restablecer vista" aria-label="Restablecer vista">⟲</button>` +
    `</div>`
  const legend = plotLegendHtml(spec) // overlay HTML/MathML (los sliders lo actualizan en vivo)
  const featLeg = spec.featureLegend ? `<div class="mx-featleg-wrap">${plotFeatureLegendHtml(spec)}</div>` : ''
  const hover = `<div class="mx-hover-dot" style="display:none"></div><div class="mx-hover-tip" style="display:none"></div>`
  const stage = `<div class="mx-plot-stage"><div class="mx-plot-canvas" title="Arrastrá para mover · Ctrl+rueda: zoom · Shift+rueda: solo horizontal · Alt+rueda: solo vertical">${initial}</div>${legend}${featLeg}${tools}${hover}</div>`
  return `<div class="mx-plot-interactive" id="${uid}">${stage}${sliders}</div>${script}`
}

function figureItemToHtml(item: FigureItem, ctx: Ctx): string {
  switch (item.kind) {
    case 'plot':
      return plotToInteractiveHtml(item.spec, ctx)
    case 'chart':
      return chartToSvg(item.spec)
    case 'distribution':
      return distToSvg(item.spec)
    case 'diagram':
      return diagramToSvg(item.spec)
    case 'tree':
      return treeToSvg(item.spec)
    case 'image': {
      const uri = ctx.images[item.src]
      const width = item.width ? ` style="width:${Math.round(item.width * 100)}%"` : ''
      return uri
        ? `<img src="${esc(uri)}" alt="${esc(item.src)}"${width}>`
        : `<span class="mx-img-missing">imagen: ${esc(item.src)}</span>`
    }
  }
}

function figureToHtml(node: FigureNode, ctx: Ctx): string {
  const info = ctx.refs.ofNode.get(node)
  const label = info ? info.display.replace(/^(\w)/, (m) => m.toUpperCase()) : 'Figura'
  let inner: string
  if (node.items.length >= 2) {
    // Subfiguras: partes lado a lado con subepígrafe a/b/…
    inner = `<div class="mx-subfigs">${node.items
      .map((item, i) => {
        const letter = String.fromCharCode(97 + i)
        const subcap = item.subcaption ? `<figcaption>(${letter}) ${esc(item.subcaption)}</figcaption>` : `<figcaption>(${letter})</figcaption>`
        const subInfo = ctx.refs.ofNode.get(item)
        const id = subInfo ? ` id="${subInfo.anchor}"` : ''
        return `<figure class="mx-subfig"${id}>${figureItemToHtml(item, ctx)}${subcap}</figure>`
      })
      .join('\n')}</div>`
  } else {
    inner = node.items.map((item) => figureItemToHtml(item, ctx)).join('\n')
  }
  const caption = node.caption
    ? `<figcaption class="mx-caption"><span class="mx-caplabel">${esc(label)}.</span> ${esc(node.caption)}</figcaption>`
    : ''
  return `<figure class="mx-figure"${anchorAttr(node, ctx)}>${inner}${caption}</figure>`
}

const CALLOUT_ICON: Record<CalloutVariant, string> = { note: '📝', tip: '💡', warning: '⚠️', important: '❗' }

function calloutToHtml(node: Extract<BlockNode, { type: 'callout' }>, ctx: Ctx): string {
  const title = node.title
    ? `<p class="mx-callout-title">${CALLOUT_ICON[node.variant]} ${esc(node.title)}</p>`
    : ''
  return `<aside class="mx-callout mx-callout-${node.variant}">${title}<div class="mx-callout-body">${blocksToHtml(node.content, ctx)}</div></aside>`
}

function blockToHtml(node: BlockNode, ctx: Ctx): string {
  switch (node.type) {
    case 'part':
      return partToHtml(node, ctx)
    case 'heading':
      return headingToHtml(node, ctx)
    case 'paragraph':
      return `<p>${inlineToHtml(node.content, ctx)}</p>`
    case 'bulletList':
      return listToHtml('ul', node.items, ctx)
    case 'orderedList':
      return listToHtml('ol', node.items, ctx)
    case 'mathDisplay':
      return mathDisplayToHtml(node, ctx)
    case 'derivation':
      return derivationToHtml(node)
    case 'reasoning':
      return reasoningToHtml(node, ctx)
    case 'theorem':
      return theoremToHtml(node, ctx)
    case 'table':
      return tableToHtml(node, ctx)
    case 'figure':
      return figureToHtml(node, ctx)
    case 'codeBlock':
      return `<pre class="mx-code"><code${node.language ? ` class="language-${esc(node.language)}"` : ''}>${esc(node.code)}</code></pre>`
    case 'callout':
      return calloutToHtml(node, ctx)
    case 'include':
      // Escotilla file-based: HTML no incluye `.tex` crudo → aviso (ver LE-02).
      return node.target.trim() ? `<p class="mx-notice">⟨incluye <code>${esc(node.target.trim())}</code> — no disponible en HTML⟩</p>` : ''
    case 'rawLatex':
      // Eject de LaTeX crudo: un backend HTML lo ignora/avisa (ver LE-02).
      return `<p class="mx-notice">⟨LaTeX crudo omitido en HTML⟩</p>`
    case 'slide':
      // Diapositiva → una **sección** con título (un deck estilo reveal es fase futura).
      return `<section class="mx-slide">${node.title?.trim() ? `<h2>${esc(node.title.trim())}</h2>` : ''}${blocksToHtml(node.content, ctx)}</section>`
    case 'columns':
      // Columnas → fila flex (el revelado/overlays no aplican al HTML estático).
      return `<div class="mx-columns">${node.columns.map((c) => `<div class="mx-column" style="flex:${c.ratio && c.ratio > 0 ? c.ratio : 1}">${blocksToHtml(c.content, ctx)}</div>`).join('')}</div>`
    case 'posterBlock':
      // Bloque de póster → recuadro con título (el HTML los apila en una columna fluida).
      return `<section class="mx-poster-block">${node.title?.trim() ? `<h3>${esc(node.title.trim())}</h3>` : ''}${blocksToHtml(node.content, ctx)}</section>`
    case 'cvEntry': {
      const cell = (v: string | undefined, cls: string): string => (v?.trim() ? `<span class="${cls}">${esc(v.trim())}</span>` : '')
      const head = [cell(node.role, 'mx-cv-role'), cell(node.org, 'mx-cv-org'), cell(node.place, 'mx-cv-place')].filter(Boolean).join(' · ')
      return `<div class="mx-cv-entry">${cell(node.period, 'mx-cv-period')}<div class="mx-cv-body"><div>${head}</div>${node.detail?.trim() ? `<div class="mx-cv-detail">${esc(node.detail.trim())}</div>` : ''}</div></div>`
    }
    case 'examQuestion': {
      // Pregunta con su puntaje; la solución sale solo si el documento la pide.
      const pts = node.points != null ? `<span class="mx-q-points">${node.points} pts</span>` : ''
      const sol =
        ctx.showSolutions && node.solution && node.solution.length > 0
          ? `<div class="mx-q-solution"><span class="mx-q-sol-label">Solución</span>${blocksToHtml(node.solution, ctx)}</div>`
          : ''
      return `<li class="mx-question">${pts}${blocksToHtml(node.content, ctx)}${sol}</li>`
    }
  }
}

function blocksToHtml(blocks: BlockNode[], ctx: Ctx): string {
  // Las preguntas de examen emiten `<li>`: las corridas consecutivas se envuelven en su `<ol>`
  // (numeración automática), igual que el entorno `questions` del backend LaTeX.
  const out: string[] = []
  let run: string[] = []
  const flush = (): void => {
    if (run.length > 0) out.push(`<ol class="mx-questions">${run.join('\n')}</ol>`)
    run = []
  }
  for (const b of blocks) {
    if (b.type === 'examQuestion') run.push(blockToHtml(b, ctx))
    else {
      flush()
      out.push(blockToHtml(b, ctx))
    }
  }
  flush()
  return out.join('\n')
}

/**
 * Cuerpo del **póster**: los `posterBlock` se reparten en la grilla de columnas (mismo
 * criterio que el backend LaTeX, vía `poster.ts`) y el resto de los bloques va después.
 */
function posterBodyToHtml(content: BlockNode[], poster: PosterMeta, ctx: Ctx): string {
  const cols = posterColumns(poster)
  const blocks = content.filter((b): b is PosterBlockNode => b.type === 'posterBlock')
  const others = content.filter((b) => b.type !== 'posterBlock')
  const parts: string[] = []
  if (blocks.length > 0) {
    const buckets = distributePosterBlocks(blocks, cols)
    const inner = buckets.map((col) => `<div class="mx-poster-col">${blocksToHtml(col, ctx)}</div>`).join('\n')
    parts.push(`<div class="mx-poster-cols">\n${inner}\n</div>`)
  }
  if (others.length > 0) parts.push(blocksToHtml(others, ctx))
  return parts.join('\n')
}

/** Bibliografía → lista simple con anclas (destino de las `cite`). */
function bibliographyToHtml(doc: MatexDoc): string {
  const refs = doc.references ?? []
  if (refs.length === 0) return ''
  const title = doc.meta?.bibTitle ?? 'Referencias'
  const items = refs
    .map((e) => {
      const authors = e.author ? `${esc(e.author)}. ` : ''
      const year = e.year ? ` (${esc(String(e.year))})` : ''
      const journal = e.journal ? `, <em>${esc(e.journal)}</em>` : ''
      const title2 = e.title ? `«${esc(e.title)}»` : ''
      return `<li id="mx-bib-${esc(e.key)}"><span class="mx-bibkey">[${esc(e.key)}]</span> ${authors}${title2}${journal}${year}.</li>`
    })
    .join('\n')
  return `<section class="mx-bibliography"><h2>${esc(title)}</h2><ul class="mx-biblist">\n${items}\n</ul></section>`
}

/** Bloque de notas al pie al final (si hubo). */
function footnotesToHtml(ctx: Ctx): string {
  if (ctx.footnotes.length === 0) return ''
  const items = ctx.footnotes
    .map((t, i) => `<li id="mx-fn-${i + 1}">${esc(t)} <a href="#mx-fnref-${i + 1}" class="mx-fnback">↩</a></li>`)
    .join('\n')
  return `<section class="mx-footnotes"><hr><ol>\n${items}\n</ol></section>`
}

function metaHeader(meta: DocMeta): string {
  // **Modo carta**: encabezado propio (remitente arriba, destinatario y saludo) en vez de portada.
  const letter = letterMeta(meta)
  if (letter) {
    const l = letter
    // Cada salto de línea de una dirección es una línea propia (igual que el `\\` de LaTeX).
    const line = (s: string | undefined): string =>
      s?.trim()
        ? s
            .split(/\r?\n/)
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => `<div>${esc(x)}</div>`)
            .join('')
        : ''
    const from = [line(l.from), line(l.fromAddress)].filter(Boolean).join('')
    const to = [line(l.to), line(l.toAddress)].filter(Boolean).join('')
    return [
      from ? `<div class="mx-letter-from">${from}</div>` : '',
      meta.date ? `<div class="mx-letter-date">${esc(meta.date)}</div>` : '',
      to ? `<div class="mx-letter-to">${to}</div>` : '',
      `<p class="mx-letter-opening">${esc(l.opening?.trim() || 'Estimado/a:')}</p>`,
    ]
      .filter(Boolean)
      .join('\n')
  }
  // **Modo CV**: la portada es la identidad — nombre, subtítulo y datos de contacto. Sin esto
  // el HTML perdía información que el PDF sí imprime (`\name`/`\title`/`\address`/`\email`).
  const cvm = cvMeta(meta)
  if (cvm) {
    const cv = cvm
    const name = meta.author?.trim() || meta.title?.trim()
    const sub = cv.subtitle?.trim() || (meta.author?.trim() ? meta.title?.trim() : undefined)
    const contact = [cv.address?.trim(), cv.email?.trim()].filter(Boolean).map((x) => esc(x as string))
    const rows = [
      name ? `<h1 class="mx-title">${esc(name)}</h1>` : '',
      sub ? `<p class="mx-cv-subtitle">${esc(sub)}</p>` : '',
      contact.length > 0 ? `<p class="mx-cv-contact">${contact.join(' · ')}</p>` : '',
    ].filter(Boolean)
    return rows.length > 0 ? `<header class="mx-doc-header">${rows.join('\n')}</header>` : ''
  }
  const parts: string[] = []
  if (meta.title) parts.push(`<h1 class="mx-title">${esc(meta.title)}</h1>`)
  // Examen: la consigna general va bajo el título, antes de las preguntas.
  const exam = examMeta(meta)
  if (exam?.instructions?.trim()) parts.push(`<p class="mx-exam-instructions">${esc(exam.instructions.trim())}</p>`)
  const authors: string[] = []
  if (meta.authors && meta.authors.length > 0) {
    for (const a of meta.authors) {
      if (!a.name.trim() && !a.affiliation && !a.email) continue
      const lines = [esc(a.name)]
      if (a.affiliation) lines.push(`<span class="mx-affil">${esc(a.affiliation)}</span>`)
      if (a.email) lines.push(`<span class="mx-email">${esc(a.email)}</span>`)
      authors.push(lines.join('<br>'))
    }
  } else if (meta.author) {
    const lines = [esc(meta.author)]
    if (meta.institution) lines.push(`<span class="mx-affil">${esc(meta.institution)}</span>`)
    authors.push(lines.join('<br>'))
  } else if (meta.institution) {
    authors.push(`<span class="mx-affil">${esc(meta.institution)}</span>`)
  }
  if (authors.length > 0) parts.push(`<p class="mx-authors">${authors.join('<span class="mx-and"> </span>')}</p>`)
  if (meta.date) parts.push(`<p class="mx-date">${esc(meta.date)}</p>`)
  if (meta.abstract?.trim()) parts.push(`<div class="mx-abstract"><p class="mx-abstract-title">Resumen</p><p>${esc(meta.abstract.trim())}</p></div>`)
  return parts.length > 0 ? `<header class="mx-doc-header">${parts.join('\n')}</header>` : ''
}

// Tema por **variables**: cada superficie/tinta es una var. La paleta clara es el default; la
// oscura se activa por `prefers-color-scheme: dark` (documento descargado = se adapta al lector)
// **o** forzada con `:root[data-theme="dark"|"light"]` (el editor le pasa el tema de la app). El
// `<body>` tiene fondo sólido propio → nunca se ve "pálido"/transparente sobre el panel de la app.
const THEME_LIGHT = `--mx-bg:#fbfbf9; --mx-surface:#ffffff; --mx-ink:#1a1a1a; --mx-muted:#5a5a5a; --mx-faint:#767676; --mx-rule:#333; --mx-line:#c7c7c7; --mx-link:#1a5fb4; --mx-accent:#2a9d3a; --mx-danger:#c01c28; --mx-code-bg:#f2f2ef; --mx-note-bg:#eef4fd; --mx-tip-bg:#eefaef; --mx-warn-bg:#fff5e6; --mx-imp-bg:#fdeeee;`
const THEME_DARK = `--mx-bg:#1a1a1c; --mx-surface:#232326; --mx-ink:#eaeaea; --mx-muted:#a8a8a8; --mx-faint:#8f8f8f; --mx-rule:#9a9a9a; --mx-line:#4a4a4e; --mx-link:#6ab0ff; --mx-accent:#5fd06e; --mx-danger:#ff7a85; --mx-code-bg:#2a2a2e; --mx-note-bg:#16263d; --mx-tip-bg:#16301a; --mx-warn-bg:#33260f; --mx-imp-bg:#33161a;`

const DOCUMENT_CSS = `
:root { color-scheme: light dark; ${THEME_LIGHT} }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; ${THEME_DARK} } }
:root[data-theme="dark"] { color-scheme: dark; ${THEME_DARK} }
:root[data-theme="light"] { color-scheme: light; ${THEME_LIGHT} }
html, body { margin: 0; background: var(--mx-bg); }
.mx-doc { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; font-family: 'Latin Modern Roman', Georgia, 'Times New Roman', serif; font-size: 17px; line-height: 1.6; color: var(--mx-ink); background: var(--mx-bg); }
.mx-doc-header { text-align: center; margin-bottom: 2.5rem; }
.mx-title { font-size: 1.9rem; font-weight: 700; margin: 0 0 .75rem; }
.mx-authors { margin: .25rem 0; }
.mx-and { display: inline-block; width: 2.5rem; }
.mx-affil, .mx-email { font-size: .85em; color: var(--mx-muted); }
.mx-date { color: var(--mx-muted); }
.mx-abstract { max-width: 34rem; margin: 1.75rem auto 0; text-align: left; font-size: .95em; }
.mx-abstract-title { font-weight: 700; text-align: center; margin: 0 0 .25rem; }
.mx-part { margin: 2.6rem 0 1.2rem; line-height: 1.2; text-align: center; border-bottom: 2px solid var(--mx-rule); padding-bottom: .5rem; }
.mx-partnum { display: block; font-size: .7em; letter-spacing: .08em; text-transform: uppercase; color: var(--mx-faint); }
.mx-heading { margin: 1.9rem 0 .7rem; line-height: 1.25; }
.mx-secnum { color: var(--mx-faint); font-weight: 600; }
.mx-doc p { margin: .7rem 0; }
.mx-ref, .mx-cite { color: var(--mx-link); text-decoration: none; }
.mx-ref:hover, .mx-cite:hover { text-decoration: underline; }
.mx-ref-broken { color: var(--mx-danger); }
.mx-eq { text-align: center; margin: 1rem 0; position: relative; }
.mx-eq math { font-size: 1.05em; }
.mx-eqno { position: absolute; right: 0; top: 50%; transform: translateY(-50%); color: var(--mx-muted); }
.mx-eq-multi { display: grid; grid-template-columns: 1fr auto; align-items: center; }
.mx-eqnos { display: flex; flex-direction: column; justify-content: space-around; padding-left: 1rem; }
.mx-derivation { margin: 1.1rem 0; }
.mx-deriv-title { font-weight: 700; margin: 0 0 .4rem; }
.mx-deriv-grid { display: grid; grid-template-columns: auto 1fr; gap: .3rem 1.4rem; align-items: baseline; }
.mx-deriv-step { display: contents; }
.mx-deriv-math { text-align: right; }
.mx-deriv-note { color: var(--mx-muted); font-size: .95em; }
.mx-reasoning { margin: 1.1rem 0; }
.mx-reasoning-title { font-weight: 700; margin: 0 0 .5rem; }
.mx-reasoning-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; padding: .5rem 0; align-items: start; }
.mx-reasoning-row.is-boxed { border: 1px solid var(--mx-line); border-radius: 6px; padding: .6rem .8rem; margin: .4rem 0; }
.mx-reasoning-cell > :first-child { margin-top: 0; }
.mx-reasoning-cell > :last-child { margin-bottom: 0; }
.mx-theorem { margin: 1.1rem 0; padding: .1rem 0 .1rem .9rem; border-left: 3px solid var(--mx-line); }
.mx-thm-head { margin: 0 0 .3rem; }
.mx-thm-theorem, .mx-thm-lemma, .mx-thm-proposition, .mx-thm-corollary { border-left-color: var(--mx-link); }
.mx-thm-definition, .mx-thm-example { border-left-color: var(--mx-accent); }
.mx-proof { font-size: .98em; }
.mx-table-wrap, .mx-figure { margin: 1.4rem 0; text-align: center; }
.mx-table { border-collapse: collapse; margin: 0 auto; border-top: 2px solid var(--mx-rule); border-bottom: 2px solid var(--mx-rule); }
.mx-table th, .mx-table td { padding: .35rem .8rem; }
.mx-table thead th { border-bottom: 2px solid var(--mx-rule); }
.mx-caption { font-size: .9em; color: var(--mx-muted); margin-top: .5rem; text-align: center; }
.mx-caplabel { font-weight: 700; }
.mx-subfigs { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; align-items: flex-start; }
.mx-subfig figcaption { font-size: .85em; color: var(--mx-muted); }
.mx-figure svg, .mx-subfig svg { max-width: 100%; height: auto; }
.mx-figure img { max-width: 100%; }
/* El widget interactivo llena el ancho de la figura (como en el editor); antes era inline-flex y
   se encogia -> el SVG se veia chico. position:relative ancla el boton de reset. */
.mx-plot-interactive { display: flex; flex-direction: column; align-items: stretch; width: 100%; }
.mx-plot-stage { position: relative; width: 100%; }
.mx-plot-canvas { cursor: grab; touch-action: none; }
.mx-plot-canvas svg { display: block; width: 100%; height: auto; }
.mx-legend { position: absolute; display: flex; flex-direction: column; gap: .1rem; background: Canvas; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); border-radius: 6px; padding: .25rem .5rem; font-size: .82em; pointer-events: none; max-width: 72%; }
.mx-legend[data-pos="top-left"] { top: .4rem; left: .4rem; }
.mx-legend[data-pos="top-right"], .mx-legend[data-pos="outside-right"] { top: 2.5rem; right: .4rem; }
.mx-legend[data-pos="bottom-left"] { bottom: .4rem; left: .4rem; }
.mx-legend[data-pos="bottom-right"] { bottom: .4rem; right: .4rem; }
.mx-leg-row { display: flex; align-items: center; gap: .4rem; white-space: nowrap; }
.mx-leg-swatch { display: inline-block; width: 1.4rem; height: 0; flex-shrink: 0; }
.mx-leg-lab math { font-size: 1.02em; }
.mx-plot-tools { position: absolute; top: .4rem; right: .4rem; display: flex; flex-wrap: wrap; gap: .2rem; justify-content: flex-end; max-width: 70%; opacity: .45; transition: opacity .15s; }
.mx-plot-interactive:hover .mx-plot-tools, .mx-plot-tools:focus-within { opacity: 1; }
.mx-plot-tools button { min-width: 1.75rem; height: 1.75rem; padding: 0 .3rem; display: inline-flex; align-items: center; justify-content: center; font-size: .82rem; line-height: 1; border-radius: 6px; border: 1px solid var(--mx-line); background: var(--mx-surface); color: var(--mx-muted); cursor: pointer; }
.mx-plot-tools button:hover { color: var(--mx-ink); border-color: var(--mx-rule); }
.mx-hover-dot { position: absolute; width: 8px; height: 8px; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 0 2px var(--mx-surface); pointer-events: none; z-index: 6; }
.mx-hover-tip { position: absolute; transform: translateY(-100%); padding: 1px 5px; font-size: .72rem; font-variant-numeric: tabular-nums; color: var(--mx-ink); background: var(--mx-surface); border: 1px solid var(--mx-line); border-radius: 5px; white-space: nowrap; pointer-events: none; z-index: 6; }
.mx-featleg { position: absolute; left: 8px; bottom: 8px; max-width: 62%; z-index: 4; display: flex; flex-direction: column; gap: 3px; padding: 4px 7px; font-size: .72rem; background: var(--mx-surface); border: 1px solid var(--mx-line); border-radius: 6px; pointer-events: none; }
.mx-featleg-fn { display: flex; align-items: flex-start; gap: 5px; }
.mx-featleg-sw { flex: none; width: 10px; height: 10px; border-radius: 2px; margin-top: 2px; }
.mx-featleg-items { display: flex; flex-direction: column; gap: 1px; color: var(--mx-ink); font-variant-numeric: tabular-nums; }
.mx-pslider { display: flex; align-items: center; gap: .6rem; font-size: .85em; color: var(--mx-muted); padding: .1rem .4rem 0; }
.mx-pslider input[type=range] { flex: 1; accent-color: var(--mx-link); }
.mx-panim { flex: none; width: 1.5em; height: 1.5em; padding: 0; line-height: 1; font-size: .8em; border: 1px solid var(--mx-line); border-radius: 4px; background: var(--mx-surface); color: var(--mx-muted); cursor: pointer; }
.mx-panim:hover { color: var(--mx-link); border-color: var(--mx-link); }
.mx-panim.mx-anim-on { color: var(--mx-link); border-color: var(--mx-link); }
.mx-pname { font-style: italic; color: var(--mx-ink); }
.mx-pval { font-variant-numeric: tabular-nums; color: var(--mx-ink); }
.mx-callout { margin: 1.2rem 0; padding: .7rem 1rem; border-radius: 6px; border-left: 4px solid; }
.mx-callout-title { font-weight: 700; margin: 0 0 .3rem; }
.mx-slide { margin: 1.5rem 0; padding: 1rem 1.2rem; border: 1px solid var(--mx-line); border-radius: 8px; }
.mx-slide > h2 { margin-top: 0; }
.mx-columns { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: flex-start; }
.mx-column { flex: 1; min-width: 12rem; }
/* Deck (presentación): una diapositiva a la vez, formato 16:9. */
.mx-deck { position: relative; }
.mx-deck .mx-slide { display: none; min-height: 60vh; aspect-ratio: 16 / 9; margin: 0 auto; box-shadow: 0 2px 16px rgba(0,0,0,.12); }
.mx-deck .mx-slide.mx-active { display: block; }
.mx-deck .mx-slide-title { display: none; text-align: center; }
.mx-deck .mx-slide-title.mx-active { display: flex; flex-direction: column; justify-content: center; align-items: center; }
.mx-deck-nav { position: sticky; bottom: 0; text-align: center; padding: .5rem; font-size: .8em; color: var(--mx-muted); }
/* Póster: bloques en recuadros. */
/* Diseño semántico (LE-02): el acento es una variable; la familia de diseño, tipografía y filetes. */
.mx-accent-blue { --mx-accent:#1a5fb4; } .mx-accent-green { --mx-accent:#2a9d3a; } .mx-accent-orange { --mx-accent:#c96a12; }
.mx-accent-red { --mx-accent:#c01c28; } .mx-accent-purple { --mx-accent:#7239a8; } .mx-accent-grey { --mx-accent:#5a5a5a; }
.mx-accent-black { --mx-accent:#1a1a1a; }
.mx-style-modern { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; }
.mx-style-modern .mx-title { font-weight: 600; letter-spacing: -.01em; }
.mx-style-modern .mx-heading { color: var(--mx-accent); }
.mx-style-classic .mx-title { font-variant: small-caps; letter-spacing: .02em; }
.mx-style-classic .mx-doc-header { border-bottom: 2px solid var(--mx-accent); padding-bottom: 1rem; }
.mx-style-classic .mx-heading { border-bottom: 1px solid var(--mx-line); padding-bottom: .2rem; }
.mx-poster-cols { display: flex; gap: 1.2rem; align-items: flex-start; }
.mx-poster-col { flex: 1 1 0; min-width: 0; }
@media (max-width: 42rem) { .mx-poster-cols { display: block; } }
.mx-poster-block { border: 1px solid var(--mx-line); border-radius: 8px; padding: .8rem 1.1rem; margin: 1rem 0; }
.mx-poster-block > h3 { margin-top: 0; }
/* Currículum: entradas de trayectoria. */
.mx-cv-subtitle { margin: .2rem 0; color: var(--mx-muted); font-size: 1.05em; }
.mx-cv-contact { margin: .3rem 0 0; color: var(--mx-muted); font-size: .9em; }
.mx-cv-entry { display: flex; gap: 1rem; margin: .8rem 0; }
.mx-cv-period { flex: none; width: 8rem; color: var(--mx-muted); font-size: .9em; }
.mx-cv-body { flex: 1; }
.mx-cv-role { font-weight: 600; }
.mx-cv-detail { color: var(--mx-muted); font-size: .93em; margin-top: .15rem; }
/* Examen: preguntas con puntaje y solución. */
.mx-questions { padding-left: 1.4rem; }
.mx-question { margin: 1.1rem 0; }
.mx-q-points { float: right; font-size: .85em; color: var(--mx-muted); }
.mx-q-solution { margin-top: .5rem; padding: .5rem .8rem; border-left: 3px solid var(--mx-link); background: var(--mx-surface); border-radius: 0 6px 6px 0; }
.mx-q-sol-label { display: block; font-weight: 700; font-size: .82em; color: var(--mx-link); margin-bottom: .2rem; }
.mx-exam-instructions { margin: 1rem 0 1.5rem; padding-bottom: .6rem; border-bottom: 1px solid var(--mx-line); }
/* Carta formal. */
.mx-letter-from { text-align: right; margin-bottom: 1.5rem; }
.mx-letter-date { text-align: right; margin-bottom: 2rem; color: var(--mx-muted); }
.mx-letter-to { margin-bottom: 2rem; }
.mx-letter-opening { margin-bottom: 1.2rem; }
.mx-letter-closing { margin-top: 2rem; margin-bottom: 3rem; }
.mx-letter-sign { font-weight: 600; }
.mx-letter-encl { font-size: .9em; color: var(--mx-muted); margin-top: 1.5rem; }
.mx-callout-body > :first-child { margin-top: 0; }
.mx-callout-body > :last-child { margin-bottom: 0; }
.mx-callout-note { background: var(--mx-note-bg); border-color: var(--mx-link); }
.mx-callout-tip { background: var(--mx-tip-bg); border-color: var(--mx-accent); }
.mx-callout-warning { background: var(--mx-warn-bg); border-color: #e08600; }
.mx-callout-important { background: var(--mx-imp-bg); border-color: var(--mx-danger); }
.mx-code { background: var(--mx-code-bg); border-radius: 6px; padding: .8rem 1rem; overflow-x: auto; font-size: .88em; }
.mx-code code { font-family: 'Latin Modern Mono', 'SF Mono', Consolas, monospace; }
.mx-notice, .mx-img-missing { color: var(--mx-faint); font-style: italic; font-size: .9em; }
.mx-fnref { font-size: .75em; }
.mx-footnotes { margin-top: 2.5rem; font-size: .88em; color: var(--mx-muted); }
.mx-footnotes ol { padding-left: 1.2rem; }
.mx-bibliography { margin-top: 2.5rem; }
.mx-biblist { list-style: none; padding-left: 0; font-size: .92em; }
.mx-biblist li { margin: .4rem 0; padding-left: 2rem; text-indent: -2rem; }
.mx-bibkey { font-weight: 700; }
`

/** Controlador del **deck** (ME-23 fase 4): muestra una `.mx-slide` a la vez; ←/→ o clic navegan. */
const DECK_SCRIPT =
  '<script>(function(){var d=document.currentScript.closest(".mx-deck");if(!d)return;' +
  'var s=d.querySelectorAll(".mx-slide");var i=0;' +
  'function show(n){i=Math.max(0,Math.min(s.length-1,n));for(var k=0;k<s.length;k++)s[k].classList.toggle("mx-active",k===i);' +
  'var c=d.querySelector(".mx-deck-count");if(c)c.textContent=(i+1)+" / "+s.length;}' +
  'document.addEventListener("keydown",function(e){if(e.key==="ArrowRight"||e.key==="PageDown"||e.key===" "){e.preventDefault();show(i+1);}else if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();show(i-1);}});' +
  'd.addEventListener("click",function(e){if(e.target.closest("a,button,input,select,textarea,.mx-plot-interactive"))return;show(i+1);});' +
  'if(s.length)show(0);})();</script>'

export interface HtmlOptions {
  /** `nombre de archivo → data URI` para las imágenes de las figuras (el editor las provee). */
  images?: Record<string, string> | undefined
  /** `false` = devuelve solo el fragmento `<article>` (sin `<html>`/`<head>`/CSS). Default `true`. */
  standalone?: boolean | undefined
  /**
   * Tema del documento. `'auto'` (default) = se adapta al `prefers-color-scheme` del lector (ideal
   * para el `.html` descargado). `'light'`/`'dark'` fuerzan el tema (el editor pasa el de la app,
   * así el preview no se ve "pálido" sobre el panel oscuro).
   */
  theme?: 'auto' | 'light' | 'dark' | undefined
  /** Examen con la versión **del docente** (soluciones visibles); default alumno. Ocasión de emisión (AR-09). */
  showSolutions?: boolean | undefined
}

/**
 * Compila un documento Matex a **HTML** (segundo backend, LE-03). Devuelve un documento
 * standalone auto-contenido (matemática en MathML, gráficos en SVG embebido, CSS inline)
 * salvo que `standalone:false`, que devuelve solo el `<article class="mx-doc">…</article>`.
 */
export function compileToHtml(doc: MatexDoc, opts: HtmlOptions = {}): string {
  const meta = doc.meta ?? {}
  const presentation = documentFamily(meta) === 'presentation'
  const poster = posterMeta(meta)
  const ctx: Ctx = {
    refs: buildHtmlRefs(doc),
    footnotes: [],
    images: opts.images ?? {},
    widgetSeq: { n: 0 },
    needsRuntime: { on: false },
    // Versión del docente = ocasión de emisión (opts), no propiedad del documento (AR-09).
    showSolutions: opts.showSolutions === true,
  }

  // En presentación, el encabezado (título/autores) es la **primera diapositiva** del deck.
  const header = metaHeader(meta)
  const headerHtml = presentation && header ? `<section class="mx-slide mx-slide-title">${header}</section>` : header
  // Cierre de la carta: despedida + firma (y adjuntos/copias) tras el cuerpo.
  const l = letterMeta(meta)
  const letterClose = l
    ? [
        `<p class="mx-letter-closing">${esc(l.closing?.trim() || 'Saludos cordiales,')}</p>`,
        `<p class="mx-letter-sign">${esc(l.signature?.trim() || l.from?.trim() || '')}</p>`,
        l.encl?.trim() ? `<p class="mx-letter-encl">Adjuntos: ${esc(l.encl.trim())}</p>` : '',
        l.cc?.trim() ? `<p class="mx-letter-encl">Copia: ${esc(l.cc.trim())}</p>` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : ''
  const body = [
    headerHtml,
    poster ? posterBodyToHtml(doc.content, poster, ctx) : blocksToHtml(doc.content, ctx),
    letterClose,
    bibliographyToHtml(doc),
    footnotesToHtml(ctx),
  ]
    .filter((s) => s.length > 0)
    .join('\n')

  // Runtime de gráficos (ME-37): se embebe **una sola vez** si algún gráfico interactivo lo necesita.
  const runtime = ctx.needsRuntime.on ? `<script>${PLOT_RUNTIME_JS}</script>\n` : ''
  // **Modo presentación (ME-23 fase 4):** deck navegable — una diapositiva a la vez, flechas ←/→.
  // **Diseño semántico (LE-02) en el backend web.** El acento es una variable CSS y la familia
  // de diseño una clase: lo que en LaTeX es un `\usetheme`, acá es tipografía y filetes. Antes
  // esto era intraducible porque el AST guardaba nombres de temas de paquete.
  // `meta.columns` es un layout de **página** (LaTeX `twocolumn`). La web no tiene páginas: un
  // flujo de 2 columnas sobre todo el scroll es ilegible (bajás por la izquierda, volvés arriba
  // por la derecha). La proyección de calidad a HTML es **una columna reflowable**, como arXiv y
  // las revistas (PDF a 2 columnas, web a 1). No es un hueco: es cada medio en su mejor forma.
  const design = [
    meta.style && meta.style !== 'standard' ? `mx-style-${meta.style}` : '',
    meta.accent ? `mx-accent-${meta.accent}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const designClass = design ? ` ${design}` : ''
  const article = presentation
    ? `<article class="mx-doc mx-deck${designClass}">\n${body}\n<nav class="mx-deck-nav" contenteditable="false"><span class="mx-deck-count"></span></nav>\n${DECK_SCRIPT}\n</article>`
    : `<article class="mx-doc${designClass}">\n${body}\n</article>`
  if (opts.standalone === false) return `${runtime}${article}`

  const lang = 'es'
  const title = meta.title ? esc(meta.title) : 'Documento Matex'
  // `data-theme` fuerza el tema (light/dark); sin él ('auto') se adapta al lector.
  const themeAttr = opts.theme === 'light' || opts.theme === 'dark' ? ` data-theme="${opts.theme}"` : ''
  return `<!doctype html>
<html lang="${lang}"${themeAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${DOCUMENT_CSS}</style>
</head>
<body>
${runtime}${article}
</body>
</html>
`
}

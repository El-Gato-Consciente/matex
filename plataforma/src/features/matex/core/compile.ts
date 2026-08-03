// Import relativo (no el alias `@/`) a propósito: mantiene `matex-core` portable /
// headless, importable también fuera del bundler (p. ej. el backend en `verify-content`).
import { buildPreamble } from './latex/canon'
import { equationPlan } from './equation'
import { matexMacroPreamble } from './macros'
import { emitBibtex } from './bibtex'
import { cvMeta, documentFamily, examMeta, letterMeta, posterMeta } from './family'
import { distributePosterBlocks, posterColumns } from './poster'
import { escapeLabel, escapeLatex } from './graphics/util'
import { figureToLatex } from './graphics/figure'
import type {
  AccentColor,
  BlockNode,
  CalloutNode,
  CalloutVariant,
  CodeBlockNode,
  ColumnsNode,
  DerivationNode,
  DocKind,
  DocMeta,
  DocStyle,
  InlineNode,
  ListItemNode,
  MathDisplayNode,
  MatexDoc,
  Mark,
  ReasoningNode,
  SlideNode,
  TableNode,
} from './ast'

/**
 * Compilador **Matex → LaTeX**: función pura sobre el AST. Es "el activo" del
 * proyecto — headless, testeable, sin DOM. El preámbulo se **infiere del contenido**
 * reusando el canon (PISO siempre + EXTRA solo si se usa), así la salida cumple el
 * estándar (`estandares.tex`) y compila limpia.
 *
 * Cada tipo de nodo aporta su serialización acá; agregar un nodo nuevo = agregar su
 * caso + (si hace falta) sus requisitos de preámbulo, sin tocar los demás.
 *
 * **Decisiones de *completado* (política, NO están en el AST).** El compilador es
 * "opinado por defecto": rellena un andamiaje de documento a partir de un AST ralo.
 * Están **documentadas** en `matex/03-modelo-semantico/referencia-v1.md` §"Decisiones
 * de compilación". Las que viven acá (el resto vive en el canon): mapeo de nivel de
 * heading (`HEADING_CMD`), orden de anidado de marcas (`applyMarks`), regla de
 * ecuación numerada, `ref` vacío → marcador, `\maketitle` si hay título, e índice en
 * página propia. **Regla:** todo lo que se emita y no derive 1:1 de un nodo va también
 * a esa tabla.
 */

/** Requisitos de preámbulo que el contenido dispara (para el canon). */
interface Requirements {
  math: boolean
  /** Hay entornos tipo teorema → amsthm + declaraciones. */
  theorems: boolean
  /** Hay referencias cruzadas (`ref`) → hyperref + cleveref. */
  refs: boolean
  /** Hay tablas → booktabs (+tabularx). */
  tables: boolean
  /** Hay figuras → graphicx. */
  graphics: boolean
  patterns: boolean
  statistics: boolean
  /** Hay ≥1 diagrama conmutativo → tikz-cd. */
  diagram: boolean
  /** Hay ≥1 árbol → forest. */
  tree: boolean
  reasoning: boolean
  /** Hay bloques de código → listings. */
  code: boolean
  /** Hay ≥1 gráfico de **torta** → pgf-pie. */
  pie: boolean
  /** Hay ≥1 caja/callout → tcolorbox. */
  callout: boolean
  /** Hay ≥1 cita (`cite`) en la prosa. */
  hasCite: boolean
}

function collectRequirements(doc: MatexDoc): Requirements {
  const req: Requirements = { math: false, theorems: false, refs: false, tables: false, graphics: false, patterns: false, statistics: false, diagram: false, tree: false, reasoning: false, code: false, pie: false, callout: false, hasCite: false }

  const visitInline = (nodes: InlineNode[]): void => {
    for (const n of nodes) {
      if (n.type === 'mathInline') req.math = true
      // Un ref sin destino no dispara cleveref (se emite un marcador, no `\cref{}`).
      else if (n.type === 'ref' && n.target) req.refs = true
      else if (n.type === 'cite') req.hasCite = true
    }
  }
  const visitBlock = (b: BlockNode): void => {
    switch (b.type) {
      case 'mathDisplay':
      case 'derivation': // align* + \boxed + \text → amsmath
        req.math = true
        break
      case 'reasoning':
        // Layout de 2 columnas; sus celdas pueden traer cualquier bloque (math/figuras/tablas).
        req.reasoning = true // `\captionof` en celdas → paquete caption
        for (const row of b.rows) {
          row.left.forEach(visitBlock)
          row.right.forEach(visitBlock)
        }
        break
      case 'part':
      case 'heading':
      case 'paragraph':
        visitInline(b.content)
        break
      case 'bulletList':
      case 'orderedList':
        for (const item of b.items) item.content.forEach(visitBlock)
        break
      case 'theorem':
        req.theorems = true
        if (b.proves) req.refs = true // el encabezado usa \cref
        b.content.forEach(visitBlock)
        break
      case 'table':
        req.tables = true
        for (const row of b.rows) for (const cell of row.cells) visitInline(cell.content)
        break
      case 'figure':
        req.graphics = true
        for (const it of b.items) {
          // Un gráfico de funciones emite matemática ($…$) con macros de la casa (\abs…).
          if (it.kind === 'plot') {
            req.math = true
            if (it.spec.areas?.some((a) => a.pattern && a.pattern !== 'solid')) req.patterns = true
          }
          // La torta necesita pgf-pie (las barras salen con pgfplots, ya en GRAPHICS).
          else if (it.kind === 'chart' && it.spec.form === 'pie') req.pie = true
          // El boxplot necesita la librería `statistics` de pgfplots (el histograma no).
          else if (it.kind === 'distribution' && it.spec.form === 'boxplot') req.statistics = true
          // Un diagrama conmutativo necesita tikz-cd + matemática (las etiquetas son `tex`).
          else if (it.kind === 'diagram') {
            req.diagram = true
            req.math = true
          }
          // Un árbol necesita forest (las etiquetas pueden traer `$…$`, pero no fuerza math global).
          else if (it.kind === 'tree') req.tree = true
        }
        break
      case 'codeBlock':
        req.code = true
        break
      case 'callout':
        req.callout = true
        b.content.forEach(visitBlock)
        break
      case 'slide':
        b.content.forEach(visitBlock)
        break
      case 'columns':
        for (const col of b.columns) col.content.forEach(visitBlock)
        break
      case 'examQuestion':
        b.content.forEach(visitBlock)
        ;(b.solution ?? []).forEach(visitBlock)
        break
      case 'posterBlock':
        b.content.forEach(visitBlock)
        break
      case 'cvEntry':
      case 'include':
      case 'rawLatex':
        break
    }
  }
  doc.content.forEach(visitBlock)
  return req
}

/**
 * Contexto de **referencias cruzadas** (identidad estable). Se referencia el objeto
 * por su `id`; el compilador resuelve la clave `\label`/`\cref`: la **etiqueta custom**
 * si existe, si no el propio `id`. Solo emite `\label` en lo que está referenciado o
 * tiene etiqueta custom (el `.tex` no se llena de labels inútiles).
 */
export interface RefContext {
  /** Clave `\label` de un nodo referenciable, o `undefined` si no debe emitir. */
  labelKey: (node: { id?: string | undefined; label?: string | undefined }) => string | undefined
  /** Clave `\cref` para el `target` de una ref, o `undefined` si está colgada. */
  crefKey: (target: string) => string | undefined
  /**
   * **Sin floats**: dentro de una celda de razonamiento (minipage) los floats no caben, así que
   * figuras/tablas se emiten no-flotantes (`center` + `\captionof`). Default `false`.
   */
  noFloat?: boolean | undefined
  /**
   * **Comandos de sección según la clase**: `article` usa `\section/\subsection/\subsubsection`;
   * `report`/`book` empiezan en `\chapter`. Sin definir → el mapa de `article` (default).
   */
  headings?: Record<1 | 2 | 3, string> | undefined
  /**
   * **Modo presentación** (beamer): las columnas usan el entorno `columns`/`column` de beamer. En un
   * documento normal ese entorno no existe → se emiten `minipage` lado a lado.
   */
  presentation?: boolean | undefined
}

/**
 * Identidad del CV para moderncv: `
ame{nombre}{apellido}` (parte el autor por el último
 * espacio), subtítulo y datos de contacto seguros.
 */
function cvIdentityLatex(meta: DocMeta): string[] {
  const cv = cvMeta(meta)
  if (!cv) return []
  const full = (meta.author ?? '').trim()
  const cut = full.lastIndexOf(' ')
  const first = cut > 0 ? full.slice(0, cut) : full
  const last = cut > 0 ? full.slice(cut + 1) : ''
  const out = [`\\name{${escapeLatex(first)}}{${escapeLatex(last)}}`]
  const sub = cv.subtitle?.trim() || meta.title?.trim()
  if (sub) out.push(`\\title{${escapeLatex(sub)}}`)
  if (cv.address?.trim()) out.push(`\\address{${escapeLatex(cv.address.trim())}}{}{}`)
  if (cv.email?.trim()) out.push(`\\email{${escapeLatex(cv.email.trim())}}`)
  return out
}

/** Dirección de carta: cada línea del texto se separa con `\\` (salto dentro del bloque). */
function addressLatex(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => escapeLatex(line.trim()))
    .filter((line) => line.length > 0)
    .join(' \\\\ ')
}

/**
 * Mapa nivel→comando de sección según la **estructura** del documento (LE-02): un informe o
 * un libro abren en capítulos; un artículo, en secciones.
 */
function headingCmdsFor(docKind: DocKind | undefined): Record<1 | 2 | 3, string> {
  return docKind === 'report' || docKind === 'book'
    ? { 1: '\\chapter', 2: '\\section', 3: '\\subsection' }
    : HEADING_CMD
}

/* ── Del diseño semántico (LE-02) a lo que entiende cada paquete de LaTeX ──────────────── */

/** Clase base por estructura, en su variante estándar y en la de diseño `modern` (KOMA). */
const CLASS_BY_KIND: Record<DocKind, { standard: string; modern: string }> = {
  article: { standard: 'article', modern: 'scrartcl' },
  report: { standard: 'report', modern: 'scrreprt' },
  book: { standard: 'book', modern: 'scrbook' },
}

/** Tema de beamer por familia de diseño (`standard` = el default de beamer, sin `\usetheme`). */
const BEAMER_THEME: Record<DocStyle, string | undefined> = { standard: undefined, classic: 'Madrid', modern: 'metropolis' }

/** Tema de color de beamer por acento. */
const BEAMER_COLORTHEME: Record<AccentColor, string | undefined> = {
  red: 'beaver',
  blue: 'seahorse',
  orange: 'crane',
  purple: 'orchid',
  green: 'spruce',
  grey: 'lily',
  black: undefined,
}

/** Estilo de moderncv por familia de diseño. */
const CV_STYLE: Record<DocStyle, string> = { standard: 'banking', classic: 'classic', modern: 'casual' }

/** Tema de tikzposter por familia de diseño. */
const POSTER_THEME: Record<DocStyle, string> = { standard: 'Default', classic: 'Board', modern: 'Rays' }

/** Paleta de tikzposter por acento (las que trae el paquete). */
const POSTER_PALETTE: Record<AccentColor, string> = {
  blue: 'BlueGrayOrange',
  green: 'GreenGrayViolet',
  purple: 'PurpleGrayBlue',
  red: 'Default',
  orange: 'BlueGrayOrange',
  grey: 'Default',
  black: 'Default',
}

/** `\usetheme{X}` / `\usecolortheme{X}` solo si la familia de diseño pide uno. */
function themeCommands(cmd: string, theme: string | undefined): string[] {
  return theme ? [`${cmd}{${theme}}`] : []
}

/**
 * **La línea `\documentclass`, derivada** (LE-02). Antes venía cruda en el AST; ahora se
 * construye acá, que es el único lugar que debe saber cómo se llaman las clases de LaTeX.
 * El *modo* del documento (presentación/carta/examen/CV/póster) manda sobre la estructura,
 * porque cada uno tiene su clase propia.
 */
function documentclassLine(meta: DocMeta): string {
  const size = `${meta.baseFontSize ?? 11}pt`
  const paper = meta.paperSize === 'letter' ? 'letterpaper' : 'a4paper'
  // La precedencia entre familias vive en `documentFamily` (única fuente, compartida con la UI).
  switch (documentFamily(meta)) {
    case 'presentation':
      return '\\documentclass{beamer}'
    case 'letter':
      return `\\documentclass[${size},${paper}]{letter}`
    case 'exam':
      return `\\documentclass[${size},${paper},addpoints]{exam}`
    case 'cv':
      return `\\documentclass[${size},${paper},sans]{moderncv}`
    case 'poster':
      // El póster define su propio tamaño (A0): el papel del documento no aplica.
      return '\\documentclass[25pt,a0paper,portrait]{tikzposter}'
  }
  const cls = CLASS_BY_KIND[meta.docKind ?? 'article'][meta.style === 'modern' ? 'modern' : 'standard']
  // `twocolumn` (dos columnas de página) solo en la prosa normal; las familias tienen su layout.
  const opts = [size, paper, ...(meta.columns === 2 ? ['twocolumn'] : []), ...(meta.titlePage === true ? ['titlepage'] : [])]
  return `\\documentclass[${opts.join(',')}]{${cls}}`
}

function buildRefContext(doc: MatexDoc): RefContext {
  const referenced = new Set<string>()
  const idToKey = new Map<string, string>()
  const customLabels = new Set<string>()

  const scanInline = (nodes: InlineNode[]): void => {
    for (const n of nodes) if (n.type === 'ref' && n.target) referenced.add(n.target)
  }
  const scanRefable = (node: { id?: string | undefined; label?: string | undefined }): void => {
    if (node.label) customLabels.add(node.label)
    if (node.id) idToKey.set(node.id, node.label ?? node.id)
  }
  const scan = (b: BlockNode): void => {
    switch (b.type) {
      case 'part':
        scanRefable(b)
        scanInline(b.content)
        break
      case 'heading':
        scanRefable(b)
        scanInline(b.content)
        break
      case 'paragraph':
        scanInline(b.content)
        break
      case 'mathDisplay':
        for (const row of b.rows) scanRefable(row) // cada fila es referenciable
        break
      case 'bulletList':
      case 'orderedList':
        for (const item of b.items) item.content.forEach(scan)
        break
      case 'theorem':
        scanRefable(b)
        if (b.proves) referenced.add(b.proves) // el proof diferido referencia su teorema
        b.content.forEach(scan)
        break
      case 'callout':
        b.content.forEach(scan)
        break
      case 'slide':
        b.content.forEach(scan)
        break
      case 'columns':
        for (const col of b.columns) col.content.forEach(scan)
        break
      case 'examQuestion':
        b.content.forEach(scan)
        ;(b.solution ?? []).forEach(scan)
        break
      case 'reasoning':
        for (const row of b.rows) {
          row.left.forEach(scan)
          row.right.forEach(scan)
        }
        break
      case 'table':
        // Referenciable solo **con caption** (como las figuras): sin `\caption` no hay
        // número al que apuntar. Igual escaneamos las celdas por refs internas.
        if (b.caption) scanRefable(b)
        for (const row of b.rows) for (const cell of row.cells) scanInline(cell.content)
        break
      case 'figure':
        // Solo referenciable **con caption**: sin `\caption` no hay número al que apuntar,
        // así que sin él no se registra (una ref a esa figura queda colgada → marcador).
        if (b.caption) scanRefable(b)
        // Subfiguras (≥2 partes): cada parte con id/label es referenciable (\cref → «1a»).
        if (b.items.length >= 2) for (const item of b.items) scanRefable(item)
        break
      case 'posterBlock':
        b.content.forEach(scan)
        break
      case 'cvEntry':
      case 'rawLatex':
        break
    }
  }
  doc.content.forEach(scan)

  return {
    labelKey: (node) => (node.label ? node.label : node.id && referenced.has(node.id) ? node.id : undefined),
    crefKey: (target) => idToKey.get(target) ?? (customLabels.has(target) ? target : undefined),
  }
}

/** Aplica las marcas a un texto ya escapado (negrita como capa más externa). */
function applyMarks(escaped: string, marks: Mark[] = []): string {
  let out = escaped
  if (marks.includes('code')) out = `\\texttt{${out}}`
  if (marks.includes('emph')) out = `\\emph{${out}}`
  if (marks.includes('strong')) out = `\\textbf{${out}}`
  return out
}

function inlineToLatex(nodes: InlineNode[], ctx: RefContext): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
          return applyMarks(escapeLatex(n.text), n.marks)
        case 'mathInline':
          return `$${n.tex}$`
        case 'ref': {
          // Resolvemos el destino por identidad; sin resolver → marcador seguro
          // (evita el `\cref{}` fatal y señala una referencia colgada).
          const key = ctx.crefKey(n.target)
          return key ? `\\cref{${key}}` : '\\textbf{??}'
        }
        case 'cite': {
          // `\parencite`/`\textcite` (best practice biblatex, sensibles al contexto) sobre el
          // `\cite` pelado. Sin claves → marcador (evita un `\parencite{}` inútil).
          const keys = n.keys.map((k) => k.trim()).filter((k) => k.length > 0).join(',')
          if (!keys) return '\\textbf{??}'
          return n.style === 'textual' ? `\\textcite{${keys}}` : `\\parencite{${keys}}`
        }
        case 'footnote':
          return `\\footnote{${escapeLatex(n.text)}}`
      }
    })
    .join('')
}

// Política: nivel de heading → comando de sección. **Supone `article`** (sin
// `\chapter`). Con `report`/`book` habría que remapear (1→`\chapter`, …); ver la
// tabla de "Decisiones de compilación" en la Referencia.
const HEADING_CMD: Record<1 | 2 | 3, string> = {
  1: '\\section',
  2: '\\subsection',
  3: '\\subsubsection',
}

function listToLatex(env: 'itemize' | 'enumerate', items: ListItemNode[], ctx: RefContext, overlay = ''): string {
  const body = items
    .map((item) => {
      const content = blocksToLatex(item.content, ctx)
      // El primer bloque va pegado a \item; los siguientes (listas anidadas), debajo.
      return `  \\item ${content.replace(/\n/g, '\n  ')}`
    })
    .join('\n')
  // `overlay` (p. ej. `[<+->]`) = revelado incremental en beamer (ME-23 fase 2).
  return `\\begin{${env}}${overlay}\n${body}\n\\end{${env}}`
}

const ALIGN_CHAR: Record<string, string> = { left: 'l', center: 'c', right: 'r' }

/**
 * Tabla → `tabular` con **booktabs** (sin verticales, regla del canon). Encabezado
 * en negrita + `\midrule`. Con caption/label va en un flotante `table` **con el
 * caption abajo** (más prolijo: el `\abovecaptionskip` da aire; con el caption arriba
 * queda pegado por `\belowcaptionskip=0`); si no, centrada. `rules:'none'` omite reglas.
 */
function tableToLatex(node: TableNode, ctx: RefContext): string {
  const ncol = node.rows.reduce((max, row) => Math.max(max, row.cells.length), 0)
  if (ncol === 0) return ''
  const aligns = node.align ?? []
  const colspec = Array.from({ length: ncol }, (_, i) => ALIGN_CHAR[aligns[i] ?? 'left'] ?? 'l').join('')
  const rules = node.rules ?? 'horizontal'
  const booktabs = rules === 'horizontal'

  const renderRow = (row: TableRowNodeLike): string => {
    const cells = Array.from({ length: ncol }, (_, i) => (row.cells[i] ? inlineToLatex(row.cells[i]!.content, ctx) : ''))
    return `${cells.join(' & ')} \\\\`
  }

  // Contenido del tabular, indentado un nivel dentro de \begin/\end{tabular}. El
  // encabezado se distingue con `\midrule` (booktabs), **no** con negrita.
  const inner: string[] = []
  if (booktabs) inner.push('\\toprule')
  node.rows.forEach((row, i) => {
    inner.push(renderRow(row))
    if (booktabs && node.header === true && i === 0) inner.push('\\midrule')
  })
  if (booktabs) inner.push('\\bottomrule')
  const tabular = [
    `\\begin{tabular}{${colspec}}`,
    ...inner.map((l) => `  ${l}`),
    '\\end{tabular}',
  ]

  const labelKey = ctx.labelKey(node)
  if (node.caption || labelKey) {
    // Caption **abajo**, con \label pegado (como en LaTeX escrito a mano). Dentro de una celda
    // (noFloat) va como `center` + `\captionof{table}` (el float `table` no cabe en un minipage).
    const captionCmd = ctx.noFloat ? '\\captionof{table}' : '\\caption'
    const caption = node.caption ? `${captionCmd}{${escapeLatex(node.caption)}}` : ''
    const label = labelKey ? `\\label{${labelKey}}` : ''
    const body = ['\\centering', ...tabular, `${caption}${label}`].map((l) => `  ${l}`).join('\n')
    return ctx.noFloat ? `\\begin{center}\n${body}\n\\end{center}` : `\\begin{table}[htbp]\n${body}\n\\end{table}`
  }
  return `\\begin{center}\n${tabular.map((l) => `  ${l}`).join('\n')}\n\\end{center}`
}

type TableRowNodeLike = TableNode['rows'][number]

/**
 * Fórmula en bloque = filas. El entorno lo decide `equationPlan` (misma política que el
 * preview): 1 fila → `equation` (si lleva número/label) o `\[…\]`; ≥2 filas →
 * `align`/`gather` (según `aligned`) o su variante `*` si ninguna fila está numerada,
 * con `\notag` en las filas sin número y `\label` en las numeradas referenciadas.
 */
function mathDisplayToLatex(node: MathDisplayNode, ctx: RefContext): string {
  const rows = node.rows
  const plan = equationPlan(rows, node.aligned)
  if (!plan.multiline) {
    const row = rows[0]
    if (!row) return ''
    const key = ctx.labelKey(row)
    if (key || row.numbered) {
      const label = key ? `\n  \\label{${key}}` : ''
      return `\\begin{equation}\n  ${row.tex}${label}\n\\end{equation}`
    }
    return `\\[\n  ${row.tex}\n\\]`
  }
  const env = plan.starred ? `${plan.env}*` : plan.env
  const lines = rows.map((row, i) => {
    const parts = [row.tex]
    if (!plan.starred && row.numbered) {
      const key = ctx.labelKey(row)
      if (key) parts.push(`\\label{${key}}`)
    } else if (!plan.starred) {
      parts.push('\\notag') // fila sin número dentro de un entorno numerado
    }
    return `  ${parts.join(' ')}${i < rows.length - 1 ? ' \\\\' : ''}`
  })
  return `\\begin{${env}}\n${lines.join('\n')}\n\\end{${env}}`
}

/**
 * **Derivación** → `align*` con la matemática de cada paso (puede llevar `&` para alinear en el
 * `=`), su justificación a la derecha (`&& \text{…}`, con math inline permitido) y `\boxed` si el
 * paso va recuadrado. Título opcional en negrita arriba. (HTML lo renderiza distinto — ver LE-03.)
 */
function derivationToLatex(node: DerivationNode): string {
  const steps = node.steps.filter((s) => s.tex.trim() !== '')
  if (steps.length === 0) return node.title ? `\\noindent\\textbf{${escapeLatex(node.title)}}` : ''
  const rows = steps.map((s) => {
    // `\boxed` no admite el `&` de alineación adentro → se quita al recuadrar (como en el preview).
    let m = s.boxed ? `\\boxed{${s.tex.replace(/&/g, '')}}` : s.tex
    const hasNote = !!(s.note && s.note.trim())
    // La nota va en `&& \text{}` (columna de anotación). Para que esa columna quede SIEMPRE en la
    // misma posición (notas alineadas a la izquierda), cada paso con nota debe aportar un `&`: si el
    // paso no tiene punto de alineación propio, agregamos uno vacío. Sin esto, los pasos sin `&`
    // meten la nota en otra columna y las anotaciones quedan a distintas alturas horizontales.
    if (hasNote && !m.includes('&')) m += ' &'
    const note = hasNote ? ` && \\text{${escapeLabel(s.note!)}}` : ''
    return `  ${m}${note}`
  })
  const align = `\\begin{align*}\n${rows.join(' \\\\\n')}\n\\end{align*}`
  return node.title ? `\\noindent\\textbf{${escapeLatex(node.title)}}\\par\\vspace{2pt}\n${align}` : align
}

/**
 * **Razonamiento en dos columnas** → una **fila = dos `minipage`** (izq/der) con contenido de
 * bloque arbitrario; los floats de adentro salen no-flotantes (`ctx.noFloat`). `boxed` recuadra la
 * fila (`\fbox` de un minipage a lo ancho). Título en negrita arriba. (HTML: grid 2 columnas.)
 */
function reasoningToLatex(node: ReasoningNode, ctx: RefContext): string {
  const cellCtx: RefContext = { ...ctx, noFloat: true }
  // `\vspace*{0pt}` fuerza que la línea de referencia del `minipage[t]` sea su borde superior:
  // sin esto, cuando una celda empieza con matemática en display (o un `center`), el `[t]` toma
  // como referencia la mitad de la ecuación y la celda vecina "cae" hacia abajo (columnas desalineadas).
  const cell = (w: string, body: string): string => `\\begin{minipage}[t]{${w}\\textwidth}\\vspace*{0pt}\n${body}\n\\end{minipage}`
  const rowTex = (r: ReasoningNode['rows'][number]): string => {
    const left = blocksToLatex(r.left, cellCtx).trim() || '\\,'
    const right = blocksToLatex(r.right, cellCtx).trim() || '\\,'
    const pair = `${cell('0.55', left)}\\hfill\n${cell('0.4', right)}`
    return r.boxed
      ? `\\noindent\\fbox{\\begin{minipage}{\\dimexpr\\textwidth-2\\fboxsep-2\\fboxrule\\relax}\n${pair}\n\\end{minipage}}`
      : `\\noindent ${pair}`
  }
  const body = node.rows.map(rowTex).join('\n\n\\vspace{6pt}\n\n')
  return node.title ? `\\noindent\\textbf{${escapeLatex(node.title)}}\\par\\vspace{3pt}\n\n${body}` : body
}

function blockToLatex(node: BlockNode, ctx: RefContext): string {
  switch (node.type) {
    case 'part': {
      // La división más alta; LaTeX la numera en romanos. TeX lleva el número; solo emitimos label.
      const head = `\\part{${inlineToLatex(node.content, ctx)}}`
      const key = ctx.labelKey(node)
      return key ? `${head}\n\\label{${key}}` : head
    }
    case 'heading': {
      const head = `${(ctx.headings ?? HEADING_CMD)[node.level]}{${inlineToLatex(node.content, ctx)}}`
      const key = ctx.labelKey(node)
      return key ? `${head}\n\\label{${key}}` : head
    }
    case 'paragraph':
      return inlineToLatex(node.content, ctx)
    case 'bulletList':
      return listToLatex('itemize', node.items, ctx)
    case 'orderedList':
      return listToLatex('enumerate', node.items, ctx)
    case 'mathDisplay':
      return mathDisplayToLatex(node, ctx)
    case 'derivation':
      return derivationToLatex(node)
    case 'reasoning':
      return reasoningToLatex(node, ctx)
    case 'theorem': {
      // proof diferido: "Demostración del <ref>" (resuelto por identidad); si no, título.
      const provesKey = node.proves ? (ctx.crefKey(node.proves) ?? node.proves) : ''
      const opt =
        node.variant === 'proof' && provesKey
          ? `[\\proofname\\ del~\\cref{${provesKey}}]`
          : node.title
            ? `[${escapeLatex(node.title)}]`
            : ''
      const key = ctx.labelKey(node)
      const label = key ? `\n  \\label{${key}}` : ''
      const body = blocksToLatex(node.content, ctx).replace(/\n/g, '\n  ')
      return `\\begin{${node.variant}}${opt}${label}\n  ${body}\n\\end{${node.variant}}`
    }
    case 'table':
      return tableToLatex(node, ctx)
    case 'figure':
      return figureToLatex(node, ctx)
    case 'codeBlock':
      return codeBlockToLatex(node)
    case 'callout':
      return calloutToLatex(node, ctx)
    case 'include':
      // `\input` de un archivo del proyecto (escotilla file-based). Sin ruta → nada.
      return node.target.trim() ? `\\input{${node.target.trim()}}` : ''
    case 'rawLatex':
      return node.latex
    case 'slide':
      return slideToLatex(node, ctx)
    case 'columns':
      return columnsToLatex(node, ctx)
    case 'posterBlock':
      // `\block{título}{contenido}` de tikzposter. **Sin floats**: dentro de un bloque no cabe un
      // `figure`/`table` flotante ("Not in outer par mode") → se emiten centrados con `\captionof`,
      // igual que en las celdas de razonamiento.
      return `\\block{${escapeLatex((node.title ?? '').trim())}}{\n${blocksToLatex(node.content, { ...ctx, noFloat: true })}\n}`
    case 'cvEntry': {
      // `\cventry{periodo}{cargo}{organización}{lugar}{nota}{detalle}` (moderncv).
      const f = (v: string | undefined): string => escapeLatex((v ?? '').trim())
      return `\\cventry{${f(node.period)}}{${f(node.role)}}{${f(node.org)}}{${f(node.place)}}{}{${f(node.detail)}}`
    }
    case 'examQuestion': {
      // `\question[pts]` + la solución en su entorno (la clase `exam` la muestra u oculta).
      const pts = node.points != null && Number.isFinite(node.points) ? `[${node.points}]` : ''
      const body = blocksToLatex(node.content, ctx)
      const sol = node.solution && node.solution.length > 0 ? `\n\\begin{solution}\n${blocksToLatex(node.solution, ctx)}\n\\end{solution}` : ''
      return `\\question${pts} ${body}${sol}`
    }
  }
}

/**
 * Diapositiva → **frame** de beamer (modo presentación). `[fragile]` si contiene un bloque de código
 * (`lstlisting` lo exige). El título va como argumento del frame; el contenido son bloques anidados.
 */
function slideToLatex(node: SlideNode, ctx: RefContext): string {
  const fragile = node.content.some((b) => b.type === 'codeBlock') ? '[fragile]' : ''
  const title = node.title?.trim() ? `{${escapeLatex(node.title.trim())}}` : ''
  // Con `reveal`, las listas de primer nivel de la slide aparecen ítem por ítem (`[<+->]`).
  const body = node.content
    .map((b) =>
      node.reveal && b.type === 'bulletList'
        ? listToLatex('itemize', b.items, ctx, '[<+->]')
        : node.reveal && b.type === 'orderedList'
          ? listToLatex('enumerate', b.items, ctx, '[<+->]')
          : blockToLatex(b, ctx),
    )
    .join('\n\n')
  return `\\begin{frame}${fragile}${title}\n${body}\n\\end{frame}`
}

/**
 * Columnas (ME-23 fase 2) → contenido lado a lado. En **presentación** usa el entorno `columns` de
 * beamer; en un **documento** normal ese entorno no existe, así que se emiten `minipage` separadas
 * por `\hfill` (con una pequeña canaleta) — así una hoja de fórmulas a dos columnas también compila.
 */
function columnsToLatex(node: ColumnsNode, ctx: RefContext): string {
  const n = node.columns.length || 1
  const width = (ratio: number | undefined): number =>
    ratio && ratio > 0 && ratio < 1 ? ratio : Math.round((1 / n) * 100) / 100
  if (ctx.presentation) {
    const inner = node.columns
      .map((col) => `\\begin{column}{${width(col.ratio)}\\textwidth}\n${blocksToLatex(col.content, ctx)}\n\\end{column}`)
      .join('\n')
    return `\\begin{columns}[t]\n${inner}\n\\end{columns}`
  }
  // Canaleta: se descuenta del ancho para que las minipage entren en la línea.
  const gutter = 0.03
  const inner = node.columns
    .map((col) => {
      const w = Math.max(0.05, width(col.ratio) - gutter)
      return `\\begin{minipage}[t]{${Math.round(w * 1000) / 1000}\\textwidth}\n${blocksToLatex(col.content, ctx)}\n\\end{minipage}`
    })
    .join('\n\\hfill\n')
  return `\\noindent\n${inner}`
}

/**
 * Bloque de código → `lstlisting` (verbatim, **no se escapa**). `language` va como opción si
 * está; el cuerpo se emite tal cual entre `\begin{lstlisting}`/`\end{lstlisting}`.
 */
function codeBlockToLatex(node: CodeBlockNode): string {
  const lang = node.language?.trim() ? `[language=${node.language.trim()}]` : ''
  return `\\begin{lstlisting}${lang}\n${node.code}\n\\end{lstlisting}`
}

/** Colores de `tcolorbox` por variante (fondo suave + borde/título del color). */
const CALLOUT_STYLE: Record<CalloutVariant, string> = {
  note: 'colback=blue!5, colframe=blue!55!black',
  tip: 'colback=green!6, colframe=green!55!black',
  warning: 'colback=orange!8, colframe=orange!75!black',
  important: 'colback=red!5, colframe=red!70!black',
}

/**
 * Caja/callout → `tcolorbox` (con `breakable` para que corte entre páginas). El `title` (si hay)
 * lleva la barra de color; el contenido son bloques anidados.
 */
function calloutToLatex(node: CalloutNode, ctx: RefContext): string {
  const titleOpt = node.title ? `, title={${escapeLatex(node.title)}}, coltitle=white, fonttitle=\\bfseries` : ''
  const body = blocksToLatex(node.content, ctx).replace(/\n/g, '\n  ')
  return `\\begin{tcolorbox}[breakable, ${CALLOUT_STYLE[node.variant]}${titleOpt}]\n  ${body}\n\\end{tcolorbox}`
}

function blocksToLatex(blocks: BlockNode[], ctx: RefContext): string {
  return blocks.map((b) => blockToLatex(b, ctx)).join('\n\n')
}

/**
 * Contenido del `\author{…}` desde la portada. Con **autores estructurados** (`authors`):
 * cada uno `Nombre \\ {\small afiliación} \\ {\small \texttt{correo}}` (solo las partes
 * presentes), separados por `\and`. Si no, el `author` simple, con la `institution` general
 * debajo. `null` si no hay nada. (Layout pragmático sin paquetes extra; `authblk` es futuro.)
 */
function authorLatex(meta: DocMeta): string | null {
  if (meta.authors && meta.authors.length > 0) {
    const parts = meta.authors
      .filter((a) => a.name.trim() || a.affiliation || a.email)
      .map((a) => {
        const lines = [escapeLatex(a.name)]
        if (a.affiliation) lines.push(`{\\small ${escapeLatex(a.affiliation)}}`)
        if (a.email) lines.push(`{\\small \\texttt{${escapeLatex(a.email)}}}`)
        return lines.join(' \\\\ ')
      })
    if (parts.length > 0) return parts.join(' \\and ')
  }
  if (meta.author) {
    const lines = [escapeLatex(meta.author)]
    if (meta.institution) lines.push(`{\\small ${escapeLatex(meta.institution)}}`)
    return lines.join(' \\\\ ')
  }
  if (meta.institution) return `{\\small ${escapeLatex(meta.institution)}}`
  return null
}

/**
 * Compila un documento Matex a una fuente LaTeX completa y canónica.
 * `opts.bibFile`: si se da, la bibliografía usa un **archivo `.bib` real** (`\addbibresource`)
 * en vez de `filecontents` — el que llama debe crear ese archivo (proyecto multi-archivo).
 * `opts.showSolutions`: examen con la versión **del docente** (`\printanswers`); default alumno.
 * Es una **ocasión de emisión** (el mismo AST da las dos), no una propiedad del documento (AR-09).
 */
export function compileToLatex(doc: MatexDoc, opts: { bibFile?: string; showSolutions?: boolean } = {}): string {
  const meta = doc.meta ?? {}
  const presentation = documentFamily(meta) === 'presentation'
  const docStyle = meta.style ?? 'standard'
  const letter = letterMeta(meta)
  const exam = examMeta(meta)
  const cv = cvMeta(meta)
  const poster = posterMeta(meta)
  const req = collectRequirements(doc)
  // Biblioteca a nivel documento. Se carga biblatex si hay referencias o citas (una cita sin
  // biblioteca no debe dejar `\parencite` colgado; biblatex tolera la clave rota).
  const references = doc.references ?? []
  const needsBib = references.length > 0 || req.hasCite

  const preambleOptions: Parameters<typeof buildPreamble>[0] = {
    math: req.math ? 'basic' : 'none',
    theorems: req.theorems,
    tables: req.tables,
    graphics: req.graphics,
    patterns: req.patterns,
    statistics: req.statistics,
    diagram: req.diagram,
    tree: req.tree,
    reasoning: req.reasoning,
    pie: req.pie,
    code: req.code,
    callout: req.callout,
    ...(needsBib
      ? { bibliography: opts.bibFile ? { style: meta.bibStyle ?? 'numeric', file: opts.bibFile } : { style: meta.bibStyle ?? 'numeric', entries: emitBibtex(references) } }
      : {}),
    // beamer ya trae hyperref → no cargamos el bloque nav (evita doble hyperref); en article, sí.
    nav: presentation ? false : req.refs,
    // Macros Matex (\R, \abs, …) + `\usetheme` del tema beamer (modo presentación).
    extra: [
      // Presentación: la familia de diseño y el acento eligen el tema de beamer (LE-02).
      ...(presentation ? themeCommands('\\usetheme', BEAMER_THEME[docStyle]) : []),
      ...(presentation && meta.accent ? themeCommands('\\usecolortheme', BEAMER_COLORTHEME[meta.accent]) : []),
      // Examen: rótulos en español (la clase `exam` los trae en inglés) y una sola bandera que
      // decide si el MISMO documento sale con o sin soluciones.
      ...(exam
        ? ['\\pointpoints{punto}{puntos}', '\\renewcommand{\\solutiontitle}{\\noindent\\textbf{Solución:}\\enspace}']
        : []),
      ...(exam && opts.showSolutions === true ? ['\\printanswers'] : []),
      // CV (moderncv): estilo/color + identidad. Solo se emiten los campos de contacto **seguros**
      // (`\email`/`\address`): `\phone`/`\social` piden íconos que no siempre están instalados.
      ...(cv ? [`\\moderncvstyle{${CV_STYLE[docStyle]}}`, `\\moderncvcolor{${meta.accent ?? 'blue'}}`, ...cvIdentityLatex(meta)] : []),
      // Póster (tikzposter): tema y paleta de color, derivados del diseño semántico.
      ...(poster ? [`\\usetheme{${POSTER_THEME[docStyle]}}`, `\\usecolorpalette{${POSTER_PALETTE[meta.accent ?? 'blue']}}`] : []),
      ...(req.math ? matexMacroPreamble() : []),
    ],
  }
  // La clase se **deriva** del diseño semántico (LE-02): el AST ya no la trae escrita.
  preambleOptions.documentclass = documentclassLine(meta)
  // Márgenes → `geometry` (solo en documento; beamer maneja su propio layout).
  if (!presentation && meta.margin?.trim()) preambleOptions.geometry = meta.margin.trim()
  const preamble = buildPreamble(preambleOptions)

  const authors = authorLatex(meta)
  const titleLines: string[] = []
  if (letter) {
    // La carta no usa `\title`: declara remitente y firma en el preámbulo. Los saltos de línea
    // dentro de una dirección se emiten como `\\` (si no, todo quedaría en un renglón).
    const addr = [letter.from, letter.fromAddress].filter((s) => s?.trim()).map((s) => addressLatex(s!))
    if (addr.length > 0) titleLines.push(`\\address{${addr.join(' \\\\ ')}}`)
    const sign = letter.signature?.trim() || letter.from?.trim()
    if (sign) titleLines.push(`\\signature{${escapeLatex(sign)}}`)
    if (meta.date) titleLines.push(`\\date{${escapeLatex(meta.date)}}`)
  } else if (exam || cv || poster) {
    // Examen, CV y póster arman su propio encabezado en el cuerpo (moderncv con `\makecvtitle`,
    // tikzposter con su `\maketitle` propio, `exam` con un `center`). Igual el póster necesita
    // `\title`/`\author` declarados para que su `\maketitle` los use.
    if (poster) {
      if (meta.title) titleLines.push(`\\title{${escapeLatex(meta.title)}}`)
      if (authors) titleLines.push(`\\author{${authors}}`)
      if (meta.institution) titleLines.push(`\\institute{${escapeLatex(meta.institution)}}`)
    }
  } else {
    if (meta.title) titleLines.push(`\\title{${escapeLatex(meta.title)}}`)
    if (authors) titleLines.push(`\\author{${authors}}`)
    if (meta.date) titleLines.push(`\\date{${escapeLatex(meta.date)}}`)
  }

  // Los encabezados dependen de la clase: en `report`/`book` el nivel 1 es `\chapter`.
  const refCtx: RefContext = { ...buildRefContext(doc), headings: headingCmdsFor(meta.docKind), presentation }
  const bodyParts: string[] = []
  if (presentation) {
    // **Modo presentación** (beamer): frame de portada + un frame por diapositiva. Los bloques de
    // nivel superior que NO sean `slide` se envuelven cada uno en su propio frame (nada se pierde).
    if (meta.title || authors) bodyParts.push('\\begin{frame}[plain]\n\\titlepage\n\\end{frame}')
    if (meta.toc) bodyParts.push('\\begin{frame}{Contenidos}\n\\tableofcontents\n\\end{frame}')
    for (const block of doc.content) {
      bodyParts.push(block.type === 'slide' ? blockToLatex(block, refCtx) : `\\begin{frame}\n${blockToLatex(block, refCtx)}\n\\end{frame}`)
    }
    // Bibliografía como último frame (con corte automático si es larga).
    if (references.length > 0) {
      const t = meta.bibTitle ? escapeLatex(meta.bibTitle) : 'Referencias'
      bodyParts.push(`\\begin{frame}[allowframebreaks]{${t}}\n\\printbibliography[heading=none]\n\\end{frame}`)
    }
  } else if (poster) {
    // **Modo póster** (tikzposter): título propio y los bloques repartidos en columnas. Un bloque
    // puede fijar su `column`; los demás se distribuyen en orden para que queden parejas.
    bodyParts.push('\\maketitle')
    const cols = posterColumns(poster)
    const blocks = doc.content.filter((b) => b.type === 'posterBlock')
    const others = doc.content.filter((b) => b.type !== 'posterBlock')
    if (blocks.length > 0) {
      // El reparto es semántico y compartido con el backend HTML (ver `poster.ts`).
      const buckets = distributePosterBlocks(blocks, cols)
      const width = Math.round((1 / cols) * 1000) / 1000
      const inner = buckets.map((col) => `\\column{${width}}\n${col.map((b) => blockToLatex(b, refCtx)).join('\n')}`).join('\n')
      bodyParts.push(`\\begin{columns}\n${inner}\n\\end{columns}`)
    }
    for (const b of others) bodyParts.push(blockToLatex(b, refCtx))
  } else if (cv) {
    // **Modo CV**: portada propia de moderncv (`\makecvtitle`) y luego secciones y entradas.
    bodyParts.push('\\makecvtitle')
    if (doc.content.length > 0) bodyParts.push(blocksToLatex(doc.content, refCtx))
  } else if (exam) {
    // **Modo examen**: encabezado + consigna, y las preguntas agrupadas en `questions`
    // (las corridas de `examQuestion` se envuelven; el resto de bloques va tal cual).
    if (meta.title) bodyParts.push(`\\begin{center}\n{\\large\\bfseries ${escapeLatex(meta.title)}}\n\\end{center}`)
    if (exam.instructions?.trim()) bodyParts.push(`\\noindent ${escapeLatex(exam.instructions.trim())}\n\n\\vspace{8pt}`)
    let run: string[] = []
    const flush = (): void => {
      if (run.length > 0) bodyParts.push(`\\begin{questions}\n${run.join('\n\n')}\n\\end{questions}`)
      run = []
    }
    for (const block of doc.content) {
      if (block.type === 'examQuestion') run.push(blockToLatex(block, refCtx))
      else {
        flush()
        bodyParts.push(blockToLatex(block, refCtx))
      }
    }
    flush()
  } else if (letter) {
    // **Modo carta**: el contenido es el cuerpo, entre el saludo y la despedida.
    const dest = [letter.to, letter.toAddress].filter((s) => s?.trim()).map((s) => addressLatex(s!))
    const inner: string[] = [`\\opening{${escapeLatex(letter.opening?.trim() || 'Estimado/a:')}}`]
    if (doc.content.length > 0) inner.push(blocksToLatex(doc.content, refCtx))
    inner.push(`\\closing{${escapeLatex(letter.closing?.trim() || 'Saludos cordiales,')}}`)
    if (letter.encl?.trim()) inner.push(`\\encl{${escapeLatex(letter.encl.trim())}}`)
    if (letter.cc?.trim()) inner.push(`\\cc{${escapeLatex(letter.cc.trim())}}`)
    bodyParts.push(`\\begin{letter}{${dest.length > 0 ? dest.join(' \\\\ ') : '~'}}\n${inner.join('\n\n')}\n\\end{letter}`)
  } else {
    const hasTitle = !!(meta.title || authors)
    const abstract = meta.abstract?.trim() ? `\\begin{abstract}\n${escapeLatex(meta.abstract.trim())}\n\\end{abstract}` : ''
    if (meta.columns === 2 && (hasTitle || abstract)) {
      // Dos columnas: el título y el resumen **cruzan** ambas columnas (`\twocolumn[…]`), y el
      // texto fluye continuo debajo. Es el look estándar de paper — y lo que hace converger el
      // PDF con el HTML (que cruza el header por CSS). Sin esto, el título quedaría en 1 columna.
      bodyParts.push(`\\twocolumn[{%\n${[hasTitle ? '\\maketitle' : '', abstract].filter(Boolean).join('\n')}\n}]`)
    } else {
      // `\maketitle` si hay algo de portada (título o autores).
      if (hasTitle) bodyParts.push('\\maketitle')
      // Resumen tras la portada.
      if (abstract) bodyParts.push(abstract)
    }
    // El índice va tras la portada y **en su propia página** (default opinado, capa 3):
    // `\clearpage` no crea página en blanco si ya estamos al inicio de una.
    if (meta.toc) bodyParts.push('\\clearpage\n\\tableofcontents\n\\clearpage')
    if (doc.content.length > 0) bodyParts.push(blocksToLatex(doc.content, refCtx))
    // La lista de referencias se imprime al final (posición estándar de `\printbibliography`);
    // el título lo da `meta.bibTitle` si se definió.
    if (references.length > 0) {
      bodyParts.push(meta.bibTitle ? `\\printbibliography[title={${escapeLatex(meta.bibTitle)}}]` : '\\printbibliography')
    }
  }

  return [
    ...preamble,
    ...(titleLines.length > 0 ? ['', ...titleLines] : []),
    '',
    '\\begin{document}',
    '',
    bodyParts.join('\n\n'),
    '',
    '\\end{document}',
    '',
  ].join('\n')
}

/**
 * Canon de preámbulo de la plataforma — **fuente única de verdad**, espejo de
 * `latex/estandares/estandares.tex`. Define "nuestra manera" de armar un preámbulo
 * LaTeX, en niveles, para que los ejemplos del curso, la galería y las plantillas
 * sean coherentes y de primer nivel.
 *
 * Principio rector (del estándar): **PISO vs EXTRA**, no "cargar todo". El PISO va
 * en todo documento real en español (es gratis y evita bugs); lo demás se agrega
 * **solo si el contenido lo usa** (cargar paquetes sin usar también es anti-patrón).
 *
 * Los fragmentos son **líneas** (`string[]`) para componerse con el estilo de
 * autoría de las lecciones (arrays unidos con `\n`). `buildPreamble` los ordena.
 */

/** Una línea de `\usepackage` con comentario opcional alineado al estilo del estándar. */
function pkg(line: string, comment?: string): string {
  return comment ? `${line.padEnd(38)}% ${comment}` : line
}

/**
 * PISO en español: lo que el estándar manda "siempre". `fontenc[T1]` (acentos que
 * se copian y guionado), `lmodern` (fuentes vectoriales, requisito de microtype),
 * `babel` con **`es-noshorthands`** (desactiva los shorthands de "/~/. que rompen
 * tikz/siunitx/URLs) y `microtype` (pulido casi gratis). `inputenc` se omite a
 * propósito: es redundante desde 2018 (entrada UTF-8 por defecto).
 */
export const PISO_ES: readonly string[] = [
  '\\usepackage[T1]{fontenc}',
  '\\usepackage{lmodern}',
  '\\usepackage[spanish,es-noshorthands]{babel}',
  '\\usepackage{microtype}',
]

/** Comillas tipográficas por idioma con `\enquote{...}` (en vez de ``...'' a mano). */
export const CSQUOTES: readonly string[] = ['\\usepackage{csquotes}']

/** Matemática básica: `amsmath` + símbolos. Para el primer contacto con math. */
export const MATH_BASIC: readonly string[] = ['\\usepackage{amsmath,amssymb}']

/**
 * Matemática completa: `mathtools` (superconjunto de amsmath: `\coloneqq`,
 * `\DeclarePairedDelimiter`, fixes) — el estándar pide mathtools, **no** amsmath
 * solo — más teoremas, negrita matemática y números/unidades.
 */
export const MATH_FULL: readonly string[] = [
  '\\usepackage{mathtools}',
  '\\usepackage{amssymb}',
  '\\usepackage{amsthm}',
  '\\usepackage{bm}',
  '\\usepackage{siunitx}',
]

/**
 * Entornos tipo teorema con `amsthm`: estilo + declaraciones estándar en español,
 * numeradas por sección y compartiendo contador (`[theorem]`). `proof` ya viene en
 * amsthm (babel-spanish lo titula "Demostración"). Va en `extra` (antes de la
 * navegación) para que `cleveref` detecte los entornos.
 */
export const THEOREMS: readonly string[] = [
  '\\usepackage{amsthm}',
  '\\theoremstyle{plain}',
  '\\newtheorem{theorem}{Teorema}[section]',
  '\\newtheorem{lemma}[theorem]{Lema}',
  '\\newtheorem{proposition}[theorem]{Proposición}',
  '\\newtheorem{corollary}[theorem]{Corolario}',
  '\\theoremstyle{definition}',
  '\\newtheorem{definition}[theorem]{Definición}',
  '\\newtheorem{example}[theorem]{Ejemplo}',
  '\\theoremstyle{remark}',
  '\\newtheorem*{remark}{Observación}',
]

/** Tablas con la regla de oro: `booktabs` (sin verticales) + anchos con `tabularx`. */
export const TABLES: readonly string[] = ['\\usepackage{booktabs}', '\\usepackage{tabularx}']

/** Gráficos: imágenes + funciones/datos con `pgfplots` (compat **fijado**). */
export const GRAPHICS: readonly string[] = [
  '\\usepackage{graphicx}',
  '\\usepackage{pgfplots}',
  '\\pgfplotsset{compat=1.18}',
  '\\usepgfplotslibrary{fillbetween}', // área entre curvas
  '\\usepackage{caption}',
  '\\usepackage{subcaption}',
]

/**
 * Código fuente con `listings` (LaTeX **puro**, sin `--shell-escape` — a diferencia de
 * `minted`, seguro para el backend). `breaklines` corta líneas largas; `\ttfamily` monoespaciada.
 */
export const CODE: readonly string[] = [
  '\\usepackage{listings}',
  // `literate={…}`: mapea acentos/ñ/ü para que `listings` renderice UTF-8 (sin él falla con
  // "Invalid UTF-8 byte sequence"; **no** usar `extendedchars`, que es lo que dispara ese error).
  `\\lstset{basicstyle=\\ttfamily\\footnotesize,breaklines=true,frame=single,showstringspaces=false,columns=flexible,tabsize=2,literate={á}{{\\'a}}1 {é}{{\\'e}}1 {í}{{\\'i}}1 {ó}{{\\'o}}1 {ú}{{\\'u}}1 {ñ}{{\\~n}}1 {Á}{{\\'A}}1 {É}{{\\'E}}1 {Í}{{\\'I}}1 {Ó}{{\\'O}}1 {Ú}{{\\'U}}1 {Ñ}{{\\~N}}1 {ü}{{\\"u}}1 {Ü}{{\\"U}}1}}`,
]

/** Gráficos de **torta** con `pgf-pie` (encima de tikz; complementa `GRAPHICS`/pgfplots). */
export const PIE: readonly string[] = ['\\usepackage{pgf-pie}']

/** Cajas/callouts con `tcolorbox` (+`breakable` para cortar entre páginas). */
export const CALLOUT: readonly string[] = ['\\usepackage{tcolorbox}', '\\tcbuselibrary{breakable}']

/** Margen con `geometry` (no tocar `\textwidth` a mano). */
export function geometry(margin = '2.5cm'): readonly string[] {
  return [`\\usepackage[a4paper,margin=${margin}]{geometry}`]
}

/**
 * Navegación: `hyperref` casi al final y `cleveref` **último de todo** (única excepción
 * al "hyperref último"; cleveref debe cargarse el último para parchear las refs de los
 * demás paquetes). Entre ambos puede ir `biblatex` (ver `buildPreamble`).
 */
export const HYPERREF = '\\usepackage[hidelinks]{hyperref}'
export const CLEVEREF = '\\usepackage[spanish,capitalise,nameinlink]{cleveref}'
export const NAV: readonly string[] = [HYPERREF, CLEVEREF]

/** Estilo de citas/bibliografía biblatex (espejo de `BibStyle` del AST). */
export type BibStyle = 'numeric' | 'authoryear' | 'alphabetic'

/**
 * Bloque **bibliografía** (best practice: `biblatex` + `biber`, no `thebibliography`
 * legacy). Emite el paquete + un `.bib` **real** vía `filecontents` (`[overwrite]` para
 * que las ediciones se propaguen en cada corrida) + `\addbibresource`. Autocontenido en
 * un solo `.tex` mientras no exista multi-archivo (ME-12); cuando exista, el `.bib` sale
 * a un archivo aparte. Se carga **después de `hyperref`** (requisito de biblatex para
 * hipervínculos de cita) y **antes de `cleveref`**.
 */
export function biblatexBlock(style: BibStyle, source: { entries: string } | { file: string }): string[] {
  const pkg = `\\usepackage[backend=biber,style=${style}]{biblatex}`
  // Archivo `.bib` real (proyecto multi-archivo) vs `filecontents` embebido (autocontenido).
  if ('file' in source) return [pkg, `\\addbibresource{${source.file}}`]
  return [pkg, '\\begin{filecontents}[overwrite]{\\jobname.bib}', source.entries, '\\end{filecontents}', '\\addbibresource{\\jobname.bib}']
}

export interface PreambleOptions {
  /** Línea completa de `\documentclass`. Por defecto `article` 11pt a4. */
  documentclass?: string
  /**
   * Portada en página propia: agrega la opción `titlepage` a la **clase por
   * defecto**. Se ignora si se pasa `documentclass` propio (es responsabilidad tuya).
   */
  titlePage?: boolean
  /** Incluir el PISO en español (default true). Solo se apaga en "primer contacto". */
  piso?: boolean
  /** `\usepackage{csquotes}` para `\enquote`. */
  csquotes?: boolean
  /** Nivel de matemática a cargar. */
  math?: 'none' | 'basic' | 'full'
  /** Entornos tipo teorema (`amsthm` + declaraciones en español). */
  theorems?: boolean
  /** Tablas (`booktabs`+`tabularx`). */
  tables?: boolean
  /** Gráficos (`graphicx`+`pgfplots`). */
  graphics?: boolean
  /** Rellenos con textura en las áreas (`\usetikzlibrary{patterns}`). */
  patterns?: boolean
  /** Boxplots (`\usepgfplotslibrary{statistics}`). */
  statistics?: boolean
  /** Razonamiento en 2 columnas: `\captionof` en celdas necesita el paquete `caption`. */
  reasoning?: boolean
  /** Diagramas conmutativos (Dominio B): `\usepackage{tikz-cd}`. */
  diagram?: boolean
  /** Árboles (Dominio B): `\usepackage{forest}`. */
  tree?: boolean
  /** Bloques de código (`listings`). */
  code?: boolean
  /** Gráficos de torta (`pgf-pie`). */
  pie?: boolean
  /** Cajas/callouts (`tcolorbox`). */
  callout?: boolean
  /** Bibliografía biblatex+biber: `entries` (embebidas vía `filecontents`, autocontenido) **o**
   *  `file` (archivo `.bib` real del proyecto → `\addbibresource{file}`). */
  bibliography?: { style: BibStyle; entries: string } | { style: BibStyle; file: string }
  /** Margen con `geometry` (string = margen; true = 2.5cm; falsy = no cargar). */
  geometry?: string | boolean
  /** Navegación (`hyperref`+`cleveref`), siempre como bloque final. */
  nav?: boolean
  /** Líneas extra (paquetes propios del tema) que van **antes** de la navegación. */
  extra?: readonly string[]
}

/**
 * Arma un preámbulo en el **orden canónico**: clase → PISO → idioma extra → diseño →
 * matemática → tablas → gráficos → extras del tema → navegación (último). Devuelve
 * las líneas (sin `\begin{document}`), listas para unir con `\n`.
 */
export function buildPreamble(options: PreambleOptions = {}): string[] {
  const {
    documentclass,
    titlePage = false,
    piso = true,
    csquotes = false,
    math = 'none',
    theorems = false,
    tables = false,
    graphics = false,
    patterns = false,
    statistics = false,
    reasoning = false,
    diagram = false,
    tree = false,
    pie = false,
    code = false,
    callout = false,
    bibliography,
    geometry: geom = false,
    nav = false,
    extra = [],
  } = options

  // La clase por defecto se **arma acá** (única fuente): 11pt a4, +`titlepage` si se pide.
  const cls = documentclass ?? `\\documentclass[11pt,a4paper${titlePage ? ',titlepage' : ''}]{article}`
  const lines: string[] = [cls]
  if (piso) lines.push(...PISO_ES)
  // `biblatex` con babel **recomienda** `csquotes` (comillas de cita correctas); lo cargamos
  // siempre que haya bibliografía para no dejar el aviso "csquotes missing".
  if (csquotes || bibliography) lines.push(...CSQUOTES)
  if (geom) lines.push(...geometry(typeof geom === 'string' ? geom : undefined))
  if (math === 'basic') lines.push(...MATH_BASIC)
  if (math === 'full') lines.push(...MATH_FULL)
  // `amsthm` ya viene en MATH_FULL: si está, solo agregamos las declaraciones.
  if (theorems) lines.push(...(math === 'full' ? THEOREMS.slice(1) : THEOREMS))
  if (tables) lines.push(...TABLES)
  if (graphics) lines.push(...GRAPHICS)
  if (patterns) lines.push('\\usetikzlibrary{patterns}')
  if (statistics) lines.push('\\usepgfplotslibrary{statistics}')
  if (diagram) lines.push('\\usepackage{tikz-cd}')
  if (tree) lines.push('\\usepackage{forest}')
  if (reasoning && !graphics) lines.push('\\usepackage{caption}') // \captionof en celdas (graphics ya lo trae)
  if (pie) lines.push(...PIE)
  if (callout) lines.push(...CALLOUT)
  if (code) lines.push(...CODE)
  lines.push(...extra)
  // Cierre: hyperref → biblatex → cleveref. biblatex va tras hyperref (hipervínculos de
  // cita) y cleveref queda el último de todo (parchea las refs de los demás paquetes).
  if (nav) lines.push(HYPERREF)
  if (bibliography) lines.push(...biblatexBlock(bibliography.style, 'file' in bibliography ? { file: bibliography.file } : { entries: bibliography.entries }))
  if (nav) lines.push(CLEVEREF)
  return lines
}

/** Referencia: `pkg` se exporta por si una lección quiere comentar un paquete propio. */
export { pkg }

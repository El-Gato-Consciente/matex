import katex from 'katex'
import { matexKatexMacros } from '../core'

/**
 * **Asistente de fórmulas**: una paleta de símbolos y plantillas típicas para *componer*
 * matemática desde el editor (en línea y en bloque). Cada botón muestra el símbolo
 * renderizado (KaTeX) e inserta su LaTeX en el cursor — así se ve, se usa y se aprende
 * el comando. Es puro DOM (los node views de matemática son vanilla, sin React).
 */

const MACROS = matexKatexMacros()

interface PaletteItem {
  /** LaTeX que se **muestra** en el botón (con ejemplo, p. ej. `\frac{a}{b}`). */
  display: string
  /** LaTeX que se **inserta** (con `{}` vacías donde va el cursor). */
  insert: string
  title?: string
  /** Palabras clave extra para el buscador (además del título y el comando). */
  kw?: string
}
interface PaletteCategory {
  name: string
  items: PaletteItem[]
}

// Helpers para no repetir. `sym`: símbolo suelto (display === insert). `symk`: con keywords de búsqueda.
const sym = (cmd: string): PaletteItem => ({ display: cmd, insert: cmd })
const symk = (cmd: string, kw: string): PaletteItem => ({ display: cmd, insert: cmd, kw })

// Todo lo que sigue está en **amsmath + amssymb** (que el compilador siempre carga) → seguro en el PDF.
const CATEGORIES: PaletteCategory[] = [
  {
    name: 'Común',
    items: [
      { display: '\\frac{a}{b}', insert: '\\frac{}{}', title: 'Fracción', kw: 'division cociente' },
      { display: 'x^{n}', insert: '^{}', title: 'Potencia', kw: 'exponente super' },
      { display: 'x_{i}', insert: '_{}', title: 'Subíndice', kw: 'indice sub' },
      { display: '\\sqrt{x}', insert: '\\sqrt{}', title: 'Raíz', kw: 'raiz cuadrada' },
      { display: '\\sqrt[n]{x}', insert: '\\sqrt[]{}', title: 'Raíz n-ésima', kw: 'raiz enesima' },
      { display: '\\int_{a}^{b}', insert: '\\int_{}^{}', title: 'Integral', kw: 'integral' },
      { display: '\\sum_{i=1}^{n}', insert: '\\sum_{}^{}', title: 'Sumatoria', kw: 'suma sumatoria' },
      { display: '\\prod_{i=1}^{n}', insert: '\\prod_{}^{}', title: 'Productoria', kw: 'producto productoria' },
      { display: '\\lim_{x\\to a}', insert: '\\lim_{ \\to }', title: 'Límite', kw: 'limite' },
      { display: '\\frac{d}{dx}', insert: '\\frac{d}{d}', title: 'Derivada', kw: 'derivada' },
      { display: '\\binom{n}{k}', insert: '\\binom{}{}', title: 'Combinatorio', kw: 'combinatorio binomial' },
      symk('\\infty', 'infinito'), symk('\\pm', 'mas menos'), symk('\\cdot', 'por producto'), symk('\\leq', 'menor igual'), symk('\\geq', 'mayor igual'), symk('\\neq', 'distinto'),
    ],
  },
  {
    name: 'Lógica',
    items: [
      symk('\\neg', 'no negacion'),
      symk('\\land', 'y conjuncion'),
      symk('\\lor', 'o disyuncion'),
      symk('\\veebar', 'xor o exclusivo'),
      symk('\\implies', 'implica entonces'),
      symk('\\impliedby', 'si implicado por'),
      symk('\\iff', 'si y solo si equivalente doble'),
      symk('\\Rightarrow', 'implica entonces'),
      symk('\\Leftarrow', 'implicado'),
      symk('\\Leftrightarrow', 'equivale bicondicional'),
      symk('\\forall', 'para todo cuantificador universal'),
      symk('\\exists', 'existe cuantificador existencial'),
      symk('\\nexists', 'no existe'),
      symk('\\therefore', 'por lo tanto entonces'),
      symk('\\because', 'porque ya que dado'),
      symk('\\top', 'verdadero tautologia'),
      symk('\\bot', 'falso contradiccion'),
      symk('\\vdash', 'deduce demuestra sintactico'),
      symk('\\dashv', 'reves deduce'),
      symk('\\models', 'satisface modela semantico'),
      symk('\\vDash', 'satisface modela'),
      symk('\\nvdash', 'no deduce'),
      symk('\\square', 'necesario caja modal'),
      symk('\\Diamond', 'posible modal'),
      symk('\\equiv', 'equivalente logico'),
    ],
  },
  {
    name: 'Relaciones',
    items: [
      symk('\\leq', 'menor o igual'), symk('\\geq', 'mayor o igual'), symk('\\neq', 'distinto'),
      symk('\\ll', 'mucho menor'), symk('\\gg', 'mucho mayor'),
      symk('\\prec', 'precede'), symk('\\succ', 'sigue'), symk('\\preceq', ''), symk('\\succeq', ''),
      symk('\\approx', 'aproximado'), symk('\\simeq', 'aproximado'), symk('\\cong', 'congruente'), symk('\\equiv', 'equivalente'),
      symk('\\sim', 'similar'), symk('\\propto', 'proporcional'), symk('\\doteq', 'definido igual'), symk('\\asymp', 'asintotico'),
      symk('\\nleq', 'no menor igual'), symk('\\ngeq', 'no mayor igual'), symk('\\nless', 'no menor'), symk('\\ngtr', 'no mayor'),
      symk('\\lesssim', 'menor o aprox'), symk('\\gtrsim', 'mayor o aprox'), symk('\\bowtie', 'moño'),
      symk('\\perp', 'perpendicular'), symk('\\parallel', 'paralelo'), symk('\\nparallel', 'no paralelo'), symk('\\mid', 'divide tal que'), symk('\\nmid', 'no divide'),
    ],
  },
  {
    name: 'Conjuntos',
    items: [
      symk('\\in', 'pertenece elemento'), symk('\\notin', 'no pertenece'), symk('\\ni', 'contiene elemento'),
      symk('\\subset', 'subconjunto'), symk('\\subseteq', 'subconjunto o igual'), symk('\\subsetneq', 'subconjunto propio'),
      symk('\\supset', 'superconjunto'), symk('\\supseteq', 'superconjunto o igual'), symk('\\supsetneq', 'superconjunto propio'),
      symk('\\cup', 'union'), symk('\\cap', 'interseccion'), symk('\\setminus', 'diferencia menos'),
      symk('\\bigcup', 'union grande'), symk('\\bigcap', 'interseccion grande'), symk('\\sqcup', 'union disjunta'), symk('\\sqcap', ''), symk('\\uplus', 'union multiconjunto'),
      symk('\\varnothing', 'conjunto vacio'), symk('\\emptyset', 'vacio'), symk('\\complement', 'complemento'),
      symk('\\aleph', 'alef cardinal'), symk('\\wp', 'partes weierstrass'),
    ],
  },
  {
    name: 'Operadores',
    items: [
      symk('\\times', 'por cruz producto'), symk('\\cdot', 'punto por'), symk('\\pm', 'mas menos'), symk('\\mp', 'menos mas'), symk('\\div', 'division'),
      symk('\\ast', 'asterisco'), symk('\\star', 'estrella'), symk('\\circ', 'composicion'), symk('\\bullet', 'punto'),
      symk('\\oplus', 'suma directa xor'), symk('\\ominus', ''), symk('\\otimes', 'producto tensorial'), symk('\\odot', ''),
      symk('\\wedge', 'y cuña'), symk('\\vee', 'o'), symk('\\amalg', 'coproducto'), symk('\\wr', 'producto corona'),
      symk('\\bigoplus', 'suma directa grande'), symk('\\bigotimes', 'tensor grande'), symk('\\bigodot', ''), symk('\\coprod', 'coproducto'),
      symk('\\partial', 'parcial'), symk('\\nabla', 'nabla gradiente'), symk('\\Re', 'parte real'), symk('\\Im', 'parte imaginaria'),
      symk('\\hbar', 'h barra planck'), symk('\\ell', 'ele'), symk('\\prime', 'prima'), symk('\\surd', 'radical raiz'),
      symk('\\cdots', 'puntos centrados'), symk('\\ldots', 'puntos'), symk('\\vdots', 'puntos verticales'), symk('\\ddots', 'puntos diagonales'),
    ],
  },
  {
    name: 'Cálculo',
    items: [
      { display: '\\int', insert: '\\int ', title: 'Integral', kw: 'integral' },
      { display: '\\int_{a}^{b}', insert: '\\int_{}^{} \\, d', title: 'Integral definida', kw: 'integral definida' },
      { display: '\\iint', insert: '\\iint ', title: 'Integral doble', kw: 'doble' },
      { display: '\\iiint', insert: '\\iiint ', title: 'Integral triple', kw: 'triple' },
      { display: '\\oint', insert: '\\oint ', title: 'Integral de línea', kw: 'circulacion contorno' },
      { display: '\\lim_{x\\to a}', insert: '\\lim_{ \\to }', title: 'Límite', kw: 'limite' },
      { display: '\\limsup', insert: '\\limsup_{}', title: 'Límite superior', kw: 'limite superior' },
      { display: '\\liminf', insert: '\\liminf_{}', title: 'Límite inferior', kw: 'limite inferior' },
      { display: '\\frac{d}{dx}', insert: '\\frac{d}{d}', title: 'Derivada', kw: 'derivada' },
      { display: '\\frac{\\partial}{\\partial x}', insert: '\\frac{\\partial}{\\partial }', title: 'Derivada parcial', kw: 'parcial' },
      { display: "f'(x)", insert: "'(", title: 'Primada', kw: 'derivada prima' },
      { display: '\\sum_{i=1}^{n}', insert: '\\sum_{}^{}', title: 'Sumatoria', kw: 'suma' },
      { display: '\\prod_{i=1}^{n}', insert: '\\prod_{}^{}', title: 'Productoria', kw: 'producto' },
      { display: '\\sup', insert: '\\sup ', title: 'Supremo', kw: 'supremo' },
      { display: '\\inf', insert: '\\inf ', title: 'Ínfimo', kw: 'infimo' },
      { display: '\\max', insert: '\\max ', title: 'Máximo', kw: 'maximo' },
      { display: '\\min', insert: '\\min ', title: 'Mínimo', kw: 'minimo' },
      { display: '\\nabla', insert: '\\nabla ', title: 'Gradiente', kw: 'gradiente nabla' },
      symk('\\infty', 'infinito'), symk('\\to', 'tiende a flecha'), symk('\\partial', 'parcial'),
    ],
  },
  {
    name: 'Griego',
    items: [
      '\\alpha', '\\beta', '\\gamma', '\\delta', '\\varepsilon', '\\epsilon', '\\zeta', '\\eta', '\\theta', '\\vartheta',
      '\\iota', '\\kappa', '\\lambda', '\\mu', '\\nu', '\\xi', '\\pi', '\\varpi', '\\rho', '\\varrho', '\\sigma', '\\varsigma', '\\tau',
      '\\upsilon', '\\phi', '\\varphi', '\\chi', '\\psi', '\\omega',
      '\\Gamma', '\\Delta', '\\Theta', '\\Lambda', '\\Xi', '\\Pi', '\\Sigma', '\\Upsilon', '\\Phi', '\\Psi', '\\Omega',
    ].map(sym),
  },
  {
    name: 'Flechas',
    items: [
      symk('\\to', 'flecha derecha tiende'), symk('\\gets', 'flecha izquierda'), symk('\\leftrightarrow', 'doble'), symk('\\mapsto', 'mapea a'),
      symk('\\longrightarrow', 'flecha larga'), symk('\\longleftarrow', 'flecha larga izq'), symk('\\longleftrightarrow', 'doble larga'),
      symk('\\Rightarrow', 'implica'), symk('\\Leftarrow', ''), symk('\\Leftrightarrow', 'equivale'), symk('\\Longrightarrow', 'implica larga'),
      symk('\\uparrow', 'arriba'), symk('\\downarrow', 'abajo'), symk('\\updownarrow', ''), symk('\\Uparrow', ''), symk('\\Downarrow', ''),
      symk('\\nearrow', 'diagonal'), symk('\\searrow', 'diagonal'), symk('\\nwarrow', ''), symk('\\swarrow', ''),
      symk('\\rightleftharpoons', 'equilibrio reaccion'), symk('\\hookrightarrow', 'inclusion gancho'), symk('\\twoheadrightarrow', 'sobreyectiva'), symk('\\rightarrowtail', 'inyectiva'),
      { display: '\\xrightarrow{f}', insert: '\\xrightarrow{}', title: 'Flecha con etiqueta', kw: 'flecha texto funcion' },
    ],
  },
  {
    name: 'Delimitadores',
    items: [
      { display: '\\left( x \\right)', insert: '\\left( \\right)', title: 'Paréntesis autoajustable', kw: 'parentesis' },
      { display: '\\left[ x \\right]', insert: '\\left[ \\right]', title: 'Corchetes', kw: 'corchete' },
      { display: '\\left\\{ x \\right\\}', insert: '\\left\\{ \\right\\}', title: 'Llaves', kw: 'llaves conjunto' },
      { display: '\\left| x \\right|', insert: '\\left| \\right|', title: 'Valor absoluto', kw: 'valor absoluto modulo' },
      { display: '\\left\\| v \\right\\|', insert: '\\left\\| \\right\\|', title: 'Norma', kw: 'norma' },
      { display: '\\langle u,v \\rangle', insert: '\\langle  \\rangle', title: 'Producto interno', kw: 'angulo producto interno bra ket' },
      { display: '\\lfloor x \\rfloor', insert: '\\lfloor \\rfloor', title: 'Piso', kw: 'piso floor parte entera' },
      { display: '\\lceil x \\rceil', insert: '\\lceil \\rceil', title: 'Techo', kw: 'techo ceil' },
      { display: '\\binom{n}{k}', insert: '\\binom{}{}', title: 'Binomial', kw: 'combinatorio binomial' },
      { display: '\\overset{?}{=}', insert: '\\overset{}{}', title: 'Encima de', kw: 'sobre encima' },
      { display: '\\underset{n}{x}', insert: '\\underset{}{}', title: 'Debajo de', kw: 'bajo debajo' },
    ],
  },
  {
    name: 'Acentos',
    items: [
      { display: '\\vec{v}', insert: '\\vec{}', title: 'Vector' },
      { display: '\\hat{a}', insert: '\\hat{}', title: 'Sombrero' },
      { display: '\\widehat{AB}', insert: '\\widehat{}', title: 'Sombrero ancho' },
      { display: '\\bar{x}', insert: '\\bar{}', title: 'Barra (media)', kw: 'promedio media' },
      { display: '\\overline{AB}', insert: '\\overline{}', title: 'Sobrelínea', kw: 'clausura conjugado' },
      { display: '\\dot{x}', insert: '\\dot{}', title: 'Punto (derivada temporal)' },
      { display: '\\ddot{x}', insert: '\\ddot{}', title: 'Doble punto' },
      { display: '\\tilde{a}', insert: '\\tilde{}', title: 'Tilde' },
      { display: '\\widetilde{AB}', insert: '\\widetilde{}', title: 'Tilde ancha' },
      { display: '\\check{a}', insert: '\\check{}', title: 'Verificación' },
      { display: '\\breve{a}', insert: '\\breve{}', title: 'Breve' },
      { display: '\\overrightarrow{AB}', insert: '\\overrightarrow{}', title: 'Vector AB', kw: 'vector flecha' },
      { display: '\\underline{x}', insert: '\\underline{}', title: 'Subrayado' },
    ],
  },
  {
    name: 'Estructuras',
    items: [
      { display: '\\begin{cases} a & \\\\ b & \\end{cases}', insert: '\\begin{cases}  \\\\  \\end{cases}', title: 'Por casos', kw: 'casos partida' },
      { display: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', insert: '\\begin{pmatrix}  &  \\\\  &  \\end{pmatrix}', title: 'Matriz ()', kw: 'matriz' },
      { display: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', insert: '\\begin{bmatrix}  &  \\\\  &  \\end{bmatrix}', title: 'Matriz []', kw: 'matriz corchetes' },
      { display: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}', insert: '\\begin{vmatrix}  &  \\\\  &  \\end{vmatrix}', title: 'Determinante', kw: 'determinante' },
      { display: '\\begin{aligned} a &= b \\end{aligned}', insert: '\\begin{aligned}  &=  \\end{aligned}', title: 'Alineado', kw: 'alinear ecuaciones' },
      { display: '\\underbrace{x}_{n}', insert: '\\underbrace{}_{}', title: 'Llave inferior' },
      { display: '\\overbrace{x}^{n}', insert: '\\overbrace{}^{}', title: 'Llave superior' },
      { display: '\\substack{a \\\\ b}', insert: '\\substack{ \\\\ }', title: 'Subíndice apilado', kw: 'apilado' },
      { display: '\\text{si}', insert: '\\text{}', title: 'Texto', kw: 'texto palabra' },
    ],
  },
  {
    name: 'Fuentes',
    items: [
      { display: '\\mathbb{R}', insert: '\\mathbb{}', title: 'Pizarra (blackboard)', kw: 'blackboard reales enteros conjuntos' },
      { display: '\\mathcal{A}', insert: '\\mathcal{}', title: 'Caligráfica', kw: 'caligrafica script' },
      { display: '\\mathfrak{g}', insert: '\\mathfrak{}', title: 'Fraktur', kw: 'fraktur gotica algebra' },
      { display: '\\mathrm{d}', insert: '\\mathrm{}', title: 'Redonda (roman)', kw: 'recta roman diferencial' },
      { display: '\\mathbf{v}', insert: '\\mathbf{}', title: 'Negrita', kw: 'negrita bold vector' },
      { display: '\\mathsf{X}', insert: '\\mathsf{}', title: 'Sans serif', kw: 'sans' },
      { display: '\\boldsymbol{\\alpha}', insert: '\\boldsymbol{}', title: 'Símbolo en negrita', kw: 'negrita griega vector' },
      { display: '\\operatorname{sen}', insert: '\\operatorname{}', title: 'Operador con nombre', kw: 'operador funcion nombre' },
    ],
  },
  {
    name: 'Casa',
    items: [
      symk('\\R', 'reales'), symk('\\N', 'naturales'), symk('\\Z', 'enteros'), symk('\\Q', 'racionales'), symk('\\C', 'complejos'),
      { display: '\\sen', insert: '\\sen ', kw: 'seno' },
      { display: '\\abs{x}', insert: '\\abs{}', title: 'Valor absoluto', kw: 'valor absoluto modulo' },
      { display: '\\norm{v}', insert: '\\norm{}', title: 'Norma', kw: 'norma' },
    ],
  },
]

/** Todos los ítems aplanados (con su categoría) para el buscador. */
const ALL_ITEMS: PaletteItem[] = CATEGORIES.flatMap((c) => c.items)

/** Una entrada de autocompletado: comando `\nombre`, snippet a insertar y descripción. */
export interface MathCommand {
  cmd: string
  insert: string
  title?: string | undefined
}

// Catálogo de comandos `\…` para el autocompletado inline (ME-16): se deriva de la paleta
// (misma fuente) tomando el comando principal de cada ítem; se deduplica por comando.
let commandCatalog: MathCommand[] | null = null
export function mathCommandCatalog(): MathCommand[] {
  if (commandCatalog) return commandCatalog
  const seen = new Set<string>()
  const out: MathCommand[] = []
  for (const item of ALL_ITEMS) {
    const m = item.insert.match(/^\\[a-zA-Z]+/) // solo ítems que empiezan con un comando \…
    if (!m) continue
    const cmd = m[0]
    if (seen.has(cmd)) continue
    seen.add(cmd)
    out.push({ cmd, insert: item.insert, ...(item.title ? { title: item.title } : {}) })
  }
  out.sort((a, b) => a.cmd.localeCompare(b.cmd))
  commandCatalog = out
  return out
}

/** Comando LaTeX principal de un ítem (para la etiqueta bajo el símbolo: enseña qué se escribe). */
function cmdLabel(insert: string): string {
  const m = insert.match(/\\begin\{[a-z]+\}|\\[a-zA-Z]+|\^|_|'/)
  return m ? m[0] : insert.trim()
}
/** Texto contra el que matchea el buscador (título + comando + keywords). */
function searchText(item: PaletteItem): string {
  return `${item.title ?? ''} ${item.insert} ${item.display} ${item.kw ?? ''}`.toLowerCase()
}

/**
 * Hace que un input **crezca a lo ancho** con su contenido (monoespaciado → `ch`), entre
 * un mínimo y un máximo. Así el popover se agranda al escribir fórmulas largas.
 */
export function autoGrowInput(input: HTMLInputElement, minCh = 18, maxCh = 64): void {
  const resize = (): void => {
    const ch = Math.min(maxCh, Math.max(minCh, input.value.length + 2))
    input.style.width = `${ch}ch`
  }
  input.addEventListener('input', resize)
  resize()
}

/**
 * Inserta `snippet` en la posición del cursor de un input y dispara `input` (para que el
 * preview en vivo reaccione). Si el fragmento tiene un `{}`, deja el cursor **dentro** del
 * primer par vacío (listo para escribir el contenido).
 */
export function insertIntoInput(input: HTMLInputElement, snippet: string): void {
  const start = input.selectionStart ?? input.value.length
  const end = input.selectionEnd ?? start
  const brace = snippet.indexOf('{}')
  const caret = brace >= 0 ? start + brace + 1 : start + snippet.length
  input.value = input.value.slice(0, start) + snippet + input.value.slice(end)
  input.setSelectionRange(caret, caret)
  input.focus()
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * **Puente** para insertar desde la barra contextual (React) en la fórmula que se está
 * editando en su popover (DOM). El node view registra su input al abrir el popover y lo
 * desregistra al cerrar; la paleta de la barra inserta en el registrado.
 */
let activeInsert: ((snippet: string) => void) | null = null
export function setActiveMathInsert(fn: ((snippet: string) => void) | null): void {
  activeInsert = fn
}
export function insertActiveMath(snippet: string): void {
  activeInsert?.(snippet)
}

/**
 * Panel de símbolos/plantillas: **buscador** + pestañas por categoría + grilla KaTeX. Cada botón
 * muestra el símbolo **y su comando LaTeX** debajo (se ve, se usa y se **aprende** qué escribir).
 * Escribir en el buscador filtra **todas** las categorías; vaciarlo vuelve a las pestañas.
 */
export function createMathPalette(onInsert: (snippet: string) => void): HTMLElement {
  const root = document.createElement('div')
  root.className = 'matex-palette'

  const search = document.createElement('input')
  search.type = 'text'
  search.className = 'matex-palette-search'
  search.placeholder = 'Buscar… (p. ej. suma, raíz, \\alpha, matriz)'
  search.setAttribute('aria-label', 'Buscar símbolo o plantilla')

  const tabs = document.createElement('div')
  tabs.className = 'matex-palette-tabs'
  const grid = document.createElement('div')
  grid.className = 'matex-palette-grid'
  root.append(search, tabs, grid)

  const makeButton = (item: PaletteItem): HTMLButtonElement => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'matex-palette-item'
    btn.title = item.title ?? item.insert.trim()
    const sym = document.createElement('span')
    sym.className = 'matex-palette-sym'
    try {
      katex.render(item.display, sym, { throwOnError: false, macros: MACROS })
    } catch {
      sym.textContent = item.display
    }
    const cmd = document.createElement('span')
    cmd.className = 'matex-palette-cmd'
    cmd.textContent = cmdLabel(item.insert)
    btn.append(sym, cmd)
    // `mousedown` + preventDefault: no roba el foco del input → la inserción usa su cursor.
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault()
      onInsert(item.insert)
    })
    return btn
  }
  const renderItems = (items: PaletteItem[]): void => {
    grid.replaceChildren(...items.map(makeButton))
    if (items.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'matex-palette-empty'
      empty.textContent = 'Sin resultados'
      grid.appendChild(empty)
    }
  }

  let activeCat = CATEGORIES[0]
  CATEGORIES.forEach((cat, i) => {
    const tab = document.createElement('button')
    tab.type = 'button'
    tab.className = 'matex-palette-tab'
    tab.textContent = cat.name
    tab.addEventListener('mousedown', (event) => {
      event.preventDefault()
      search.value = ''
      activeCat = cat
      for (const t of tabs.children) t.classList.remove('matex-palette-tab-active')
      tab.classList.add('matex-palette-tab-active')
      renderItems(cat.items)
    })
    if (i === 0) tab.classList.add('matex-palette-tab-active')
    tabs.appendChild(tab)
  })

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase()
    if (q === '') {
      tabs.style.visibility = ''
      renderItems(activeCat?.items ?? [])
      return
    }
    tabs.style.visibility = 'hidden' // buscando: la categoría activa no aplica
    renderItems(ALL_ITEMS.filter((it) => searchText(it).includes(q)))
  })

  if (activeCat) renderItems(activeCat.items)
  return root
}

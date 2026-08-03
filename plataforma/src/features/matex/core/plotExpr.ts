/**
 * **Motor de expresiones** para gráficos de funciones `y = f(x)` (ver
 * `matex/03-modelo-semantico/graficos-funciones.md`). Una sintaxis **normalizada** se
 * parsea a un AST puro del que salen varios emisores, resolviendo el problema de
 * consistencia preview↔PDF (como `\R` en KaTeX vs LaTeX):
 * - **`evalExpr`** — evalúa `f(x)` en JS (el "backend web", para el preview SVG).
 * - **`exprToPgfplots`** — emite la expresión pgfplots (el backend LaTeX del PDF).
 *
 * **Radianes en todo**: `Math.sin` es radianes y el `axis` de pgfplots se fija en
 * `trig format=rad` → `sin(x)` significa lo mismo en ambos (sin `deg()`).
 *
 * Módulo **puro** (parte de `matex-core`): sin DOM ni dependencias. `x` es la única
 * variable; subset de funciones/constantes pensado para cálculo de una variable.
 */

export type ExprNode =
  | { t: 'num'; v: number }
  | { t: 'var'; name?: string } // la variable (default `x`; `t`/`theta` en paramétricas/polares)
  | { t: 'const'; name: 'pi' | 'e' }
  | { t: 'neg'; a: ExprNode }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: ExprNode; b: ExprNode }
  | { t: 'call'; fn: string; a: ExprNode }

/** Funciones soportadas: evaluador JS (radianes). */
const JS_FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x), cot: (x) => 1 / Math.tan(x),
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp, ln: Math.log, log: Math.log10, sqrt: Math.sqrt, abs: Math.abs,
}
/** Mismas funciones → nombre pgfplots (casi 1:1; `log` = base 10 = `log10`). */
const PGF_FUNCS: Record<string, string> = {
  sin: 'sin', cos: 'cos', tan: 'tan', sec: 'sec', csc: 'cosec', cot: 'cot',
  asin: 'asin', acos: 'acos', atan: 'atan',
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', exp: 'exp', ln: 'ln', log: 'log10',
  sqrt: 'sqrt', abs: 'abs',
}
/**
 * `sec/csc/cot` → recíprocas de `cos/sin/tan` al emitir pgfplots: garantiza que honren
 * `trig format plots=rad` (las trig recíprocas nativas de pgfmath usan grados por defecto).
 */
const PGF_RECIP: Record<string, string> = { sec: 'cos', csc: 'sin', cot: 'tan' }

// ── Tokenizer ────────────────────────────────────────────────────────────────

type Token =
  | { k: 'num'; v: number }
  | { k: 'id'; v: string }
  | { k: 'op'; v: string }
  | { k: '(' }
  | { k: ')' }
  | { k: 'frac' }

/** Alias de comandos LaTeX cuyo nombre difiere del interno. */
const LATEX_ALIAS: Record<string, string> = {
  arcsin: 'asin', arccos: 'acos', arctan: 'atan', sen: 'sin', tg: 'tan',
  cosec: 'csc', cotan: 'cot', ctg: 'cot',
}

/** Notación del campo: `ascii` (sin `\`/`{}`), `latex`, o `both` (lenient, interno). */
export type ExprSyntax = 'ascii' | 'latex' | 'both'

/**
 * Tokeniza según la notación. En **`latex`/`both`** acepta comandos LaTeX (`\frac`,
 * `\sqrt`, `\sin`, `\cdot`, `\pi`, `\left/\right`, espaciado) y `{}` como agrupación. En
 * **`ascii`** los comandos `\…` y las llaves `{}` son error (input ASCII puro). Lo común
 * (`x^2`, `1/x`, `sqrt(x)`, `sin(x)`, `pi`) vale en cualquier modo.
 */
function tokenize(src: string, syntax: ExprSyntax): Token[] | { error: string } {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (c === ' ' || c === '\t' || c === '\n') {
      i += 1
      continue
    }
    if (c >= '0' && c <= '9') {
      let j = i + 1
      while (j < src.length && /[0-9.]/.test(src[j]!)) j += 1
      const v = Number(src.slice(i, j))
      if (!Number.isFinite(v)) return { error: `número inválido: ${src.slice(i, j)}` }
      tokens.push({ k: 'num', v })
      i = j
      continue
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i + 1
      while (j < src.length && /[a-zA-Z0-9]/.test(src[j]!)) j += 1
      tokens.push({ k: 'id', v: src.slice(i, j) })
      i = j
      continue
    }
    if (c === '\\') {
      if (syntax === 'ascii') return { error: 'en modo ASCII no se usan comandos LaTeX (ej: sqrt(x), x^2, pi)' }
      let j = i + 1
      while (j < src.length && /[a-zA-Z]/.test(src[j]!)) j += 1
      const cmd = src.slice(i + 1, j)
      if (cmd === '') {
        i += 2 // espaciado tipo `\,` `\!` `\;` → saltear la puntuación
        continue
      }
      i = j
      if (cmd === 'cdot' || cmd === 'times') tokens.push({ k: 'op', v: '*' })
      else if (cmd === 'div') tokens.push({ k: 'op', v: '/' })
      else if (cmd === 'left' || cmd === 'right') {
        /* delimitadores: se ignoran (el `(`/`)` que sigue hace el trabajo) */
      } else if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') tokens.push({ k: 'frac' })
      else if (cmd === 'pi') tokens.push({ k: 'id', v: 'pi' })
      else tokens.push({ k: 'id', v: LATEX_ALIAS[cmd] ?? cmd })
      continue
    }
    if ('+-*/^'.includes(c)) {
      tokens.push({ k: 'op', v: c })
      i += 1
      continue
    }
    if (c === '{' || c === '}') {
      if (syntax === 'ascii') return { error: 'en modo ASCII usá paréntesis ( ), no llaves { }' }
      tokens.push({ k: c === '{' ? '(' : ')' }) // `{`/`}` agrupan como `(`/`)`
      i += 1
      continue
    }
    if (c === '(') {
      tokens.push({ k: '(' })
      i += 1
      continue
    }
    if (c === ')') {
      tokens.push({ k: ')' })
      i += 1
      continue
    }
    return { error: `carácter inesperado: "${c}"` }
  }
  return tokens
}

// ── Parser (descenso recursivo) ──────────────────────────────────────────────

export type ParseResult = { ok: true; node: ExprNode } | { ok: false; error: string }

class Parser {
  private pos = 0
  private readonly toks: Token[]
  private readonly varNames: ReadonlySet<string>
  constructor(toks: Token[], varNames: ReadonlySet<string>) {
    this.toks = toks
    this.varNames = varNames
  }

  parse(): ExprNode {
    const node = this.add()
    if (this.pos < this.toks.length) throw new Error('token de más al final')
    return node
  }

  private peek(): Token | undefined {
    return this.toks[this.pos]
  }
  /** ¿El próximo token puede **iniciar** un factor? (para la multiplicación implícita). */
  private startsFactor(): boolean {
    const t = this.peek()
    return t !== undefined && (t.k === 'num' || t.k === 'id' || t.k === '(' || t.k === 'frac')
  }

  private add(): ExprNode {
    let left = this.mul()
    for (;;) {
      const t = this.peek()
      if (t?.k === 'op' && (t.v === '+' || t.v === '-')) {
        this.pos += 1
        left = { t: 'bin', op: t.v, a: left, b: this.mul() }
      } else break
    }
    return left
  }

  private mul(): ExprNode {
    let left = this.unary()
    for (;;) {
      const t = this.peek()
      if (t?.k === 'op' && (t.v === '*' || t.v === '/')) {
        this.pos += 1
        left = { t: 'bin', op: t.v, a: left, b: this.unary() }
      } else if (this.startsFactor()) {
        // Multiplicación **implícita**: `2x`, `2sin(x)`, `(x+1)(x-1)`.
        left = { t: 'bin', op: '*', a: left, b: this.unary() }
      } else break
    }
    return left
  }

  private unary(): ExprNode {
    const t = this.peek()
    if (t?.k === 'op' && t.v === '-') {
      this.pos += 1
      return { t: 'neg', a: this.unary() }
    }
    if (t?.k === 'op' && t.v === '+') {
      this.pos += 1
      return this.unary()
    }
    return this.power()
  }

  private power(): ExprNode {
    const base = this.atom()
    const t = this.peek()
    if (t?.k === 'op' && t.v === '^') {
      this.pos += 1
      // Asociativo a derecha; el exponente puede ser unario (`2^-3`).
      return { t: 'bin', op: '^', a: base, b: this.unary() }
    }
    return base
  }

  /** Un grupo `( … )` (o `{ … }`, que el tokenizer mapea a `(`); para `\frac`. */
  private group(): ExprNode {
    if (this.peek()?.k !== '(') throw new Error('se esperaba un grupo entre { } o ( )')
    this.pos += 1
    const inner = this.add()
    if (this.peek()?.k !== ')') throw new Error('falta "}" o ")"')
    this.pos += 1
    return inner
  }

  private atom(): ExprNode {
    const t = this.peek()
    if (t === undefined) throw new Error('expresión incompleta')
    if (t.k === 'frac') {
      this.pos += 1
      return { t: 'bin', op: '/', a: this.group(), b: this.group() }
    }
    if (t.k === 'num') {
      this.pos += 1
      return { t: 'num', v: t.v }
    }
    if (t.k === '(') {
      this.pos += 1
      const inner = this.add()
      if (this.peek()?.k !== ')') throw new Error('falta ")"')
      this.pos += 1
      return inner
    }
    if (t.k === 'id') {
      this.pos += 1
      const name = t.v
      // Referencia a otra función del gráfico `fN` (ME-17/ME-45): `fN(arg)` o `fN` (= `fN(x)`). El motor
      // la resuelve por texto (funciones explícitas) o por evaluador (funciones-de-datos, vía `env`).
      const isRef = /^f\d+$/.test(name)
      if (this.peek()?.k === '(') {
        if (!(name in PGF_FUNCS) && !isRef) throw new Error(`función desconocida: ${name}`)
        this.pos += 1
        const arg = this.add()
        if (this.peek()?.k !== ')') throw new Error('falta ")"')
        this.pos += 1
        return { t: 'call', fn: name, a: arg }
      }
      if (isRef) return { t: 'call', fn: name, a: { t: 'var' } } // `fN` sin paréntesis = `fN(x)`
      if (this.varNames.has(name)) return { t: 'var', name }
      if (name === 'pi' || name === 'e') return { t: 'const', name }
      throw new Error(`identificador desconocido: ${name} (¿faltó un "*"?)`)
    }
    throw new Error('token inesperado')
  }
}

/**
 * Parsea la expresión en la notación dada (`both` = lenient, default). `varName` es el
 * identificador que actúa de variable (`x` por defecto; `t` en paramétricas, `theta` en
 * polares). AST o error.
 */
export function parseExpr(src: string, syntax: ExprSyntax = 'both', varName = 'x'): ParseResult {
  return parseVars(src, syntax, new Set([varName]))
}

/** Parsea una expresión de **dos variables** `x, y` (para curvas implícitas `F(x,y)`). */
export function parseExprXY(src: string, syntax: ExprSyntax = 'both'): ParseResult {
  return parseVars(src, syntax, new Set(['x', 'y']))
}

/** Parsea con un **set explícito de variables** (p. ej. `x` + nombres de parámetros con slider),
 *  para mostrar esas letras como tales en la leyenda en vez de sustituir su valor. */
export function parseExprVars(src: string, varNames: Iterable<string>, syntax: ExprSyntax = 'both'): ParseResult {
  return parseVars(src, syntax, new Set(varNames))
}

function parseVars(src: string, syntax: ExprSyntax, varNames: ReadonlySet<string>): ParseResult {
  const toks = tokenize(src, syntax)
  if ('error' in toks) return { ok: false, error: toks.error }
  if (toks.length === 0) return { ok: false, error: 'expresión vacía' }
  try {
    return { ok: true, node: new Parser(toks, varNames).parse() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'expresión inválida' }
  }
}

// ── Emisores ─────────────────────────────────────────────────────────────────

/**
 * Evalúa `f(x)`. Puede devolver `NaN`/`±Infinity` (fuera de dominio) → el plotter corta.
 * `env` (opcional): evaluadores de las funciones del gráfico por índice — para resolver **referencias
 * `fN(x)` en tiempo de evaluación** (funciones-de-datos, que no tienen fórmula de texto que inline; ME-45).
 * Sin `env`, un `fN` da `NaN`.
 */
export function evalExpr(node: ExprNode, x: number, env?: readonly (((x: number) => number) | null)[]): number {
  switch (node.t) {
    case 'num':
      return node.v
    case 'var':
      return x
    case 'const':
      return node.name === 'pi' ? Math.PI : Math.E
    case 'neg':
      return -evalExpr(node.a, x, env)
    case 'call': {
      const ref = /^f(\d+)$/.exec(node.fn)
      if (ref) {
        const g = env?.[Number(ref[1]) - 1]
        return g ? g(evalExpr(node.a, x, env)) : Number.NaN
      }
      return (JS_FUNCS[node.fn] ?? (() => NaN))(evalExpr(node.a, x, env))
    }
    case 'bin': {
      const a = evalExpr(node.a, x, env)
      const b = evalExpr(node.b, x, env)
      switch (node.op) {
        case '+':
          return a + b
        case '-':
          return a - b
        case '*':
          return a * b
        case '/':
          return a / b
        case '^':
          return a ** b
      }
    }
  }
}

/**
 * Pendiente numérica de `f` en `at` para la **recta tangente**, y si la tangente es **vertical**.
 * Diferencia central a dos escalas de `h` (lateral si un lado del dominio no está definido). La
 * tangente es **vertical ⟺ la pendiente diverge** al achicar `h` (propiedad de la función, NO de la
 * ventana): así una pendiente **finita por empinada que sea** (p. ej. −8.58) se dibuja como recta, y
 * solo una divergencia real (p. ej. √(1−x²) en x=±1) se dibuja vertical. `y0 = f(at)` ya resuelto
 * (con respaldo lateral en bordes). `ev` = evaluador de la función (devuelve `NaN` fuera del dominio).
 */
export function tangentSlope(ev: (x: number) => number, at: number, y0: number): { m: number; vertical: boolean } {
  const slope = (h: number): number => {
    const c = (ev(at + h) - ev(at - h)) / (2 * h)
    if (Number.isFinite(c)) return c
    const f = (ev(at + h) - y0) / h // borde: diferencia hacia adelante
    if (Number.isFinite(f)) return f
    const b = (y0 - ev(at - h)) / h // borde: diferencia hacia atrás
    return Number.isFinite(b) ? b : Number.NaN
  }
  const coarse = slope(1e-3)
  const m = slope(1e-6)
  // Diverge = no finita, o (respecto de un h mayor) crece mucho y ya es enorme → tangente vertical.
  const vertical = !Number.isFinite(m) || (Number.isFinite(coarse) && Math.abs(m) > 100 && Math.abs(m) > 4 * Math.abs(coarse))
  return { m, vertical }
}

/** Evalúa `F(x, y)` (dos variables; el nodo `var` distingue por `name`). Para curvas implícitas. */
export function evalExprXY(node: ExprNode, x: number, y: number): number {
  switch (node.t) {
    case 'num':
      return node.v
    case 'var':
      return node.name === 'y' ? y : x
    case 'const':
      return node.name === 'pi' ? Math.PI : Math.E
    case 'neg':
      return -evalExprXY(node.a, x, y)
    case 'call':
      return (JS_FUNCS[node.fn] ?? (() => NaN))(evalExprXY(node.a, x, y))
    case 'bin': {
      const a = evalExprXY(node.a, x, y)
      const b = evalExprXY(node.b, x, y)
      switch (node.op) {
        case '+': return a + b
        case '-': return a - b
        case '*': return a * b
        case '/': return a / b
        case '^': return a ** b
      }
    }
  }
}

/** Emite la expresión en sintaxis **pgfplots** (totalmente parentizada = siempre correcta). */
export function exprToPgfplots(node: ExprNode): string {
  switch (node.t) {
    case 'num':
      return String(node.v)
    case 'var':
      return node.name ?? 'x'
    case 'const':
      return node.name // pgfplots define `pi` y `e`
    case 'neg':
      return `(-${exprToPgfplots(node.a)})`
    case 'call': {
      const recip = PGF_RECIP[node.fn]
      if (recip) return `(1/${recip}(${exprToPgfplots(node.a)}))`
      return `${PGF_FUNCS[node.fn] ?? node.fn}(${exprToPgfplots(node.a)})`
    }
    case 'bin':
      return `(${exprToPgfplots(node.a)} ${node.op} ${exprToPgfplots(node.b)})`
  }
}

/** Atajo: `src` normalizado → pgfplots, o `null` si no parsea. `varName` = variable (`x`/`t`/…). */
export function compileExprToPgfplots(src: string, varName = 'x'): string | null {
  const r = parseExpr(src, 'both', varName)
  return r.ok ? exprToPgfplots(r.node) : null
}

// ── Emisor LaTeX (para leyendas/labels como matemática) ──────────────────────

const LATEX_FUNCS: Record<string, string> = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', sec: '\\sec', csc: '\\csc', cot: '\\cot',
  asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan',
  sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', ln: '\\ln', log: '\\log',
}

/** Precedencia para parentizar lo mínimo (mayor = liga más fuerte). `/` = `\frac` es
 *  autodelimitado pero se trata como `*` para el caso de ser base de una potencia. */
function precOf(node: ExprNode): number {
  if (node.t === 'bin') return node.op === '^' ? 4 : node.op === '+' || node.op === '-' ? 1 : 2
  if (node.t === 'neg') return 3
  return 10
}

function emitLatex(node: ExprNode, minPrec: number): string {
  const s = rawLatex(node)
  return precOf(node) < minPrec ? `\\left(${s}\\right)` : s
}

function rawLatex(node: ExprNode): string {
  switch (node.t) {
    case 'num':
      return String(node.v)
    case 'var':
      return node.name ?? 'x'
    case 'const':
      return node.name === 'pi' ? '\\pi' : 'e'
    case 'neg':
      return `-${emitLatex(node.a, 3)}`
    case 'call': {
      const a = emitLatex(node.a, 0)
      if (node.fn === 'sqrt') return `\\sqrt{${a}}`
      // `\abs{…}` (no `\left|…\right|`): así el propio parser lo re-lee (round-trip ASCII↔LaTeX).
      if (node.fn === 'abs') return `\\abs{${a}}`
      if (node.fn === 'exp') return `e^{${a}}`
      return `${LATEX_FUNCS[node.fn] ?? `\\operatorname{${node.fn}}`}\\left(${a}\\right)`
    }
    case 'bin':
      if (node.op === '/') return `\\frac{${emitLatex(node.a, 0)}}{${emitLatex(node.b, 0)}}`
      if (node.op === '^') return `${emitLatex(node.a, 5)}^{${emitLatex(node.b, 0)}}`
      if (node.op === '*') return `${emitLatex(node.a, 2)} \\cdot ${emitLatex(node.b, 2)}`
      return `${emitLatex(node.a, 1)} ${node.op} ${emitLatex(node.b, node.op === '-' ? 2 : 1)}`
  }
}

/** Emite la expresión como **LaTeX matemático** (`x^2` → `x^{2}`, `sqrt(x)` → `\sqrt{x}`). */
export function exprToLatex(node: ExprNode): string {
  return emitLatex(node, 0)
}

// ── MathML (para leyendas del SVG/HTML sin embeber KaTeX — nuestro AST ya está parseado) ──
function emitMathML(node: ExprNode, minPrec: number): string {
  const s = rawMathML(node)
  return precOf(node) < minPrec ? `<mo>(</mo>${s}<mo>)</mo>` : s
}
function rawMathML(node: ExprNode): string {
  switch (node.t) {
    case 'num':
      return `<mn>${node.v}</mn>`
    case 'var':
      return `<mi>${node.name ?? 'x'}</mi>`
    case 'const':
      return node.name === 'pi' ? '<mi>&#960;</mi>' : '<mi>e</mi>'
    case 'neg':
      return `<mo>&#8722;</mo>${emitMathML(node.a, 3)}`
    case 'call': {
      const a = rawMathML(node.a)
      if (node.fn === 'sqrt') return `<msqrt>${a}</msqrt>`
      if (node.fn === 'abs') return `<mo>|</mo>${a}<mo>|</mo>`
      if (node.fn === 'exp') return `<msup><mi>e</mi><mrow>${a}</mrow></msup>`
      const name = (LATEX_FUNCS[node.fn] ?? node.fn).replace(/\\/g, '')
      return `<mi>${name}</mi><mo>&#8289;</mo><mo>(</mo>${a}<mo>)</mo>`
    }
    case 'bin':
      if (node.op === '/') return `<mfrac><mrow>${rawMathML(node.a)}</mrow><mrow>${rawMathML(node.b)}</mrow></mfrac>`
      if (node.op === '^') return `<msup><mrow>${emitMathML(node.a, 5)}</mrow><mrow>${rawMathML(node.b)}</mrow></msup>`
      if (node.op === '*') return `${emitMathML(node.a, 2)}<mo>&#8901;</mo>${emitMathML(node.b, 2)}`
      return `${emitMathML(node.a, 1)}<mo>${node.op === '-' ? '&#8722;' : '+'}</mo>${emitMathML(node.b, node.op === '-' ? 2 : 1)}`
  }
}
/** Cuerpo MathML (sin el `<math>` externo), para componer ecuaciones/pares (`= `, `(x, y)`). */
export function exprMathMLBody(node: ExprNode): string {
  return emitMathML(node, 0)
}
/** Envuelve un cuerpo MathML en `<math>` (namespace correcto). */
export function wrapMathML(body: string): string {
  return `<math xmlns="http://www.w3.org/1998/Math/MathML">${body}</math>`
}
/** Emite la expresión como **MathML** (`<math>…</math>`), para leyendas sin depender de KaTeX. */
export function exprToMathML(node: ExprNode): string {
  return wrapMathML(emitMathML(node, 0))
}

/** Atajo: `src` → LaTeX math, o `null` si no parsea. `varName` = variable (`x`/`t`/…). */
export function compileExprToLatex(src: string, syntax: ExprSyntax = 'both', varName = 'x'): string | null {
  const r = parseExpr(src, syntax, varName)
  return r.ok ? exprToLatex(r.node) : null
}

// ── Emisor ASCII (para convertir de/hacia LaTeX al cambiar el modo del campo) ──

function emitAscii(node: ExprNode, minPrec: number): string {
  const s = rawAscii(node)
  return precOf(node) < minPrec ? `(${s})` : s
}
function rawAscii(node: ExprNode): string {
  switch (node.t) {
    case 'num':
      return String(node.v)
    case 'var':
      return node.name ?? 'x'
    case 'const':
      return node.name // 'pi' | 'e'
    case 'neg':
      return `-${emitAscii(node.a, 3)}`
    case 'call':
      return `${node.fn}(${emitAscii(node.a, 0)})`
    case 'bin':
      if (node.op === '/') return `${emitAscii(node.a, 2)}/${emitAscii(node.b, 3)}`
      if (node.op === '^') return `${emitAscii(node.a, 5)}^${emitAscii(node.b, 4)}`
      if (node.op === '*') return `${emitAscii(node.a, 2)}*${emitAscii(node.b, 2)}`
      return `${emitAscii(node.a, 1)} ${node.op} ${emitAscii(node.b, node.op === '-' ? 2 : 1)}`
  }
}

/** Emite la expresión como **ASCII** normalizado (`x^{2}`→`x^2`, `\frac{1}{x}`→`1/x`). */
export function exprToAscii(node: ExprNode): string {
  return emitAscii(node, 0)
}

/** Atajo: `src` → ASCII, o `null` si no parsea. `varName` = variable (`x`/`t`/…). */
export function compileExprToAscii(src: string, syntax: ExprSyntax = 'both', varName = 'x'): string | null {
  const r = parseExpr(src, syntax, varName)
  return r.ok ? exprToAscii(r.node) : null
}

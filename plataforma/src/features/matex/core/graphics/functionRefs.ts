/**
 * **Referencias entre funciones (familia A4).** Permite que una función se defina en base a
 * otras: transformación `g(x) = f1(x) + 1`, composición `f2(f1(x))`, etc. pgfplots no puede
 * referenciar otro `\addplot`, así que la costura es **sustituir el texto** de la función
 * referida en el AST → una expresión "aplanada" sin referencias, que luego parsea/emite/evalúa
 * el motor normal. Puro (lo usan el backend LaTeX, el preview SVG y el editor).
 *
 * Sintaxis: `f1`, `f2`, … (1-based, por índice) opcionalmente con argumento: `f1(x-2)`.
 * Sin argumento, `f1` equivale a `f1(x)`. **Detección de ciclos** (f1→f2→f1) y auto-referencia:
 * la referencia no resuelta se deja tal cual → el motor la marca inválida.
 */

interface RefFn {
  expr: string
  pieces?: readonly { expr: string }[] | undefined
  /** Función-de-datos (ME-45): no tiene fórmula de texto → su referencia se resuelve por evaluador, no por texto. */
  fromData?: unknown
}

/** ¿`f<N>` en la posición dada es un token de referencia (no parte de un identificador)? */
function refAt(expr: string, i: number): { index: number; matchLen: number } | null {
  const prev = i > 0 ? expr[i - 1] ?? '' : ''
  if (/[A-Za-z0-9_]/.test(prev)) return null
  const m = /^f(\d+)/.exec(expr.slice(i))
  if (!m) return null
  return { index: Number(m[1]) - 1, matchLen: m[0].length }
}

/** Lee el argumento entre paréntesis balanceados a partir de `open` (índice del `(`). */
function readArg(expr: string, open: number): { arg: string; end: number } {
  let depth = 1
  let j = open + 1
  const start = j
  while (j < expr.length && depth > 0) {
    const c = expr[j]
    if (c === '(') depth += 1
    else if (c === ')') {
      depth -= 1
      if (depth === 0) break
    }
    j += 1
  }
  return { arg: expr.slice(start, j), end: expr[j] === ')' ? j + 1 : j }
}

/**
 * Resuelve las referencias `f<N>` de las funciones de un gráfico: devuelve las mismas
 * funciones con `expr` (y `pieces[].expr`) **aplanados** (sin referencias). Una función que
 * referencia a una **partida** o inexistente, o que forma un **ciclo**, deja la referencia sin
 * resolver (el motor la marcará inválida). No muta la entrada.
 */
export function resolvePlotFunctions<T extends RefFn>(functions: readonly T[], varName = 'x'): T[] {
  const substitute = (expr: string, visiting: ReadonlySet<number>): string => {
    let out = ''
    let i = 0
    while (i < expr.length) {
      const ref = refAt(expr, i)
      if (!ref) {
        out += expr[i]
        i += 1
        continue
      }
      let end = i + ref.matchLen
      let arg = varName
      if (expr[end] === '(') {
        const r = readArg(expr, end)
        arg = r.arg
        end = r.end
      }
      const target = functions[ref.index]
      // Resoluble por TEXTO solo si existe, no es partida, no es función-de-datos (esa va por evaluador),
      // y no cierra un ciclo. Si no, se deja literal `fN` → lo resuelve el motor (env) o se marca inválida.
      if (target && !target.pieces && !target.fromData && !visiting.has(ref.index)) {
        const resolvedArg = substitute(arg, visiting)
        const body = substitute(target.expr, new Set(visiting).add(ref.index))
        const applied = body.replace(new RegExp(`\\b${varName}\\b`, 'g'), `(${resolvedArg})`)
        out += `(${applied})`
      } else {
        out += expr.slice(i, end) // se deja tal cual → inválida
      }
      i = end
    }
    return out
  }

  return functions.map((f, i) => {
    const visiting = new Set<number>([i])
    if (f.pieces) return { ...f, pieces: f.pieces.map((pc) => ({ ...pc, expr: substitute(pc.expr, visiting) })) }
    return { ...f, expr: substitute(f.expr, visiting) }
  })
}

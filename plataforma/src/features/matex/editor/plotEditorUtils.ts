import { evalExpr, parseExpr, resolvePlotFunctions, resolvePlotParameters, type PlotSpec } from '../core'

/**
 * Utilidades **puras** (sin JSX) del editor de gráficos: tipos, la paleta de tokens y los
 * parsers de campos. Separadas de `plotEditorParts.tsx` (componentes) para no romper el
 * Fast Refresh y mantener la frontera datos/lógica ↔ UI.
 */

/** Estilo de trazo (capa de presentación, compartido por todas las series). */
export type LineStyle = 'solid' | 'dashed' | 'dotted'

/** Un botón de la paleta de fórmulas del gráfico (inserta ASCII o LaTeX según el modo). */
export type PlotToken = { label: string; ascii: string; latex: string; title: string }

/**
 * Botonera del editor de gráficos, **agrupada** (estructura · variables · exp/log ·
 * trigonométricas · inversas e hiperbólicas). **Solo funciones evaluables** por el motor
 * (`plotExpr.ts`): nada de `∫`/`∑`/matrices, que no se pueden graficar.
 */
export const PLOT_TOKEN_GROUPS: PlotToken[][] = [
  [
    { label: 'xⁿ', ascii: '^', latex: '^{}', title: 'Potencia' },
    { label: 'a⁄b', ascii: '/', latex: '\\frac{}{}', title: 'Fracción / división' },
    { label: '√', ascii: 'sqrt()', latex: '\\sqrt{}', title: 'Raíz cuadrada' },
    { label: '( )', ascii: '()', latex: '()', title: 'Paréntesis (agrupar)' },
    { label: '|x|', ascii: 'abs()', latex: '\\abs{}', title: 'Valor absoluto' },
  ],
  [
    { label: 'x', ascii: 'x', latex: 'x', title: 'Variable x' },
    { label: 'π', ascii: 'pi', latex: '\\pi', title: 'Pi' },
    { label: 'e', ascii: 'e', latex: 'e', title: 'Número e' },
  ],
  [
    { label: 'eˣ', ascii: 'exp()', latex: 'e^{}', title: 'Exponencial eˣ' },
    { label: 'ln', ascii: 'ln()', latex: '\\ln()', title: 'Logaritmo natural' },
    { label: 'log', ascii: 'log()', latex: '\\log()', title: 'Logaritmo base 10' },
  ],
  [
    { label: 'sin', ascii: 'sin()', latex: '\\sin()', title: 'Seno' },
    { label: 'cos', ascii: 'cos()', latex: '\\cos()', title: 'Coseno' },
    { label: 'tan', ascii: 'tan()', latex: '\\tan()', title: 'Tangente' },
    { label: 'sec', ascii: 'sec()', latex: '\\sec()', title: 'Secante' },
    { label: 'csc', ascii: 'csc()', latex: '\\csc()', title: 'Cosecante' },
    { label: 'cot', ascii: 'cot()', latex: '\\cot()', title: 'Cotangente' },
  ],
  [
    { label: 'sin⁻¹', ascii: 'asin()', latex: '\\arcsin()', title: 'Arcoseno' },
    { label: 'cos⁻¹', ascii: 'acos()', latex: '\\arccos()', title: 'Arcocoseno' },
    { label: 'tan⁻¹', ascii: 'atan()', latex: '\\arctan()', title: 'Arcotangente' },
    { label: 'sinh', ascii: 'sinh()', latex: '\\sinh()', title: 'Seno hiperbólico' },
    { label: 'cosh', ascii: 'cosh()', latex: '\\cosh()', title: 'Coseno hiperbólico' },
    { label: 'tanh', ascii: 'tanh()', latex: '\\tanh()', title: 'Tangente hiperbólica' },
  ],
]

/** Parsea puntos de un texto: una línea por punto, `x y` o `x,y` (ignora líneas inválidas). */
export function parsePointsText(text: string): [number, number][] {
  return text
    .split(/[\n;]+/)
    .map((line) => line.trim().split(/[\s,]+/).map(Number))
    .filter((n) => n.length >= 2 && Number.isFinite(n[0]!) && Number.isFinite(n[1]!))
    .map((n) => [n[0]!, n[1]!] as [number, number])
}

/**
 * Evalúa un campo numérico que puede ser un número (`3.14`) o una **expresión constante**
 * (`2*pi`, `pi/2`, `sqrt(2)`). Reusa el motor de expresiones; se evalúa con `x = NaN` para
 * **rechazar** expresiones que dependan de la variable (`2x` no es una constante válida).
 */
export function evalConst(text: string): number | null {
  const t = text.trim()
  if (t === '') return null
  const n = Number(t)
  if (Number.isFinite(n)) return n
  const r = parseExpr(t)
  if (!r.ok) return null
  const v = evalExpr(r.node, Number.NaN)
  return Number.isFinite(v) ? v : null
}

/**
 * Valor `f(x)` de la función `fnIndex` del gráfico, con **parámetros y referencias `f1`
 * resueltos**, o `null` si no es evaluable. Respeta las **ramas** (`pieces`): elige la que
 * contiene `x`. Sirve para previsualizar puntos/tangentes anclados en el editor.
 */
export function fnValueAt(spec: PlotSpec, fnIndex: number, x: number): number | null {
  const f = resolvePlotFunctions(resolvePlotParameters(spec).functions, 'x')[fnIndex]
  if (!f) return null
  const src =
    f.pieces && f.pieces.length > 0
      ? f.pieces.find((pc) => x >= Math.min(pc.from, pc.to) && x <= Math.max(pc.from, pc.to))?.expr
      : f.expr
  if (src == null) return null
  const r = parseExpr(src, spec.syntax ?? 'ascii')
  if (!r.ok) return null
  const v = evalExpr(r.node, x)
  return Number.isFinite(v) ? v : null
}

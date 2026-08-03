/**
 * **Macros matemáticas de Matex**, fuente única de verdad. Lo que el usuario puede
 * escribir en una fórmula y ver renderizado (KaTeX) **debe** compilar igual en LaTeX;
 * si las macros vivieran solo en el editor, `\R` se vería bien pero rompería el PDF
 * ("Undefined control sequence"). Por eso se definen acá una vez y se consumen desde:
 *   - `compile.ts` → `\providecommand` en el preámbulo (cuando hay matemática).
 *   - `editor/nodes.ts` → mapa de macros de KaTeX para el preview.
 *
 * `\providecommand` (no `\newcommand`) evita el error fatal si un paquete ya definió
 * el comando. Los cuerpos usan `#1` para las macros con argumento (KaTeX y LaTeX lo
 * interpretan igual).
 */

export interface MatexMacro {
  /** Nombre con barra, p. ej. `\\R`. */
  name: string
  /** Cantidad de argumentos (0 o 1). */
  args: number
  /** Cuerpo de la definición, p. ej. `\\mathbb{R}` o `\\left|#1\\right|`. */
  body: string
}

export const MATEX_MACROS: readonly MatexMacro[] = [
  { name: '\\R', args: 0, body: '\\mathbb{R}' },
  { name: '\\N', args: 0, body: '\\mathbb{N}' },
  { name: '\\Z', args: 0, body: '\\mathbb{Z}' },
  { name: '\\Q', args: 0, body: '\\mathbb{Q}' },
  { name: '\\C', args: 0, body: '\\mathbb{C}' },
  { name: '\\sen', args: 0, body: '\\operatorname{sen}' },
  { name: '\\abs', args: 1, body: '\\left|#1\\right|' },
  { name: '\\norm', args: 1, body: '\\left\\|#1\\right\\|' },
]

/** Definiciones LaTeX (`\providecommand`) para el preámbulo. */
export function matexMacroPreamble(): string[] {
  return MATEX_MACROS.map((m) =>
    m.args > 0
      ? `\\providecommand{${m.name}}[${m.args}]{${m.body}}`
      : `\\providecommand{${m.name}}{${m.body}}`,
  )
}

/** Mapa `nombre → cuerpo` para las macros de KaTeX (preview del editor). */
export function matexKatexMacros(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const macro of MATEX_MACROS) map[macro.name] = macro.body
  return map
}

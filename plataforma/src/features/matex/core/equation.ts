import type { EquationRow } from './ast'

/**
 * **Política del envoltorio** de una fórmula en bloque, en un solo lugar: la comparten
 * el compilador (→ LaTeX con `\label`) y el preview del editor (→ KaTeX con `\tag`), así
 * "lo que se ve = lo que compila" sin duplicar la bifurcación entorno/numeración.
 *
 * Regla: 1 fila = ecuación suelta (`equation`/`\[…\]`, lo decide quien compila según si
 * la fila lleva número). ≥2 filas = entorno multilínea `align`/`gather` (según `aligned`),
 * con variante `*` (sin números) si **ninguna** fila está numerada.
 */
export interface EquationPlan {
  /** ≥2 filas → se usa un entorno multilínea; 1 fila = ecuación suelta. */
  multiline: boolean
  /** Entorno base cuando `multiline`: `align` (alineado en `&`) o `gather` (centrado). */
  env: 'align' | 'gather'
  /** Ninguna fila numerada → variante `*` (el entorno no emite números). */
  starred: boolean
}

/** `aligned` default **true** (alineadas en `&`); `false` = centradas. */
export function equationPlan(rows: EquationRow[], aligned: boolean | undefined): EquationPlan {
  return {
    multiline: rows.length > 1,
    env: aligned === false ? 'gather' : 'align',
    starred: !rows.some((r) => r.numbered),
  }
}

import { equationPlan, type EquationRow } from '../core'

/**
 * **Armado del cuerpo KaTeX de una fórmula en bloque** para el node view (QA-10, slice 1).
 * Lógica **pura** extraída de `nodes.ts`: espeja al compilador vía `equationPlan`, así el preview
 * del editor y el PDF **no divergen** (la clase de bug de FIX-18, pero en la ecuación). Antes vivía
 * enredada en el node view imperativo, sin cobertura; acá se testea sin jsdom.
 */

/** Filas del attr `rows` del nodo, o una fila vacía si no hay ninguna. */
export function displayRows(node: { attrs: Record<string, unknown> }): EquationRow[] {
  const rows = node.attrs.rows
  return Array.isArray(rows) && rows.length > 0 ? (rows as EquationRow[]) : [{ tex: '' }]
}

/**
 * Cuerpo KaTeX de una fórmula en bloque. **Espeja al compilador** vía `equationPlan`:
 * 1 fila → solo su `tex` (el número lo pone el node view a la derecha); ≥2 filas →
 * `align`/`gather` con `\tag{n}` por fila numerada y `\notag` en el resto, o su variante
 * `*`. Se usan `align`/`gather` (no `aligned`/`gathered`): KaTeX solo admite `\tag`/
 * `\notag` por línea en los numerados.
 */
export function displayBody(rows: EquationRow[], aligned: boolean, nums: (string | null)[]): string {
  const plan = equationPlan(rows, aligned)
  if (!plan.multiline) return rows[0]?.tex ?? ''
  const env = plan.starred ? `${plan.env}*` : plan.env
  const lines = rows.map((row, i) => {
    if (plan.starred) return row.tex
    return nums[i] ? `${row.tex} \\tag{${nums[i]}}` : `${row.tex} \\notag`
  })
  return `\\begin{${env}}${lines.join(' \\\\ ')}\\end{${env}}`
}

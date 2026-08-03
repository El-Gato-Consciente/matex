import { describe, expect, it } from 'vitest'
import type { EquationRow } from '../core'
import { displayBody, displayRows } from './equationDisplay'

describe('displayRows — filas del nodo o una vacía', () => {
  it('devuelve las filas presentes', () => {
    const rows = [{ tex: 'a' }, { tex: 'b' }]
    expect(displayRows({ attrs: { rows } })).toBe(rows)
  })

  it('cae a una fila vacía si no hay filas', () => {
    expect(displayRows({ attrs: {} })).toEqual([{ tex: '' }])
    expect(displayRows({ attrs: { rows: [] } })).toEqual([{ tex: '' }])
  })
})

describe('displayBody — cuerpo KaTeX que espeja al compilador', () => {
  it('una sola fila → solo su tex (sin entorno; el número lo pone el node view)', () => {
    expect(displayBody([{ tex: 'x^2' }], true, [null])).toBe('x^2')
  })

  // El entorno estrellado/numerado lo decide `equationPlan` mirando `row.numbered`; el array
  // `nums` solo aporta el número cuando el plan NO es estrellado (≥1 fila numerada).
  it('≥2 filas numeradas y alineadas → align con \\tag por fila', () => {
    const rows: EquationRow[] = [{ tex: 'a &= b', numbered: true }, { tex: 'c &= d', numbered: true }]
    const body = displayBody(rows, true, ['1', '2'])
    expect(body).toBe('\\begin{align}a &= b \\tag{1} \\\\ c &= d \\tag{2}\\end{align}')
  })

  it('filas sin número (dentro de un bloque numerado) → \\notag', () => {
    const rows: EquationRow[] = [{ tex: 'a &= b', numbered: true }, { tex: 'c &= d' }]
    const body = displayBody(rows, true, ['1', null])
    expect(body).toContain('a &= b \\tag{1}')
    expect(body).toContain('c &= d \\notag')
  })

  it('ninguna fila numerada → entorno estrellado sin \\tag/\\notag', () => {
    const rows: EquationRow[] = [{ tex: 'a &= b' }, { tex: 'c &= d' }]
    const body = displayBody(rows, true, [null, null])
    expect(body).toBe('\\begin{align*}a &= b \\\\ c &= d\\end{align*}')
  })

  it('no alineadas (aligned=false) → gather en vez de align', () => {
    const rows: EquationRow[] = [{ tex: 'x' }, { tex: 'y' }]
    const body = displayBody(rows, false, [null, null])
    expect(body).toContain('\\begin{gather*}')
  })
})

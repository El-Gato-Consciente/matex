import { describe, expect, it } from 'vitest'
import { createDocNumbering, toRoman } from './numbering'
import type { EquationRow } from '../ast'

/**
 * La política de numeración es la **fuente única** que los tres backends comparten. Estos tests
 * fijan las reglas contra la autoridad (el canon de LaTeX, verificado compilando: un teorema
 * antes de toda sección es «0.1», el primero de la §1 es «1.1»).
 */
describe('toRoman', () => {
  it('convierte a romanos', () => {
    expect([1, 2, 3, 4, 5, 9, 40].map(toRoman)).toEqual(['I', 'II', 'III', 'IV', 'V', 'IX', 'XL'])
  })
})

describe('createDocNumbering · partes (ME-46)', () => {
  it('las partes numeran en romanos, contador propio', () => {
    const n = createDocNumbering()
    expect(n.part()).toBe('I')
    expect(n.part()).toBe('II')
  })

  it('una parte NO reinicia los capítulos ni las secciones (como en LaTeX)', () => {
    const n = createDocNumbering()
    n.part()
    expect(n.section(1)).toBe('1')
    expect(n.section(1)).toBe('2')
    n.part() // parte II
    expect(n.section(1)).toBe('3') // los capítulos siguen, no reinician
  })
})

describe('createDocNumbering', () => {
  it('secciones jerárquicas, con reset de los niveles inferiores', () => {
    const n = createDocNumbering()
    expect(n.section(1)).toBe('1')
    expect(n.section(2)).toBe('1.1')
    expect(n.section(2)).toBe('1.2')
    expect(n.section(3)).toBe('1.2.1')
    expect(n.section(1)).toBe('2') // vuelve a nivel 1 → resetea 2 y 3
    expect(n.section(2)).toBe('2.1')
  })

  describe('teoremas: por sección, contador compartido, proof/remark sin número', () => {
    it('antes de toda sección numeran «0.n» (como \\newtheorem[section] en LaTeX)', () => {
      const n = createDocNumbering()
      expect(n.theorem('theorem')).toBe('0.1')
      expect(n.theorem('lemma')).toBe('0.2') // contador COMPARTIDO entre variantes
    })

    it('reinician en cada sección de nivel 1', () => {
      const n = createDocNumbering()
      n.section(1)
      expect(n.theorem('theorem')).toBe('1.1')
      expect(n.theorem('definition')).toBe('1.2')
      n.section(1)
      expect(n.theorem('theorem')).toBe('2.1')
    })

    it('una subsección (nivel 2) NO reinicia el contador de teoremas', () => {
      const n = createDocNumbering()
      n.section(1)
      expect(n.theorem('theorem')).toBe('1.1')
      n.section(2)
      expect(n.theorem('theorem')).toBe('1.2') // sigue en la misma sección de nivel 1
    })

    it('proof y remark no consumen número (ni corren el contador)', () => {
      const n = createDocNumbering()
      n.section(1)
      expect(n.theorem('theorem')).toBe('1.1')
      expect(n.theorem('proof')).toBeNull()
      expect(n.theorem('remark')).toBeNull()
      expect(n.theorem('lemma')).toBe('1.2') // el proof/remark no adelantaron el conteo
    })
  })

  describe('ecuaciones: contador continuo, una por fila numerada', () => {
    const row = (numbered?: boolean): EquationRow => ({ tex: 'x', ...(numbered ? { numbered: true } : {}) })

    it('cada fila marcada recibe el siguiente número, continuo entre bloques', () => {
      const n = createDocNumbering()
      expect(n.equation([row(true), row(false), row(true)], true)).toEqual(['1', null, '2'])
      expect(n.equation([row(true)], undefined)).toEqual(['3'])
    })

    it('un bloque sin ninguna fila numerada no consume números', () => {
      const n = createDocNumbering()
      expect(n.equation([row(false), row(false)], true)).toEqual([null, null])
      expect(n.equation([row(true)], undefined)).toEqual(['1']) // el contador no se movió antes
    })
  })

  describe('figuras y tablas: solo con caption, contadores separados', () => {
    it('numeran solo las que tienen caption', () => {
      const n = createDocNumbering()
      expect(n.figure(true)).toBe('1')
      expect(n.figure(false)).toBeNull()
      expect(n.figure(true)).toBe('2')
    })

    it('figuras y tablas llevan contadores independientes', () => {
      const n = createDocNumbering()
      expect(n.figure(true)).toBe('1')
      expect(n.table(true)).toBe('1') // no continúa el de figuras
      expect(n.table(true)).toBe('2')
      expect(n.figure(true)).toBe('2')
    })
  })
})

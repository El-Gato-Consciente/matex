import { describe, expect, it } from 'vitest'
import { defaultChartSpec, defaultDiagramSpec, defaultDistSpec, defaultTreeSpec } from './defaultSpecs'

describe('defaultChartSpec', () => {
  it('3 categorías, 1 serie; solo la torta muestra leyenda', () => {
    expect(defaultChartSpec('bar')).toMatchObject({ form: 'bar', categories: ['A', 'B', 'C'], legend: false })
    expect(defaultChartSpec('pie').legend).toBe(true)
    // La serie tiene un valor por categoría (invariante que el backend asume).
    const s = defaultChartSpec('bar')
    expect(s.series[0]?.values).toHaveLength(s.categories.length)
  })
})

describe('defaultDistSpec', () => {
  it('una muestra con datos crudos', () => {
    const d = defaultDistSpec('histogram')
    expect(d.form).toBe('histogram')
    expect(d.data[0]?.samples.length).toBeGreaterThan(0)
  })
})

describe('defaultTreeSpec', () => {
  it('una raíz (sin parent) y dos hijos que la referencian', () => {
    const t = defaultTreeSpec()
    const roots = t.nodes.filter((n) => !n.parent)
    expect(roots).toHaveLength(1)
    expect(t.nodes.filter((n) => n.parent === roots[0]?.id)).toHaveLength(2)
  })
})

describe('defaultDiagramSpec', () => {
  it('el cuadrado conmutativo: 4 nodos, 4 aristas, todas entre nodos existentes', () => {
    const d = defaultDiagramSpec()
    expect(d.nodes).toHaveLength(4)
    expect(d.edges).toHaveLength(4)
    const ids = new Set(d.nodes.map((n) => n.id))
    for (const e of d.edges) {
      expect(ids.has(e.from)).toBe(true)
      expect(ids.has(e.to)).toBe(true)
    }
  })
})

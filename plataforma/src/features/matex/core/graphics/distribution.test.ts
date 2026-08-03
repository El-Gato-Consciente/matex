import { describe, expect, it } from 'vitest'
import { boxplot, histogram } from './distribution'

describe('histogram', () => {
  it('agrupa en bins y conserva el total', () => {
    const { edges, counts } = histogram([1, 1, 2, 3, 3, 3], 3)
    expect(counts.length).toBe(3)
    expect(edges.length).toBe(4)
    expect(counts.reduce((a, b) => a + b, 0)).toBe(6) // todos los datos caen en algún bin
  })
  it('vacío → un bin con cuenta 0', () => {
    expect(histogram([]).counts).toEqual([0])
  })
  it('todos iguales → un bin', () => {
    expect(histogram([5, 5, 5]).counts).toEqual([3])
  })
})

describe('boxplot', () => {
  it('cuartiles de 1..9 (median=5, Q1=3, Q3=7), sin outliers', () => {
    const b = boxplot([1, 2, 3, 4, 5, 6, 7, 8, 9])!
    expect(b.median).toBe(5)
    expect(b.q1).toBe(3)
    expect(b.q3).toBe(7)
    expect(b.outliers).toEqual([])
  })
  it('detecta un outlier (100)', () => {
    const b = boxplot([1, 2, 3, 4, 5, 6, 7, 8, 9, 100])!
    expect(b.outliers).toContain(100)
    expect(b.whiskerHi).toBeLessThan(100)
  })
  it('vacío → null', () => {
    expect(boxplot([])).toBeNull()
  })
})

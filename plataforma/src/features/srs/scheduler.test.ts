import { describe, expect, it } from 'vitest'
import { dueDate, intervalDays, nextBox } from './scheduler'

describe('nextBox', () => {
  it('avanza de caja con una respuesta buena', () => {
    expect(nextBox(0, 'good')).toBe(1)
    expect(nextBox(2, 'good')).toBe(3)
  })

  it('reinicia a 0 con una respuesta mala', () => {
    expect(nextBox(4, 'bad')).toBe(0)
    expect(nextBox(0, 'bad')).toBe(0)
  })

  it('topea en la última caja', () => {
    expect(nextBox(5, 'good')).toBe(5)
    expect(nextBox(99, 'good')).toBe(5)
  })
})

describe('intervalDays', () => {
  it('mapea la caja a su intervalo Leitner', () => {
    expect(intervalDays(0)).toBe(0)
    expect(intervalDays(1)).toBe(1)
    expect(intervalDays(5)).toBe(35)
  })

  it('clampa cajas fuera de rango', () => {
    expect(intervalDays(-3)).toBe(0)
    expect(intervalDays(100)).toBe(35)
  })
})

describe('dueDate', () => {
  it('suma el intervalo de días a la fecha base', () => {
    const from = new Date('2026-01-10T00:00:00.000Z')
    expect(dueDate(0, from)).toBe('2026-01-10T00:00:00.000Z')
    expect(dueDate(1, from)).toBe('2026-01-11T00:00:00.000Z')
    expect(dueDate(5, from)).toBe('2026-02-14T00:00:00.000Z')
  })
})

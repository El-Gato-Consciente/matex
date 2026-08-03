import { describe, expect, it } from 'vitest'
import { shuffle } from './shuffle'

describe('shuffle', () => {
  it('no muta la entrada y conserva los elementos', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input)
    expect(input).toEqual([1, 2, 3, 4, 5])
    expect(out).not.toBe(input)
    expect([...out].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
  })

  it('maneja listas vacías y de un elemento', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle(['x'])).toEqual(['x'])
  })
})

import { describe, expect, it } from 'vitest'
import type { PlotSpec } from '../core'
import { addPatch, arrayForType, changeTypePatch, removalPatch, syntaxPatch } from './plotPatch'

function spec(partial: Partial<PlotSpec>): PlotSpec {
  return { functions: [], domain: [-5, 5], ...partial }
}

describe('arrayForType', () => {
  it('devuelve el array del tipo, o vacío si el campo falta', () => {
    const s = spec({ functions: [{ expr: 'x' }], polars: [{ r: '1', tmin: 0, tmax: 6 }] } as Partial<PlotSpec>)
    expect(arrayForType(s, 'function')).toHaveLength(1)
    expect(arrayForType(s, 'polar')).toHaveLength(1)
    expect(arrayForType(s, 'implicit')).toEqual([])
  })
})

describe('removalPatch — borrar una función reindexa lo que la referencia', () => {
  const s = spec({
    functions: [{ expr: 'x' }, { expr: 'x^2' }, { expr: 'x^3' }],
    areas: [
      { fn: 0, from: -1, to: 1 },
      { fn: 2, from: 0, to: 2 },
      { fn: 0, toFn: 2, from: -1, to: 1 },
    ],
    tangents: [{ fn: 2, at: 1 }],
    points: [
      { x: 0, y: 0, fn: 1 },
      { x: 1, y: 1, fn: 2 },
      { x: 2, y: 4 },
    ],
  } as Partial<PlotSpec>)

  it('quita la función y corre los índices mayores en áreas/tangentes/puntos', () => {
    const patch = removalPatch(s, 'function', 1) as {
      functions: unknown[]
      areas: { fn: number; toFn?: number }[]
      tangents: { fn: number }[]
      points: { fn?: number }[]
    }
    expect(patch.functions).toHaveLength(2)
    // fn 2 → 1 (corre uno); fn 0 se queda.
    expect(patch.areas).toEqual([
      { fn: 0, from: -1, to: 1 },
      { fn: 1, from: 0, to: 2 },
      { fn: 0, toFn: 1, from: -1, to: 1 },
    ])
    expect(patch.tangents).toEqual([{ fn: 1, at: 1 }])
  })

  it('desancla los puntos de la función borrada y reindexa el resto', () => {
    const patch = removalPatch(s, 'function', 1) as { points: { x: number; y: number; fn?: number }[] }
    // El punto anclado a fn 1 se desancla (fn undefined, conserva y); el de fn 2 pasa a fn 1; el libre queda.
    expect(patch.points).toEqual([
      { x: 0, y: 0, fn: undefined },
      { x: 1, y: 1, fn: 1 },
      { x: 2, y: 4 },
    ])
  })

  it('descarta áreas que referencian exactamente la función borrada', () => {
    const s2 = spec({ functions: [{ expr: 'x' }, { expr: 'x^2' }], areas: [{ fn: 1, from: 0, to: 1 }] } as Partial<PlotSpec>)
    const patch = removalPatch(s2, 'function', 1) as { areas: unknown[] }
    expect(patch.areas).toEqual([])
  })
})

describe('removalPatch — borrar una serie de datos', () => {
  it('quita la serie, elimina funciones fromData que la usan y reindexa las posteriores', () => {
    const s = spec({
      functions: [
        { expr: 'x' },
        { expr: '', fromData: { series: 0, method: 'linear' } },
        { expr: '', fromData: { series: 1, method: 'linear' } },
      ],
      data: [{ points: [[0, 0]] }, { points: [[1, 1]] }],
    } as unknown as Partial<PlotSpec>)
    const patch = removalPatch(s, 'data', 0) as { data: unknown[]; functions: { fromData?: { series: number } }[] }
    expect(patch.data).toHaveLength(1)
    // La función que usaba la serie 0 se va; la que usaba la serie 1 pasa a 0; la simple queda.
    expect(patch.functions).toHaveLength(2)
    expect(patch.functions.find((f) => f.fromData)?.fromData?.series).toBe(0)
  })
})

describe('addPatch — agrega un ítem por defecto mezclando extra', () => {
  it('agrega una función preservando los campos comunes pasados', () => {
    const patch = addPatch(spec({ functions: [{ expr: 'x' }] } as Partial<PlotSpec>), 'function', { color: 'red' }) as { functions: { expr: string; color?: string }[] }
    expect(patch.functions).toHaveLength(2)
    expect(patch.functions[1]).toEqual({ expr: '', color: 'red' })
  })

  it('crea el array si el tipo estaba ausente', () => {
    const patch = addPatch(spec({}), 'conic', {}) as { conics: { kind: string }[] }
    expect(patch.conics).toHaveLength(1)
    expect(patch.conics[0]?.kind).toBe('circle')
  })
})

describe('changeTypePatch — conversión entre tipos', () => {
  it('null si el tipo no cambia', () => {
    expect(changeTypePatch(spec({ functions: [{ expr: 'x' }] } as Partial<PlotSpec>), 'function', 0, 'function')).toBeNull()
  })

  it('borra del array origen y agrega al destino preservando color/estilo', () => {
    const s = spec({ functions: [{ expr: 'x', color: 'blue', style: 'dashed' } as never] })
    const patch = changeTypePatch(s, 'function', 0, 'polar') as { functions: unknown[]; polars: { color?: string; style?: string }[] }
    expect(patch.functions).toEqual([])
    expect(patch.polars).toHaveLength(1)
    expect(patch.polars[0]?.color).toBe('blue')
    expect(patch.polars[0]?.style).toBe('dashed')
  })
})

describe('syntaxPatch — cambia la notación convirtiendo las expresiones', () => {
  it('null si ya está en el modo pedido', () => {
    expect(syntaxPatch(spec({ syntax: 'ascii' }), 'ascii')).toBeNull()
  })

  it('convierte funciones a LaTeX y marca el nuevo modo', () => {
    const patch = syntaxPatch(spec({ functions: [{ expr: 'x^2' }], syntax: 'ascii' }), 'latex') as { syntax: string; functions: { expr: string }[] }
    expect(patch.syntax).toBe('latex')
    // La conversión concreta la cubre el core; acá basta con que produzca algo y no rompa.
    expect(typeof patch.functions[0]?.expr).toBe('string')
  })
})

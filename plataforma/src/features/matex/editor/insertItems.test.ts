import { describe, expect, it } from 'vitest'
import { filterInsertItems, type InsertItem } from './insertItems'

const item = (id: string, label: string, description = '', keywords?: string): InsertItem => ({
  id,
  group: 'Bloques',
  glyph: '¶',
  label,
  description,
  ...(keywords ? { keywords } : {}),
  run: () => {},
})

const ITEMS = [
  item('math', 'Fórmula en bloque', 'Centrada, en su renglón', 'ecuacion'),
  item('thm', 'Teorema', 'Enunciado numerado'),
  item('plot', 'Gráfico de funciones', 'Curvas y parámetros', 'plot funcion'),
  item('table', 'Tabla', 'Filas y columnas'),
]

describe('filterInsertItems', () => {
  it('sin búsqueda devuelve todo, en orden', () => {
    expect(filterInsertItems(ITEMS, '').map((i) => i.id)).toEqual(['math', 'thm', 'plot', 'table'])
  })

  it('ignora tildes y mayúsculas', () => {
    expect(filterInsertItems(ITEMS, 'formula').map((i) => i.id)).toEqual(['math'])
    expect(filterInsertItems(ITEMS, 'GRÁF').map((i) => i.id)).toEqual(['plot'])
  })

  it('encuentra por cualquier palabra de la etiqueta y por sinónimos', () => {
    expect(filterInsertItems(ITEMS, 'bloque').map((i) => i.id)).toEqual(['math'])
    expect(filterInsertItems(ITEMS, 'ecuacion').map((i) => i.id)).toEqual(['math'])
  })

  it('los que empiezan con la búsqueda van antes que los que solo la contienen', () => {
    // «t»: Teorema y Tabla empiezan con t; «Gráfico de funciones» solo la contiene (en «parámetros»).
    const ids = filterInsertItems(ITEMS, 't').map((i) => i.id)
    expect(ids.slice(0, 2).sort()).toEqual(['table', 'thm'])
  })

  it('sin coincidencias, lista vacía', () => {
    expect(filterInsertItems(ITEMS, 'zzz')).toEqual([])
  })
})

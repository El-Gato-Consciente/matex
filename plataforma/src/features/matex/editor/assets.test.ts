import { describe, expect, it } from 'vitest'
import { buildDataUrls, isTextResourceName, mimeOf, safeAssetName, uniqueName, usedFigureSrcs } from './assets'
import type { BlockNode } from '../core'
import type { ProjectFile } from '@/features/documents/types'

describe('mimeOf', () => {
  it('reconoce las imágenes por extensión; lo demás es octet-stream', () => {
    expect(mimeOf('foto.png')).toBe('image/png')
    expect(mimeOf('a.JPG')).toBe('image/jpeg')
    expect(mimeOf('d.svg')).toBe('image/svg+xml')
    expect(mimeOf('cosa.xyz')).toBe('application/octet-stream')
    expect(mimeOf('sinext')).toBe('application/octet-stream')
  })
})

describe('buildDataUrls', () => {
  it('arma data URIs solo para los archivos base64', () => {
    const files: ProjectFile[] = [
      { path: 'a.png', content: 'AAAA', encoding: 'base64' },
      { path: 'main.tex', content: '\\doc', encoding: 'utf8' }, // texto → no data URI
    ]
    expect(buildDataUrls(files)).toEqual({ 'a.png': 'data:image/png;base64,AAAA' })
  })
})

describe('safeAssetName', () => {
  it('reemplaza caracteres inseguros y nunca queda vacío', () => {
    expect(safeAssetName('mi foto (1).png')).toBe('mi_foto__1_.png')
    expect(safeAssetName('árbol.png')).toBe('_rbol.png')
    expect(safeAssetName('')).toBe('imagen.png') // vacío → default
    expect(safeAssetName('///')).toBe('___') // sin caracteres válidos, pero no vacío
  })
})

describe('isTextResourceName', () => {
  it('distingue recursos de texto de binarios', () => {
    expect(['a.tex', 'r.bib', 'd.dat', 'x.CSV'].map(isTextResourceName)).toEqual([true, true, true, true])
    expect(['foto.png', 'x.zip'].map(isTextResourceName)).toEqual([false, false])
  })
})

describe('uniqueName', () => {
  it('deja el nombre si está libre; si no, agrega -1, -2… antes de la extensión', () => {
    expect(uniqueName('a.png', new Set())).toBe('a.png')
    expect(uniqueName('a.png', new Set(['a.png']))).toBe('a-1.png')
    expect(uniqueName('a.png', new Set(['a.png', 'a-1.png']))).toBe('a-2.png')
    expect(uniqueName('sinext', new Set(['sinext']))).toBe('sinext-1')
  })
})

describe('usedFigureSrcs', () => {
  const imgFig = (src: string): BlockNode => ({ type: 'figure', items: [{ kind: 'image', src }] })

  it('junta las imágenes de figuras al tope del documento', () => {
    expect([...usedFigureSrcs([imgFig('a.png'), imgFig('b.png')])]).toEqual(['a.png', 'b.png'])
  })

  /**
   * El bug que corrige esta extracción (QA-06): la versión vieja solo recorría teoremas y listas,
   * así que una imagen dentro de un callout / razonamiento / columnas / diapositiva / póster /
   * examen se contaba como **sin usar** y podía marcarse para descarte. Ahora recorre todo.
   */
  it('encuentra imágenes anidadas en TODOS los contenedores (antes se perdían)', () => {
    const doc: BlockNode[] = [
      { type: 'callout', variant: 'note', content: [imgFig('callout.png')] },
      { type: 'theorem', variant: 'theorem', content: [imgFig('thm.png')] },
      { type: 'bulletList', items: [{ type: 'listItem', content: [imgFig('list.png')] }] },
      { type: 'reasoning', rows: [{ left: [imgFig('left.png')], right: [imgFig('right.png')] }] },
      { type: 'columns', columns: [{ content: [imgFig('col.png')] }] },
      { type: 'slide', content: [imgFig('slide.png')] },
      { type: 'posterBlock', content: [imgFig('poster.png')] },
      { type: 'examQuestion', content: [imgFig('q.png')], solution: [imgFig('sol.png')] },
    ]
    const found = usedFigureSrcs(doc)
    for (const src of ['callout.png', 'thm.png', 'list.png', 'left.png', 'right.png', 'col.png', 'slide.png', 'poster.png', 'q.png', 'sol.png']) {
      expect(found.has(src)).toBe(true)
    }
  })
})

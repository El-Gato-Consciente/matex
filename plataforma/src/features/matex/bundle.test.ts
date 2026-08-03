import { describe, expect, it } from 'vitest'
import { packMatexBundle, packTexBundle, readMatexBundle } from './bundle'
import type { MatexDoc } from './core'

const ast: MatexDoc = {
  type: 'doc',
  version: 4,
  content: [{ type: 'figure', caption: 'Foto', id: 'f1', items: [{ kind: 'image', src: 'fig.png', width: 0.5 }] }],
}
const images = [{ path: 'fig.png', content: 'aGVsbG8=', encoding: 'base64' as const }]

describe('bundle Matex (.zip)', () => {
  it('pack → read round-trippea el AST y las imágenes (con nombre base)', async () => {
    const blob = await packMatexBundle('doc', ast, images)
    const out = await readMatexBundle(blob)
    expect(out).not.toBeNull()
    expect(out?.ast).toEqual(ast)
    expect(out?.images).toEqual(images)
    expect(out?.textFiles).toEqual([])
  })

  it('round-trippea recursos de texto (.tex/.bib) preservando su ruta (ME-12)', async () => {
    const textFiles = [
      { path: 'figuras/tikz1.tex', content: '\\draw (0,0) -- (1,1);', encoding: 'utf8' as const },
      { path: 'refsuben.bib', content: '@book{k, title={T}}', encoding: 'utf8' as const },
    ]
    const out = await readMatexBundle(await packMatexBundle('doc', ast, images, textFiles))
    expect(out?.images).toEqual(images)
    expect(out?.textFiles).toEqual(textFiles)
  })

  it('readMatexBundle devuelve null si el zip no contiene un .mtex', async () => {
    const texZip = await packTexBundle('\\documentclass{article}', images)
    expect(await readMatexBundle(texZip)).toBeNull()
  })
})

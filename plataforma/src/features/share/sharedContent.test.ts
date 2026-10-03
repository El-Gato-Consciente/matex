import { describe, expect, it } from 'vitest'
import type { Project } from '@/features/documents/types'
import type { MatexDoc } from '@/features/matex/core'
import { readSharedMtex, sharedMtexBlob } from './sharedContent'

const AST: MatexDoc = { type: 'doc', version: 4, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }] }

const PROJECT: Project = {
  id: 'p1',
  name: 'Apunte',
  kind: 'matex',
  ast: AST,
  mainFile: 'main.tex',
  files: [
    { path: 'main.tex', content: '\\documentclass{article}', encoding: 'utf8' },
    { path: 'foto.png', content: 'AAAA', encoding: 'base64' },
  ],
  folderId: 'carpeta-del-autor',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-03T00:00:00Z',
}

describe('contenido de un link .mtex', () => {
  it('ida y vuelta: el documento y sus imágenes llegan; el .tex derivado no viaja de vuelta', async () => {
    const shared = readSharedMtex(JSON.parse(await sharedMtexBlob(PROJECT).text()))
    expect(shared.ast.content).toEqual(AST.content)
    expect(shared.files).toEqual([{ path: 'foto.png', content: 'AAAA', encoding: 'base64' }])
  })

  it('acepta también un .mtex suelto (solo el documento)', () => {
    expect(readSharedMtex(AST)).toMatchObject({ files: [] })
  })

  it('rechaza lo que no es un documento Matex (contenido ajeno: no se confía en su forma)', () => {
    expect(() => readSharedMtex({ hola: 1 })).toThrow()
    expect(() => readSharedMtex(null)).toThrow()
    expect(() => readSharedMtex({ format: 'matex-project', version: 1, project: { name: 'sin ast' } })).toThrow('no contiene un documento')
    expect(() => readSharedMtex({ format: 'matex-project', version: 1, project: { ast: { type: 'doc', content: [{ type: 'inventado' }] } } })).toThrow()
  })

  it('descarta archivos mal formados en vez de importarlos', () => {
    const shared = readSharedMtex({
      format: 'matex-project',
      version: 1,
      project: { ast: AST, files: [{ path: 'ok.png', content: 'AA', encoding: 'base64' }, { path: 7 }, null, 'x'] },
    })
    expect(shared.files.map((file) => file.path)).toEqual(['ok.png'])
  })
})

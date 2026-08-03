import { describe, expect, it } from 'vitest'
import type { ProjectFile } from '@/features/documents/types'
import { buildProjectZip, readProjectZip } from './projectZip'

describe('projectZip · ida y vuelta', () => {
  it('empaqueta y vuelve a leer archivos de texto y binarios', async () => {
    const files: ProjectFile[] = [
      { path: 'main.tex', content: '\\documentclass{article}' },
      { path: 'img.png', content: 'AAAA', encoding: 'base64' },
    ]
    const blob = await buildProjectZip(files)
    const { files: read, mainFile } = await readProjectZip(new File([blob], 'p.zip'))

    expect(mainFile).toBe('main.tex')
    const tex = read.find((f) => f.path === 'main.tex')
    expect(tex?.content).toBe('\\documentclass{article}')
    expect(tex?.encoding).toBe('utf8')
    const img = read.find((f) => f.path === 'img.png')
    expect(img?.encoding).toBe('base64')
    expect(img?.content).toBe('AAAA')
  })
})

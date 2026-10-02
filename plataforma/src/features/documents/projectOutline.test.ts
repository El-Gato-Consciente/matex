import { describe, expect, it } from 'vitest'
import { MATEX_AST_VERSION } from '@/features/matex/core/ast'
import { ACCENT_HEX, DEFAULT_ACCENT_HEX } from '@/features/matex/core/policy/accent'
import { projectOutline } from './projectOutline'
import type { Project } from './types'

const base = {
  id: 'p1',
  name: 'Mi proyecto',
  folderId: null,
  mainFile: 'main.tex',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
} as const

const t = (text: string) => ({ type: 'text' as const, text })

describe('projectOutline · Matex', () => {
  const project: Project = {
    ...base,
    kind: 'matex',
    files: [],
    ast: {
      type: 'doc',
      version: MATEX_AST_VERSION,
      meta: { title: 'Funciones continuas', accent: 'orange', style: 'modern' },
      content: [
        { type: 'heading', level: 1, content: [t('Introducción')] },
        { type: 'paragraph', content: [t('Sea f continua.')] },
        { type: 'mathDisplay', rows: [{ tex: 'x^2' }] },
        { type: 'theorem', kind: 'theorem', content: [] },
      ],
    } as Project['ast'],
  }

  it('toma título, diseño y acento del modelo', () => {
    const outline = projectOutline(project)
    expect(outline.title).toBe('Funciones continuas')
    expect(outline.style).toBe('modern')
    expect(outline.accent).toBe(ACCENT_HEX.orange)
    expect(outline.landscape).toBe(false)
  })

  it('dibuja los bloques en el orden del documento', () => {
    expect(projectOutline(project).blocks.map((b) => b.kind)).toEqual(['heading', 'text', 'math', 'box'])
    expect(projectOutline(project).blocks[0]).toEqual({ kind: 'heading', text: 'Introducción' })
  })

  it('sin título, usa el nombre del proyecto', () => {
    const untitled = { ...project, ast: { ...project.ast!, meta: {} } }
    expect(projectOutline(untitled).title).toBe('Mi proyecto')
    expect(projectOutline(untitled).accent).toBe(DEFAULT_ACCENT_HEX)
  })
})

describe('projectOutline · LaTeX', () => {
  const tex = [
    '\\documentclass{article}',
    '\\title{Informe de \\emph{laboratorio}}',
    '\\begin{document}',
    '\\maketitle',
    '',
    '\\section{Objetivos}',
    'Medir el período del péndulo.',
    '',
    '\\[ T = 2\\pi\\sqrt{L/g} \\]',
    '',
    '\\begin{figure}\\includegraphics{a.png}\\end{figure}',
    '',
    '% un comentario que no cuenta',
    '\\end{document}',
  ].join('\n')
  const project: Project = { ...base, kind: 'latex', files: [{ path: 'main.tex', content: tex }] }

  it('lee el título sin comandos', () => {
    expect(projectOutline(project).title).toBe('Informe de laboratorio')
  })

  it('reconoce secciones, texto, fórmulas y figuras', () => {
    expect(projectOutline(project).blocks.map((b) => b.kind)).toEqual(['heading', 'text', 'math', 'figure'])
  })

  it('beamer es apaisado', () => {
    const deck = { ...project, files: [{ path: 'main.tex', content: '\\documentclass{beamer}\n\\begin{document}\n\\end{document}' }] }
    expect(projectOutline(deck).landscape).toBe(true)
  })
})

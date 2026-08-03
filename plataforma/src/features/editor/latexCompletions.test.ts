import { CompletionContext } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { createLatexCompletionSource, latexCompletionSource } from './latexCompletions'

function complete(doc: string, pos = doc.length) {
  const state = EditorState.create({ doc })
  return latexCompletionSource(new CompletionContext(state, pos, false))
}

function completeWith(paths: string[], doc: string, pos = doc.length) {
  const source = createLatexCompletionSource({ getFilePaths: () => paths })
  const state = EditorState.create({ doc })
  return source(new CompletionContext(state, pos, false))
}

describe('latexCompletionSource', () => {
  it('sugiere comandos después de una barra', () => {
    const result = complete('\\sec')
    expect(result).not.toBeNull()
    expect(result?.options.some((o) => o.label === '\\section')).toBe(true)
  })

  it('sugiere entornos dentro de \\begin{ y apunta el from tras la llave', () => {
    const result = complete('\\begin{item')
    expect(result?.options.some((o) => o.label === 'itemize')).toBe(true)
    expect(result?.from).toBe('\\begin{'.length)
  })

  it('completa \\ref con las etiquetas \\label del documento', () => {
    const result = complete('\\label{eq:uno}\nVer \\ref{')
    expect(result?.options.map((o) => o.label)).toContain('eq:uno')
  })

  it('completa \\cite con claves de un .bib o de \\bibitem', () => {
    const result = complete('@book{knuth84, author={K}}\n\\cite{')
    expect(result?.options.map((o) => o.label)).toContain('knuth84')
  })

  it('completa nombres de paquete dentro de \\usepackage{', () => {
    const result = complete('\\usepackage{book')
    expect(result?.options.map((o) => o.label)).toContain('booktabs')
    expect(result?.from).toBe('\\usepackage{'.length)
  })

  it('completa paquetes tras una coma y con opciones [..]', () => {
    const result = complete('\\usepackage[utf8]{amsmath,ams')
    expect(result?.options.map((o) => o.label)).toContain('amssymb')
    expect(result?.from).toBe('\\usepackage[utf8]{amsmath,'.length)
  })

  it('\\end{ sugiere primero el entorno abierto sin cerrar', () => {
    const result = complete('\\begin{align}\n  x=1\n\\end{')
    expect(result?.options[0]?.label).toBe('align')
  })

  it('completa rutas del proyecto en \\input{ (solo con getFilePaths)', () => {
    const paths = ['secciones/intro.tex', 'secciones/metodos.tex']
    const result = completeWith(paths, '\\input{sec')
    expect(result?.options.map((o) => o.label)).toEqual(paths)
    expect(result?.from).toBe('\\input{'.length)
  })

  it('sin getFilePaths, \\input no ofrece rutas', () => {
    // Cae al comando genérico o null, pero no lista archivos.
    const result = complete('\\input{sec')
    const labels = result?.options.map((o) => o.label) ?? []
    expect(labels).not.toContain('secciones/intro.tex')
  })

  it('no sugiere nada fuera de un contexto LaTeX', () => {
    expect(complete('texto normal ')).toBeNull()
  })
})

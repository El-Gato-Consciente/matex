import { describe, expect, it } from 'vitest'
import { compileToHtml, compileToLatex, parseMatexDoc } from '../matex/core'
import { exemplars } from './data'

/**
 * **Doble versión (ME-23):** cada ejemplar que declara una versión **Matex** (AST) debe (a) ser un
 * `MatexDoc` válido (round-trip por `parseMatexDoc`) y (b) compilar a LaTeX *y* a HTML sin romper.
 * Anti-bitrot: si alguien cambia el modelo/compilador y descuida estas versiones autoradas a mano,
 * el test lo caza (la compilación real a PDF se verifica aparte con `latexmk`).
 */
const withMatex = exemplars.filter((e) => e.matex)

describe('versiones Matex de la galería (ME-23)', () => {
  it('hay al menos un ejemplar con versión Matex (piloto ME-23)', () => {
    expect(withMatex.length).toBeGreaterThanOrEqual(1)
  })

  it.each(withMatex.map((e) => [e.id, e] as const))('«%s»: AST válido + compila a LaTeX y HTML', (_id, exemplar) => {
    const ast = exemplar.matex!
    // (a) es un MatexDoc válido y estable (round-trip zod).
    expect(() => parseMatexDoc(ast)).not.toThrow()
    // (b) compila a LaTeX (documento completo con \begin{document}).
    const tex = compileToLatex(ast)
    expect(tex).toContain('\\begin{document}')
    expect(tex).toContain('\\end{document}')
    // (c) compila a HTML (el 2º backend; standalone). Las presentaciones usan `mx-doc mx-deck`.
    const html = compileToHtml(ast)
    expect(html).toContain('<article class="mx-doc')
  })

  // Un título de nivel 2 sin uno de nivel 1 antes sale numerado «0.1» (pasó en el paper).
  it.each(withMatex.map((e) => [e.id, e] as const))('«%s»: los títulos no saltean niveles', (id, exemplar) => {
    let previous = 0
    for (const block of exemplar.matex!.content) {
      if (block.type !== 'heading') continue
      expect(block.level, `«${id}»: título de nivel ${block.level} después de uno de nivel ${previous}`).toBeLessThanOrEqual(previous + 1)
      previous = block.level
    }
  })

  it('la presentación beamer compila a `\\documentclass{beamer}` con frames', () => {
    const pres = withMatex.find((e) => e.matex?.meta?.family?.kind === 'presentation')
    if (!pres) return
    const tex = compileToLatex(pres.matex!)
    expect(tex).toContain('\\documentclass{beamer}')
    expect(tex).toContain('\\begin{frame}')
  })
})

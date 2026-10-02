import { describe, expect, it } from 'vitest'
import { compileToHtml, compileToLatex, parseMatexDoc } from '../matex/core'
import { templates } from './data'

/**
 * **Plantillas con versión Matex (ME-23):** las que ofrecen "Abrir en Matex" deben ser un `MatexDoc`
 * válido y compilar a LaTeX *y* HTML. Anti-bitrot: si cambia el modelo/compilador y estos AST
 * autorados a mano quedan viejos, el test lo caza antes que el usuario.
 */
const withMatex = templates.filter((t) => t.matex)

describe('plantillas Matex (ME-23)', () => {
  it('hay plantillas que ofrecen la versión Matex', () => {
    expect(withMatex.length).toBeGreaterThanOrEqual(1)
  })

  it.each(withMatex.map((t) => [t.id, t] as const))('«%s»: AST válido + compila a LaTeX y HTML', (_id, template) => {
    const ast = template.matex!
    expect(() => parseMatexDoc(ast)).not.toThrow()
    const tex = compileToLatex(ast)
    expect(tex).toContain('\\begin{document}')
    expect(tex).toContain('\\end{document}')
    expect(compileToHtml(ast)).toContain('<article class="mx-doc')
  })

  // Un título de nivel 2 sin uno de nivel 1 antes sale numerado «0.1» (una subsección sin
  // sección madre). Pasó en Informe/TP y en Resolución de práctica.
  it.each(withMatex.map((t) => [t.id, t] as const))('«%s»: los títulos no saltean niveles', (_id, template) => {
    let previous = 0
    for (const block of template.matex!.content) {
      if (block.type !== 'heading') continue
      expect(block.level, `«${_id}»: título de nivel ${block.level} después de uno de nivel ${previous}`).toBeLessThanOrEqual(previous + 1)
      previous = block.level
    }
  })

  it('la plantilla de presentación compila a beamer con frames', () => {
    const pres = withMatex.find((t) => t.matex?.meta?.family?.kind === 'presentation')
    expect(pres).toBeDefined()
    const tex = compileToLatex(pres!.matex!)
    expect(tex).toContain('\\documentclass{beamer}')
    expect(tex).toContain('\\begin{frame}')
  })
})

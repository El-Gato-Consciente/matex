import { describe, expect, it } from 'vitest'
import { lintLatex } from './canonLint'
import { buildPreamble } from './canon'

const rules = (src: string, opts?: Parameters<typeof lintLatex>[1]) =>
  lintLatex(src, opts).map((i) => i.rule)

const docWith = (preamble: string) => `${preamble}\n\\begin{document}\nHola áéí\n\\end{document}`

describe('lintLatex · PISO', () => {
  it('un documento construido con el canon pasa limpio', () => {
    const src = docWith(buildPreamble({ math: 'full', nav: true }).join('\n'))
    expect(lintLatex(src)).toEqual([])
  })

  it('detecta babel sin es-noshorthands', () => {
    const src = docWith('\\documentclass{article}\n\\usepackage[T1]{fontenc}\n\\usepackage{lmodern}\n\\usepackage[spanish]{babel}\n\\usepackage{microtype}')
    expect(rules(src)).toContain('piso/babel-es-noshorthands')
  })

  it('detecta la falta de fontenc, lmodern y microtype', () => {
    const src = docWith('\\documentclass{article}\n\\usepackage[spanish,es-noshorthands]{babel}')
    const r = rules(src)
    expect(r).toContain('piso/fontenc')
    expect(r).toContain('piso/lmodern')
    expect(r).toContain('piso/microtype')
  })

  it('no aplica el PISO a fragmentos (sin \\documentclass)', () => {
    expect(lintLatex('\\section{Hola}\nUn párrafo.')).toEqual([])
  })

  it('allowMinimal saltea el PISO pero no los anti-patrones', () => {
    const src = docWith('\\documentclass{article}')
    expect(lintLatex(src, { allowMinimal: true })).toEqual([])
    const conAnti = '\\documentclass{article}\n\\begin{document}\n$$x$$\n\\end{document}'
    expect(rules(conAnti, { allowMinimal: true })).toContain('anti/dollar-dollar')
  })
})

describe('lintLatex · anti-patrones', () => {
  const base = buildPreamble({ math: 'full' }).join('\n')
  const wrap = (body: string) => `${base}\n\\begin{document}\n${body}\n\\end{document}`

  it.each([
    ['eqnarray', '\\begin{eqnarray}a&=&b\\end{eqnarray}', 'anti/eqnarray'],
    ['$$', '$$x=1$$', 'anti/dollar-dollar'],
    ['\\SI viejo', '\\SI{10}{\\metre}', 'anti/siunitx-viejo'],
    ['\\hline', '\\begin{tabular}{cc}\\hline a&b\\end{tabular}', 'anti/hline'],
    ['reglas verticales', '\\begin{tabular}{|c|c|}a&b\\end{tabular}', 'anti/reglas-verticales'],
    ['fuente vieja', '{\\bf negrita}', 'anti/fuentes-viejas'],
    ['\\over', '$a \\over b$', 'anti/over'],
    ['\\centerline', '\\centerline{x}', 'anti/centerline'],
  ])('detecta %s', (_name, body, rule) => {
    expect(rules(wrap(body))).toContain(rule)
  })

  it('no confunde \\bfseries / \\item / \\overline con anti-patrones', () => {
    const r = rules(wrap('{\\bfseries x} \\item y $\\overline{z}$'))
    expect(r).not.toContain('anti/fuentes-viejas')
    expect(r).not.toContain('anti/over')
  })

  it('marca cargar amsmath junto a mathtools', () => {
    const src = docWith(
      '\\documentclass{article}\n' +
        buildPreamble({ piso: true }).slice(1).join('\n') +
        '\n\\usepackage{mathtools}\n\\usepackage{amsmath}',
    )
    expect(rules(src)).toContain('redundante/amsmath-con-mathtools')
  })
})

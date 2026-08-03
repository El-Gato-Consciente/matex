import { describe, expect, it } from 'vitest'
import { buildPreamble, PISO_ES, NAV } from './canon'

describe('canon de preámbulo', () => {
  it('el PISO en español trae fontenc, lmodern, babel+es-noshorthands y microtype', () => {
    const piso = PISO_ES.join('\n')
    expect(piso).toContain('[T1]{fontenc}')
    expect(piso).toContain('{lmodern}')
    expect(piso).toContain('[spanish,es-noshorthands]{babel}')
    expect(piso).toContain('{microtype}')
    // El estándar omite inputenc (redundante desde 2018).
    expect(piso).not.toContain('inputenc')
  })

  it('buildPreamble incluye el PISO por defecto y la clase pedida', () => {
    const lines = buildPreamble({ documentclass: '\\documentclass{report}' })
    expect(lines[0]).toBe('\\documentclass{report}')
    expect(lines.join('\n')).toContain('es-noshorthands')
  })

  it('"primer contacto" puede apagar el PISO', () => {
    const lines = buildPreamble({ piso: false })
    expect(lines.join('\n')).not.toContain('babel')
  })

  it('math full carga mathtools (no amsmath suelto)', () => {
    const out = buildPreamble({ math: 'full' }).join('\n')
    expect(out).toContain('{mathtools}')
    expect(out).not.toContain('\\usepackage{amsmath}')
  })

  it('la navegación va al final: hyperref antes que cleveref', () => {
    const lines = buildPreamble({ math: 'full', nav: true })
    const hyper = lines.findIndex((l) => l.includes('hyperref'))
    const cleve = lines.findIndex((l) => l.includes('cleveref'))
    expect(hyper).toBeGreaterThan(-1)
    expect(cleve).toBe(hyper + 1)
    // cleveref es la última línea del preámbulo.
    expect(lines.at(-1)).toBe(NAV.at(-1))
  })

  it('respeta el orden canónico clase → piso → math → graphics → extra → nav', () => {
    const lines = buildPreamble({
      math: 'full',
      graphics: true,
      extra: ['\\usepackage{tcolorbox}'],
      nav: true,
    })
    const idx = (needle: string) => lines.findIndex((l) => l.includes(needle))
    expect(idx('documentclass')).toBeLessThan(idx('fontenc'))
    expect(idx('fontenc')).toBeLessThan(idx('mathtools'))
    expect(idx('mathtools')).toBeLessThan(idx('pgfplots'))
    expect(idx('pgfplots')).toBeLessThan(idx('tcolorbox'))
    expect(idx('tcolorbox')).toBeLessThan(idx('hyperref'))
  })
})

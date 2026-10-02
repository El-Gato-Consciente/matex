import { describe, expect, it } from 'vitest'
import { compileToHtml } from '../html'
import { MATEX_AST_VERSION, type MatexDoc } from '../ast'
import { ACCENT_HEX, accentHex, DEFAULT_ACCENT_HEX } from './accent'

describe('política del acento', () => {
  it('cada acento semántico tiene su color', () => {
    expect(accentHex('orange')).toBe(ACCENT_HEX.orange)
    expect(accentHex(undefined)).toBe(DEFAULT_ACCENT_HEX)
  })

  it('el HTML exportado usa la misma tabla (una sola fuente)', () => {
    const doc: MatexDoc = { type: 'doc', version: MATEX_AST_VERSION, meta: { accent: 'orange' }, content: [] }
    const html = compileToHtml(doc)
    for (const [name, hex] of Object.entries(ACCENT_HEX)) expect(html).toContain(`.mx-accent-${name} { --mx-accent:${hex}; }`)
    expect(html).toContain('mx-accent-orange')
  })
})

import { describe, expect, it } from 'vitest'
import { WIKI_ANIMATIONS } from './animations'
import { allPages, wikiGroups } from './content'

describe('wiki', () => {
  it('los ids de página son únicos', () => {
    const ids = allPages.map((page) => page.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ningún grupo ni página está vacío', () => {
    for (const group of wikiGroups) {
      expect(group.pages.length, group.title).toBeGreaterThan(0)
      for (const page of group.pages) expect(page.blocks.length, page.id).toBeGreaterThan(0)
    }
  })

  it('toda animación registrada aparece en alguna página', () => {
    const used = new Set(allPages.flatMap((page) => page.blocks.flatMap((b) => (b.kind === 'animation' ? [b.id] : []))))
    for (const id of Object.keys(WIKI_ANIMATIONS)) expect(used, id).toContain(id)
  })
})

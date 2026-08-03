import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { exemplars } from '@/features/showcase/data'
import { templates } from '@/features/templates/data'
import { previewManifest } from './manifest.generated'
import { previewFor } from './previews'
import { previewKey, type PreviewKind } from './types'

/**
 * **Anti-bitrot del manifiesto** (`npm run build:previews`). Nada de esto verifica que la imagen
 * *se vea bien* —para eso hay que mirarla—, sino que el manifiesto y el disco no se hayan
 * separado: un `id` renombrado, un asset borrado a mano, una corrida parcial committeada.
 *
 * El test toca el filesystem (excepcional en `src/`) porque es justo lo que hay que comprobar:
 * que cada ruta del manifiesto exista en `public/`. Corre en el entorno `node` de vitest.
 */
const PUBLIC_DIR = fileURLToPath(new URL('../../../public', import.meta.url))

/** Todas las rutas que el manifiesto nombra. */
function referenced(): readonly string[] {
  return Object.values(previewManifest).flatMap((preview) => preview.pages.map((page) => page.src))
}

const known = new Map<string, string>([
  ...templates.map((template) => [previewKey('template', template.id), template.title] as const),
  ...exemplars.map((exemplar) => [previewKey('exemplar', exemplar.id), exemplar.title] as const),
])

describe('manifiesto de vistas previas', () => {
  it('no tiene entradas huérfanas (todo id existe como plantilla o ejemplar)', () => {
    const orphans = Object.keys(previewManifest).filter((key) => !known.has(key))
    expect(orphans).toEqual([])
  })

  it('cada asset que nombra existe en public/', () => {
    const missing = referenced().filter((src) => !existsSync(`${PUBLIC_DIR}${src}`))
    expect(missing).toEqual([])
  })

  it('no hay assets en public/ que el manifiesto no nombre', () => {
    // Basura: pesan en el deploy y nadie los pide. Salen de una corrida parcial committeada.
    const named = new Set(referenced())
    const onDisk = ['templates', 'exemplars'].flatMap((folder) => {
      const dir = `${PUBLIC_DIR}/previews/${folder}`
      return existsSync(dir) ? readdirSync(dir).map((file) => `/previews/${folder}/${file}`) : []
    })
    expect(onDisk.filter((src) => !named.has(src))).toEqual([])
  })

  it('cada preview tiene al menos una página, con tamaño y ruta válidos', () => {
    for (const [key, preview] of Object.entries(previewManifest)) {
      expect(preview.pages.length, key).toBeGreaterThan(0)
      expect(preview.pages.length, key).toBeLessThanOrEqual(preview.pageCount)
      for (const page of preview.pages) {
        expect(page.src, key).toMatch(/^\/previews\/(templates|exemplars)\/.+\.webp$/)
        expect(page.page, key).toBeGreaterThanOrEqual(1)
        expect(page.page, key).toBeLessThanOrEqual(preview.pageCount)
        expect(page.width, key).toBeGreaterThan(0)
        expect(page.height, key).toBeGreaterThan(0)
      }
      // Páginas en orden y sin repetir: la primera es la portada de la tarjeta.
      const numbers = preview.pages.map((page) => page.page)
      expect(numbers, key).toEqual([...new Set(numbers)].sort((a, b) => a - b))
    }
  })
})

describe('previewFor', () => {
  it('resuelve por colección e id', () => {
    const first = Object.keys(previewManifest)[0]
    if (!first) return // manifiesto vacío: nada que resolver
    const [kind, id] = first.split(':') as [PreviewKind, string]
    expect(previewFor(kind, id)).toBe(previewManifest[first])
  })

  it('devuelve undefined para un documento sin preview (no es un error)', () => {
    expect(previewFor('template', 'no-existe')).toBeUndefined()
  })

  it('no confunde colecciones con el mismo id', () => {
    expect(previewKey('template', 'x')).not.toBe(previewKey('exemplar', 'x'))
  })
})

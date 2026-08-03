/**
 * **Generador de las vistas previas** de plantillas y ejemplares (`npm run build:previews`).
 *
 * Compila cada documento contra el backend real —el mismo puerto `LatexCompiler` que usa
 * `verify:content`, o sea la **imagen que va a producción**— y rasteriza sus páginas
 * representativas a WebP. Escribe dos cosas, siempre juntas:
 *
 *   - los assets en `public/previews/{templates,exemplars}/` (estáticos, fuera del bundle);
 *   - el manifiesto `src/features/previews/manifest.generated.ts` que la app importa.
 *
 * ```bash
 * docker compose up compiler        # el backend, en otra terminal
 * npm run build:previews
 * ```
 *
 * Variables de entorno:
 *   MATEX_COMPILE_URL    backend a usar (default `http://localhost:8787`)
 *   MATEX_ONLY=a,b       solo esos ids  → salida PARCIAL, para iterar; no committear
 *   MATEX_LIMIT=N        solo los primeros N de cada colección → ídem
 *   MATEX_CONCURRENCY=N  documentos en paralelo (default 3)
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Por qué es un paso manual y las imágenes se committean**, en vez de generarse en el build:
 * el deploy (`.github/workflows/deploy.yml`) no tiene compilador de LaTeX, y darle uno para
 * dibujar miniaturas ataría cada deploy del front a que el backend compile. Las previews cambian
 * cuando cambia una plantilla —dos veces al año—, así que se generan a mano y viajan en el repo,
 * igual que `plotRuntime.generated.ts`.
 *
 * **Por qué el nombre del archivo lleva un hash del contenido.** El deploy sube todo `dist/` con
 * `Cache-Control: immutable, max-age=1año` salvo `index.html`. Los assets de Vite pueden porque
 * llevan hash; los de `public/` se copian con el nombre tal cual. Sin hash, regenerar una preview
 * dejaría a CloudFront y a los navegadores sirviendo la vieja **durante un año**. Con hash, el
 * archivo nuevo es una URL nueva, el `--delete` del `s3 sync` limpia el viejo, y el manifiesto
 * —que se reescribe en la misma corrida— nunca puede apuntar a un asset que no existe.
 */
import { createHash } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exemplars } from '../src/features/showcase/data'
import { templates } from '../src/features/templates/data'
import { filesInput } from '../src/features/compiler/types'
import type { CompileInput } from '../src/features/compiler/types'
import { previewKey, type Preview, type PreviewKind } from '../src/features/previews/types'
import { applyFilters, assertBackendUp, compilerFromEnv } from './lib/verify-runner'
import { rasterize } from './lib/rasterize'

/** Ancho del bitmap. Alcanza para el visor a ~1.5× en pantallas retina sin inflar el repo. */
const WIDTH = 760
const QUALITY = 78
const MAX_PAGES = 3

const here = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = join(here, '..', 'public', 'previews')
const MANIFEST_FILE = join(here, '..', 'src', 'features', 'previews', 'manifest.generated.ts')

/** Un documento a previsualizar: de dónde sale y qué compilar. */
interface Doc {
  readonly kind: PreviewKind
  /** Subcarpeta de `public/previews/`. */
  readonly folder: string
  readonly id: string
  readonly title: string
  readonly input: CompileInput
}

function docs(): readonly Doc[] {
  return [
    ...applyFilters(templates).map((template) => ({
      kind: 'template' as const,
      folder: 'templates',
      id: template.id,
      title: template.title,
      input: filesInput(template.mainFile ?? 'main.tex', template.source, template.files ?? []),
    })),
    ...applyFilters(exemplars).map((exemplar) => ({
      kind: 'exemplar' as const,
      folder: 'exemplars',
      id: exemplar.id,
      title: exemplar.title,
      input: filesInput(exemplar.mainFile, exemplar.source, exemplar.files ?? []),
    })),
  ]
}

/** Compila, rasteriza y escribe los assets de un documento. */
async function buildOne(doc: Doc, compiler: ReturnType<typeof compilerFromEnv>): Promise<Preview | null> {
  const result = await compiler.compile(doc.input)
  if (!result.ok) {
    const detail = result.diagnostics.map((d) => d.message).join(' | ') || '(sin diagnóstico)'
    console.error(`FAIL  ${doc.kind} ${doc.id}: no compila — ${detail}`)
    return null
  }

  const { pages, pageCount } = await rasterize(result.pdf, {
    width: WIDTH,
    maxPages: MAX_PAGES,
    quality: QUALITY,
  })
  if (pages.length === 0) {
    console.error(`FAIL  ${doc.kind} ${doc.id}: el PDF no tiene páginas`)
    return null
  }

  const dir = join(PUBLIC_DIR, doc.folder)
  await mkdir(dir, { recursive: true })
  const written = await Promise.all(
    pages.map(async (page) => {
      const hash = createHash('sha256').update(page.bytes).digest('hex').slice(0, 8)
      const name = `${doc.id}-p${page.page}.${hash}.webp`
      await writeFile(join(dir, name), page.bytes)
      return {
        src: `/previews/${doc.folder}/${name}`,
        page: page.page,
        width: page.width,
        height: page.height,
      }
    }),
  )

  const bytes = pages.reduce((sum, page) => sum + page.bytes.length, 0)
  console.log(
    `ok    ${doc.kind} ${doc.id} — ${written.length}/${pageCount} pág · ${Math.round(bytes / 1024)} KB`,
  )
  return { pages: written, pageCount }
}

/** Emite el manifiesto. Ordenado por clave: un diff que cambia de orden no se puede revisar. */
function manifestSource(entries: ReadonlyMap<string, Preview>): string {
  const body = [...entries.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, preview]) => {
      const pages = preview.pages
        .map(
          (page) =>
            `      { src: '${page.src}', page: ${page.page}, width: ${page.width}, height: ${page.height} },`,
        )
        .join('\n')
      return `  '${key}': {\n    pageCount: ${preview.pageCount},\n    pages: [\n${pages}\n    ],\n  },`
    })
    .join('\n')

  return [
    '/**',
    ' * GENERADO por `npm run build:previews`. No editar a mano.',
    ' *',
    ' * Las imágenes viven en `public/previews/` (assets estáticos, fuera del bundle); acá solo',
    ' * están sus rutas y tamaños. El nombre de cada archivo lleva un hash de su contenido, así',
    ' * que este archivo y los assets se regeneran juntos y no pueden quedar desfasados.',
    ' */',
    "import type { PreviewManifest } from './types'",
    '',
    'export const previewManifest: PreviewManifest = {',
    body,
    '}',
    '',
  ].join('\n')
}

// ── main ──────────────────────────────────────────────────────────────────────────────────
await assertBackendUp()

const partial = Boolean(process.env.MATEX_ONLY || process.env.MATEX_LIMIT)
const targets = docs()
const compiler = compilerFromEnv()
const concurrency = Number(process.env.MATEX_CONCURRENCY) || 3

// Se borra todo antes de empezar: los nombres llevan hash, así que sin limpieza cada corrida
// dejaría los archivos de la anterior como basura invisible (el manifiesto ya no los nombra).
if (!partial) await rm(PUBLIC_DIR, { recursive: true, force: true })

const results = new Map<string, Preview>()
let failed = 0
let next = 0
await Promise.all(
  Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
    for (let i = next++; i < targets.length; i = next++) {
      const doc = targets[i]!
      const preview = await buildOne(doc, compiler)
      if (preview) results.set(previewKey(doc.kind, doc.id), preview)
      else failed++
    }
  }),
)

// El manifiesto es una foto **completa**: si se escribiera con un subconjunto, los documentos
// que no entraron en la corrida perderían su preview sin que nadie los toque. En modo parcial
// (para iterar) se generan los assets y se imprime el fragmento, pero el manifiesto no se pisa.
if (partial) {
  console.log(`\n${manifestSource(results)}`)
  console.error(
    '⚠  Corrida PARCIAL (MATEX_ONLY / MATEX_LIMIT): el manifiesto NO se escribió (arriba, el\n' +
      '   fragmento que habría generado). Corré el script completo antes de committear.',
  )
  process.exit(failed ? 1 : 0)
}

await writeFile(MANIFEST_FILE, manifestSource(results), 'utf8')
console.log(`\n${results.size} previews · ${failed ? `${failed} FALLOS` : 'TODO OK'}`)
process.exit(failed ? 1 : 0)

/**
 * **Verificación de contenido (anti-bitrot).** Compila contra el backend real *todo* lo que la
 * app promete que compila: el ejemplo y la solución de cada lección, cada ejemplar de la
 * galería, cada plantilla, y la versión Matex de ejemplares y plantillas (ME-23). Falla con
 * código ≠0 si algo no compila.
 *
 * ```bash
 * docker compose up compiler          # el backend, en otra terminal
 * npm run verify:content
 * ```
 *
 * Variables de entorno:
 *   MATEX_COMPILE_URL    backend a usar (default `http://localhost:8787`)
 *   MATEX_LIMIT=N        solo los primeros N de cada colección (smoke test)
 *   MATEX_ONLY=a,b       solo esos ids (reemplaza al viejo script `compile-some`)
 *   MATEX_CONCURRENCY=N  compilaciones en paralelo (default 4)
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Por qué las listas salen de los índices y no se enumeran acá.** `levels`, `exemplars` y
 * `templates` son los índices que la app misma consume, validados con zod al cargar. La versión
 * anterior de este script enumeraba los archivos a mano (`['nivel0.ts', …]`, los 11 de showcase,
 * los 3 de plantillas) y solo usaba los índices para la parte Matex — o sea, la misma
 * información obtenida de dos formas distintas en el mismo archivo. El resultado era bitrot
 * dentro del script anti-bitrot: agregar un ejemplar nuevo lo dejaba cubierto por la
 * verificación Matex y **salteado en silencio** por la de LaTeX. Al pasar por el índice, algo
 * nuevo queda cubierto por el solo hecho de existir.
 */
import { compileToLatex } from '../src/features/matex/core/compile'
import { emitBibtex } from '../src/features/matex/core/bibtex'
import type { MatexDoc } from '../src/features/matex/core/ast'
import { levels } from '../src/features/lessons/content'
import { exemplars } from '../src/features/showcase/data'
import { templates } from '../src/features/templates/data'
import { filesInput, singleFileInput, type CompileFile } from '../src/features/compiler/types'
import { matexSample } from './fixtures/matex-sample'
import {
  applyFilters,
  assertBackendUp,
  compilerFromEnv,
  runTargets,
  type Target,
} from './lib/verify-runner'

/** Lecciones: el ejemplo y la solución del desafío, con sus archivos acompañantes. */
function lessonTargets(): Target[] {
  const targets: Target[] = []
  for (const level of levels) {
    for (const lesson of applyFilters(level.lessons)) {
      const extra = lesson.files ?? []
      for (const [label, source] of [
        ['example', lesson.example],
        ['solution', lesson.challenge?.solution],
      ] as const) {
        if (!source) continue
        targets.push({
          name: `${lesson.id} · ${label}`,
          input: filesInput(lesson.mainFile, source, extra),
        })
      }
    }
  }
  return targets
}

/** Galería y plantillas: el `source` LaTeX tal cual lo ve el usuario. */
function sourceTargets(): Target[] {
  return [
    ...applyFilters(exemplars).map((exemplar) => ({
      name: `ejemplar ${exemplar.id}`,
      input: filesInput(exemplar.mainFile, exemplar.source, exemplar.files ?? []),
    })),
    ...applyFilters(templates).map((template) => ({
      name: `plantilla ${template.id}`,
      input: filesInput(template.mainFile ?? 'main.tex', template.source, template.files ?? []),
    })),
  ]
}

/**
 * Versiones Matex (ME-23): el AST de cada ejemplar/plantilla debe seguir compilando a un PDF
 * real. Cubre las 6 familias de documento y, desde LE-02, que la clase **derivada** del diseño
 * semántico sea la correcta en cada una.
 */
function matexTargets(): Target[] {
  // Igual que el editor (`MatexWorkspace`): la bibliografía va como `refs.bib` **real** del
  // proyecto, no embebida con `filecontents` (que el backend bloquea por `openout_any=p`).
  const fromDoc = (name: string, doc: MatexDoc): Target => {
    const references = doc.references ?? []
    const files: CompileFile[] = [
      { path: 'main.tex', content: compileToLatex(doc, { bibFile: 'refs.bib' }) },
    ]
    if (references.length > 0) files.push({ path: 'refs.bib', content: emitBibtex(references) })
    return { name, input: { files, mainFile: 'main.tex' } }
  }

  return [
    { name: 'matex (compilador Matex→LaTeX)', input: singleFileInput(compileToLatex(matexSample)) },
    ...applyFilters(exemplars)
      .filter((exemplar) => exemplar.matex)
      .map((exemplar) => fromDoc(`matex ejemplar ${exemplar.id}`, exemplar.matex!)),
    ...applyFilters(templates)
      .filter((template) => template.matex)
      .map((template) => fromDoc(`matex plantilla ${template.id}`, template.matex!)),
  ]
}

await assertBackendUp()
const failed = await runTargets(
  [...lessonTargets(), ...sourceTargets(), ...matexTargets()],
  compilerFromEnv(),
)
process.exit(failed ? 1 : 0)

/**
 * **QA-08 · equivalencia contra LaTeX compilado (la autoridad final).**
 *
 * La capa rápida (vitest, `numbering-equivalence.test.tsx`) compara el editor con el HTML. Pero
 * el backend LaTeX **no numera en código**: delega en TeX. Su número "de verdad" solo existe tras
 * compilar. Este script compila un documento representativo, lee los números que TeX asignó (del
 * `.aux`) y verifica que coincidan con la política (`core/policy/numbering.ts`).
 *
 * ```bash
 * npx tsx --tsconfig tsconfig.scripts.json scripts/verify-numbering.ts
 * ```
 *
 * **Requiere `latexmk` en el PATH**, y es el único verificador que lo requiere: necesita el
 * `.aux`, que el puerto `LatexCompiler` no expone (devuelve el PDF o los diagnósticos, no los
 * archivos intermedios). Extender la API del backend para exponer el `.aux` sería agrandar el
 * contrato público por una herramienta de QA; correr `latexmk` local es el precio más barato.
 *
 * (Antes vivía en `backend/scripts/` e importaba `LatexmkCompiler` **sin usarlo nunca** — ese
 * import muerto era lo único que lo hacía parecer un script del backend. No lo es: verifica una
 * política del núcleo de Matex contra TeX.)
 */
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileToLatex } from '../src/features/matex/core/compile'
import { createDocNumbering } from '../src/features/matex/core/policy/numbering'
import { numberingSample } from './fixtures/numbering-sample'

/** Números que TeX asignó de verdad, leídos del `.aux` (`\newlabel{id}{{N}...}`). */
async function latexNumbers(dir: string): Promise<Map<string, string>> {
  const aux = await readFile(join(dir, 'main.aux'), 'utf8').catch(() => '')
  const out = new Map<string, string>()
  for (const match of aux.matchAll(/\\newlabel\{([^}]*)\}\{\{([^}]*)\}/g)) {
    out.set(match[1]!, match[2]!)
  }
  return out
}

/** Numeración esperada según la política (la fuente única). */
function expectedNumbers(): Map<string, string> {
  const numbering = createDocNumbering()
  const out = new Map<string, string>()
  for (const block of numberingSample.content) {
    if (block.type === 'part') {
      if (block.id) out.set(block.id, numbering.part())
    } else if (block.type === 'heading') {
      numbering.section(block.level)
    } else if (block.type === 'theorem') {
      const number = numbering.theorem(block.variant)
      if (number && block.id) out.set(block.id, number)
    }
  }
  return out
}

const dir = await mkdtemp(join(tmpdir(), 'mxnum-'))
try {
  await writeFile(join(dir, 'main.tex'), compileToLatex(numberingSample), 'utf8')
  await new Promise<void>((resolve) => {
    const child = spawn('latexmk', ['-pdf', '-interaction=nonstopmode', 'main.tex'], { cwd: dir })
    child.on('close', () => resolve())
    child.on('error', () => resolve())
  })

  const expected = expectedNumbers()
  const actual = await latexNumbers(dir)

  let failed = 0
  for (const [id, number] of expected) {
    const real = actual.get(id)
    const ok = real === number
    if (!ok) failed += 1
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${id.padEnd(8)} política=${number.padEnd(5)} LaTeX=${real ?? '(ausente)'}`)
  }
  console.log(
    `\n${expected.size} referencias · ${failed ? `${failed} DIVERGEN` : 'la política coincide con LaTeX'}`,
  )
  process.exit(failed ? 1 : 0)
} finally {
  await rm(dir, { recursive: true, force: true })
}

import { describe, expect, it } from 'vitest'
import { lintLatex, type LintIssue } from '@/features/matex/core/latex/canonLint'
import { allLessons } from '@/features/lessons/content/index'
import { exemplars } from '@/features/showcase/data/index'
import { templates } from '@/features/templates/data/index'

/**
 * QA de canon sobre TODO el corpus: ningún documento completo (lección, ejemplar,
 * plantilla) debe violar el canon (`canon.ts` / `estandares.tex`). Es la red que
 * impide que el código que enviamos vuelva a divergir del estándar. Anti-bitrot,
 * complementa a `verify-content` (que además compila).
 *
 * `ALLOW_MINIMAL`: lecciones de "primer contacto" cuyo objetivo es el documento
 * más chico posible; se saltean el PISO (pero no los anti-patrones). Mantener
 * mínima y justificada.
 */
const ALLOW_MINIMAL = new Set(['l0-bienvenida', 'l0-primer-documento'])

const fmt = (issues: LintIssue[]) => issues.map((i) => `${i.rule}: ${i.message}`).join('\n   ')

describe('canon · corpus de lecciones', () => {
  // Se lintea el `example` y la `solution` (los artefactos "correctos" que el
  // alumno ve como modelo). El `starter` NO: es un andamio incompleto a propósito
  // (a veces el ejercicio es, justamente, completar el preámbulo).
  const docs = allLessons.flatMap((lesson) => {
    const allowMinimal = ALLOW_MINIMAL.has(lesson.id)
    const items: Array<[string, string]> = [[`${lesson.id} · example`, lesson.example]]
    if (lesson.challenge?.solution) items.push([`${lesson.id} · solution`, lesson.challenge.solution])
    return items.map(([name, src]) => ({ name, src, allowMinimal }))
  })

  it.each(docs.map((d) => [d.name, d] as const))('%s cumple el canon', (_name, d) => {
    const issues = lintLatex(d.src, { allowMinimal: d.allowMinimal })
    expect(issues, `\n${d.name}:\n   ${fmt(issues)}`).toEqual([])
  })
})

describe('canon · galería y plantillas', () => {
  it.each(exemplars.map((e) => [e.id, e.source] as const))('ejemplar %s cumple el canon', (_id, source) => {
    const issues = lintLatex(source)
    expect(issues, `\n   ${fmt(issues)}`).toEqual([])
  })

  it.each(templates.map((t) => [t.id, t.source] as const))('plantilla %s cumple el canon', (_id, source) => {
    const issues = lintLatex(source)
    expect(issues, `\n   ${fmt(issues)}`).toEqual([])
  })
})

import { useState } from 'react'
import { evaluateChallenge, type ChallengeResult } from './grader'
import type { Lesson } from './types'

interface LessonChallengeProps {
  lesson: Lesson
  /** Fuente actual del editor, para corregir. */
  currentSource: string
  /** Carga código en el editor (el starter del desafío). */
  onLoadIntoEditor: (code: string) => void
  /** Se llama cuando el desafío se aprueba, para registrar progreso. */
  onChallengePassed: (lessonId: string) => void
}

/** Sección del desafío: consigna, acciones, pistas y corrección. */
export function LessonChallenge({
  lesson,
  currentSource,
  onLoadIntoEditor,
  onChallengePassed,
}: LessonChallengeProps) {
  const challenge = lesson.challenge
  const [result, setResult] = useState<ChallengeResult | null>(null)
  const [showHint, setShowHint] = useState(false)

  if (!challenge) return null

  function handleVerify() {
    if (!challenge) return
    const evaluation = evaluateChallenge(challenge, currentSource)
    setResult(evaluation)
    if (evaluation.passed) onChallengePassed(lesson.id)
  }

  return (
    <section className="rounded-lg border border-(--color-border) bg-(--color-surface) p-4">
      <h2 className="mb-1 text-sm font-semibold">Desafío</h2>
      <p className="mb-3 text-sm text-(--color-ink-muted)">{challenge.prompt}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleVerify}
          className="rounded-md bg-(--color-primary) px-3 py-1.5 text-sm font-medium text-(--color-primary-ink) hover:opacity-90"
        >
          Verificar
        </button>
        <button
          type="button"
          onClick={() => {
            onLoadIntoEditor(challenge.starter)
            setResult(null)
          }}
          className="rounded-md border border-(--color-border) px-3 py-1.5 text-sm hover:bg-(--color-surface-muted)"
        >
          Reiniciar
        </button>
        <button
          type="button"
          onClick={() => {
            onLoadIntoEditor(challenge.solution ?? lesson.example)
            setResult(null)
          }}
          className="rounded-md border border-(--color-border) px-3 py-1.5 text-sm hover:bg-(--color-surface-muted)"
        >
          Ver solución
        </button>
        {challenge.hints.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHint((value) => !value)}
            className="rounded-md px-2 py-1.5 text-sm text-(--color-ink-muted) hover:text-(--color-ink)"
          >
            {showHint ? 'Ocultar pistas' : 'Ver pistas'}
          </button>
        )}
      </div>

      {showHint && challenge.hints.length > 0 && (
        <ul className="mt-3 ml-5 list-disc space-y-1 text-xs text-(--color-ink-muted)">
          {challenge.hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      )}

      {result && <ChallengeFeedback result={result} />}
    </section>
  )
}

function ChallengeFeedback({ result }: { result: ChallengeResult }) {
  if (result.passed) {
    return <p className="mt-3 text-sm font-medium text-(--color-success)">¡Correcto! Lección completada.</p>
  }
  return (
    <div className="mt-3 text-sm text-(--color-danger)">
      <p>Todavía falta incluir:</p>
      <ul className="mt-1 list-inside list-disc font-mono text-xs">
        {result.missing.map((fragment) => (
          <li key={fragment}>{fragment}</li>
        ))}
      </ul>
    </div>
  )
}

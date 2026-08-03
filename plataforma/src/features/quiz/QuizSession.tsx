import { useMemo, useState } from 'react'
import { findLesson } from '@/features/lessons/content'
import type { ReviewStore } from '@/features/srs/ReviewStore'
import { shuffle } from '@/lib/shuffle'
import { questionsInScope, type QuizScope } from './pool'

interface QuizSessionProps {
  store: ReviewStore
  /** Lección y nivel actuales, para el filtro "esta lección" / "este nivel". */
  lessonId: string
  level: number
  /** Se llama tras responder (para refrescar el contador de pendientes). */
  onAnswered: () => void
}

const SCOPES: ReadonlyArray<{ value: QuizScope; label: string }> = [
  { value: 'lesson', label: 'Esta lección' },
  { value: 'level', label: 'Este nivel' },
  { value: 'all', label: 'Todas' },
]

export function QuizSession({ store, lessonId, level, onAnswered }: QuizSessionProps) {
  const [scope, setScope] = useState<QuizScope>('lesson')
  const [pool, setPool] = useState(() => shuffle(questionsInScope('lesson', lessonId, level)))
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)

  const current = pool[index]
  const options = useMemo(
    () => (current ? shuffle([current.answer, ...current.distractors]) : []),
    [current],
  )

  function loadPool(nextScope: QuizScope) {
    setPool(shuffle(questionsInScope(nextScope, lessonId, level)))
    setIndex(0)
    setSelected(null)
    setScore(0)
  }

  function restart() {
    loadPool(scope)
  }

  function changeScope(next: QuizScope) {
    if (next === scope) return
    setScope(next)
    loadPool(next)
  }

  function choose(option: string) {
    if (selected !== null || !current) return
    setSelected(option)
    const correct = option === current.answer
    if (correct) setScore((value) => value + 1)
    store.review(current.id, correct ? 'good' : 'bad')
    onAnswered()
  }

  return (
    <div className="flex h-full flex-col bg-(--color-surface-muted)">
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-(--color-border) bg-(--color-surface) px-4 py-2">
        <span className="text-xs text-(--color-ink-muted)">Practicar:</span>
        <div className="flex rounded-md border border-(--color-border) p-0.5 text-sm">
          {SCOPES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => changeScope(option.value)}
              className={[
                'rounded px-3 py-1',
                scope === option.value
                  ? 'bg-(--color-primary) text-(--color-primary-ink)'
                  : 'text-(--color-ink-muted) hover:text-(--color-ink)',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {pool.length === 0 ? (
          <Centered>
            <p className="text-(--color-ink-muted)">Todavía no hay preguntas para este filtro.</p>
            <p className="mt-1 text-sm text-(--color-ink-muted)">Probá con “Este nivel” o “Todas”.</p>
          </Centered>
        ) : !current ? (
          <Centered>
            <p className="text-lg font-medium text-(--color-ink)">Resultado</p>
            <p className="mt-1 text-(--color-ink-muted)">
              Acertaste {score} de {pool.length}.
            </p>
            <button
              type="button"
              onClick={restart}
              className="mt-4 rounded-md bg-(--color-primary) px-4 py-2 text-sm font-medium text-(--color-primary-ink) hover:opacity-90"
            >
              Volver a empezar
            </button>
          </Centered>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
            <p className="text-center text-xs text-(--color-ink-muted)">
              {index + 1} / {pool.length} · {findLesson(current.lessonId)?.title ?? ''}
            </p>

            <h2 className="text-center text-lg font-medium text-(--color-ink)">{current.prompt}</h2>

            <div className="flex flex-col gap-2">
              {options.map((option) => (
                <OptionButton
                  key={option}
                  option={option}
                  answered={selected !== null}
                  isCorrect={option === current.answer}
                  isSelected={option === selected}
                  onChoose={() => choose(option)}
                />
              ))}
            </div>

            {selected !== null && (
              <div className="rounded-lg border border-(--color-border) bg-(--color-surface) p-4">
                <p
                  className={[
                    'mb-2 text-sm font-semibold',
                    selected === current.answer ? 'text-(--color-success)' : 'text-(--color-danger)',
                  ].join(' ')}
                >
                  {selected === current.answer ? '¡Correcto!' : 'No era esa.'}
                </p>
                <p className="text-sm leading-relaxed text-(--color-ink-muted)">{current.explanation}</p>
                <button
                  type="button"
                  onClick={() => {
                    setIndex((value) => value + 1)
                    setSelected(null)
                  }}
                  className="mt-3 rounded-md bg-(--color-primary) px-4 py-1.5 text-sm font-medium text-(--color-primary-ink) hover:opacity-90"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface OptionButtonProps {
  option: string
  answered: boolean
  isCorrect: boolean
  isSelected: boolean
  onChoose: () => void
}

function OptionButton({ option, answered, isCorrect, isSelected, onChoose }: OptionButtonProps) {
  let tone = 'border-(--color-border) hover:bg-(--color-surface)'
  if (answered) {
    if (isCorrect) tone = 'border-(--color-success) text-(--color-success)'
    else if (isSelected) tone = 'border-(--color-danger) text-(--color-danger)'
    else tone = 'border-(--color-border) opacity-60'
  }
  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={answered}
      className={['rounded-lg border px-4 py-2.5 text-left font-mono text-sm transition-colors', tone].join(' ')}
    >
      {option}
    </button>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">{children}</div>
  )
}

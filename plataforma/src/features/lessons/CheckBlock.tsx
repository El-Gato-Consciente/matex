import { useMemo, useState } from 'react'
import { questionsInScope } from '@/features/quiz/pool'
import type { Question } from '@/features/quiz/types'
import { shuffle } from '@/lib/shuffle'
import { useLessonHost } from './LessonHost'
import type { Lesson } from './types'

interface CheckBlockProps {
  lesson: Lesson
  title?: string | undefined
}

/**
 * Bloque `check`: las preguntas del banco de esta lección, en línea. Se puede
 * reintentar hasta acertar, pero al SRS solo va el **primer** intento (es lo que
 * mide si lo sabías). Acertarlas todas avisa a la app (`onCheckPassed`).
 */
export function CheckBlock({ lesson, title }: CheckBlockProps) {
  const host = useLessonHost()
  const questions = useMemo(() => questionsInScope('lesson', lesson.id, lesson.level), [lesson])
  const [solved, setSolved] = useState<ReadonlySet<string>>(new Set())

  if (questions.length === 0) return null

  function handleSolved(questionId: string) {
    const next = new Set(solved).add(questionId)
    setSolved(next)
    if (next.size === questions.length) host.onCheckPassed(lesson.id)
  }

  const done = solved.size === questions.length

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title ?? '¿Te quedó?'}</h2>
        <span className="text-xs text-(--color-ink-muted)">
          {solved.size}/{questions.length}
        </span>
      </header>
      {questions.map((question, index) => (
        <CheckQuestion
          key={question.id}
          number={index + 1}
          question={question}
          onFirstAnswer={(correct) => {
            host.reviewStore.review(question.id, correct ? 'good' : 'bad')
            host.onAnswered()
          }}
          onSolved={() => handleSolved(question.id)}
        />
      ))}
      {done && (
        <p className="rounded-md border border-(--color-success) px-3 py-2 text-sm text-(--color-success)">
          ¡Listo! Las respondiste todas. Vas a volver a verlas en <strong>Repasar</strong> cuando toque.
        </p>
      )}
    </section>
  )
}

interface CheckQuestionProps {
  number: number
  question: Question
  onFirstAnswer: (correct: boolean) => void
  onSolved: () => void
}

function CheckQuestion({ number, question, onFirstAnswer, onSolved }: CheckQuestionProps) {
  const options = useMemo(() => shuffle([question.answer, ...question.distractors]), [question])
  const [wrong, setWrong] = useState<ReadonlySet<string>>(new Set())
  const [solved, setSolved] = useState(false)

  function choose(option: string) {
    if (solved || wrong.has(option)) return
    const correct = option === question.answer
    if (wrong.size === 0) onFirstAnswer(correct)
    if (correct) {
      setSolved(true)
      onSolved()
    } else {
      setWrong(new Set(wrong).add(option))
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md bg-(--color-surface) p-3">
      <p className="text-[15px] font-medium text-(--color-ink)">
        <span className="mr-1.5 text-(--color-ink-muted)">{number}.</span>
        {question.prompt}
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {options.map((option) => {
          const isWrong = wrong.has(option)
          const isAnswer = solved && option === question.answer
          return (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              disabled={solved || isWrong}
              className={[
                'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                isAnswer
                  ? 'border-(--color-success) text-(--color-success)'
                  : isWrong
                    ? 'border-(--color-danger) text-(--color-danger) line-through opacity-70'
                    : solved
                      ? 'border-(--color-border) opacity-50'
                      : 'border-(--color-border) hover:border-(--color-primary) hover:bg-(--color-surface-muted)',
              ].join(' ')}
            >
              {option}
            </button>
          )
        })}
      </div>
      {solved ? (
        <p className="text-sm leading-relaxed text-(--color-ink-muted)">{question.explanation}</p>
      ) : (
        wrong.size > 0 && <p className="text-sm text-(--color-danger)">No era esa. Probá con otra.</p>
      )}
    </div>
  )
}

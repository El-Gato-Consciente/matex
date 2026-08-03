// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QuizSession } from './QuizSession'
import { questionsInScope } from './pool'
import { LocalReviewStore } from '@/features/srs/LocalReviewStore'
import { createFakeStorage } from '@/test/fakeStorage'

// `shuffle` aleatoriza pool y opciones; lo neutralizamos para tener un orden
// determinístico (pool en orden de declaración, respuesta correcta primera).
vi.mock('@/lib/shuffle', () => ({ shuffle: <T,>(items: readonly T[]): T[] => [...items] }))

const LESSON = 'l0-primer-documento'
const first = questionsInScope('lesson', LESSON, 0)[0]!

function setup() {
  const store = new LocalReviewStore(createFakeStorage())
  const onAnswered = vi.fn()
  render(<QuizSession store={store} lessonId={LESSON} level={0} onAnswered={onAnswered} />)
  return { store, onAnswered }
}

describe('QuizSession', () => {
  it('muestra la primera pregunta con todas sus opciones', () => {
    setup()
    expect(screen.getByText(first.prompt)).toBeInTheDocument()
    for (const option of [first.answer, ...first.distractors]) {
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument()
    }
    // Sin responder no se ve la explicación.
    expect(screen.queryByText(first.explanation)).not.toBeInTheDocument()
  })

  it('al elegir la opción correcta: marca correcto, explica, avisa y reprograma el SRS', () => {
    const { store, onAnswered } = setup()
    fireEvent.click(screen.getByRole('button', { name: first.answer }))

    expect(screen.getByText('¡Correcto!')).toBeInTheDocument()
    expect(screen.getByText(first.explanation)).toBeInTheDocument()
    expect(onAnswered).toHaveBeenCalledTimes(1)
    // 'good' sube la caja a 1 y deja el ítem no-vencido.
    expect(store.get(first.id)?.box).toBe(1)
    expect(store.isDue(first.id)).toBe(false)
  })

  it('al elegir una opción incorrecta: lo marca y registra el fallo', () => {
    const { store, onAnswered } = setup()
    fireEvent.click(screen.getByRole('button', { name: first.distractors[0]! }))

    expect(screen.getByText('No era esa.')).toBeInTheDocument()
    expect(onAnswered).toHaveBeenCalledTimes(1)
    expect(store.get(first.id)?.box).toBe(0)
  })

  it('responder bloquea seguir eligiendo (una sola review por pregunta)', () => {
    const { store } = setup()
    const review = vi.spyOn(store, 'review')
    fireEvent.click(screen.getByRole('button', { name: first.answer }))
    fireEvent.click(screen.getByRole('button', { name: first.distractors[0]! }))
    expect(review).toHaveBeenCalledTimes(1)
  })

  it('"Siguiente" avanza a la pregunta que sigue', () => {
    const second = questionsInScope('lesson', LESSON, 0)[1]
    setup()
    fireEvent.click(screen.getByRole('button', { name: first.answer }))
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    if (second) {
      expect(screen.getByText(second.prompt)).toBeInTheDocument()
    } else {
      expect(screen.getByText('Resultado')).toBeInTheDocument()
    }
  })
})

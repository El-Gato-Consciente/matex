import { LessonContent } from './LessonContent'
import type { Lesson } from './types'

interface LessonReaderProps {
  lesson: Lesson
  /** Pasa al modo Ejemplo (ver el ejemplo completo). */
  onExample: () => void
  /** Pasa al modo Practicar (hacer la práctica). */
  onPractice: () => void
}

/**
 * Modo **Aprender**: el contenido (MDX) al centro, en una columna de lectura
 * cómoda, sin que el editor compita por espacio. Termina con un llamado a
 * practicar.
 */
export function LessonReader({ lesson, onExample, onPractice }: LessonReaderProps) {
  return (
    <div className="h-full overflow-auto">
      <article className="mx-auto max-w-2xl px-6 py-12 text-[17px] leading-relaxed text-(--color-ink)">
        <header className="mb-7">
          <p className="mb-1 text-xs font-semibold tracking-wide text-(--color-primary) uppercase">
            Nivel {lesson.level}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{lesson.title}</h1>
        </header>

        <LessonContent lesson={lesson} />

        <div className="mt-8 flex flex-wrap gap-3 border-t border-(--color-border) pt-6">
          <button
            type="button"
            onClick={onExample}
            className="rounded-md border border-(--color-border) px-4 py-2 text-sm font-medium hover:bg-(--color-surface-muted)"
          >
            Ver el ejemplo →
          </button>
          {lesson.challenge && (
            <button
              type="button"
              onClick={onPractice}
              className="rounded-md bg-(--color-primary) px-4 py-2 text-sm font-medium text-(--color-primary-ink) hover:opacity-90"
            >
              Hacer la práctica →
            </button>
          )}
        </div>
      </article>
    </div>
  )
}

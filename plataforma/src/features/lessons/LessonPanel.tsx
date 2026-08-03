import { useState } from 'react'
import { ChevronLeft } from '@/components/icons'
import { FileList } from '@/features/workspace/FileList'
import { LessonChallenge } from './LessonChallenge'
import { PanelTabs } from './PanelTabs'
import type { Lesson } from './types'

interface LessonPanelProps {
  lesson: Lesson
  /** Archivo activo del editor (multi-archivo); el principal o un acompañante. */
  activePath: string
  onSelectFile: (path: string) => void
  /** Fuente actual del editor, para corregir el desafío. */
  currentSource: string
  /** Carga código en el editor (ejemplo o starter del desafío). */
  onLoadIntoEditor: (code: string) => void
  /** Se llama cuando el desafío se aprueba, para registrar progreso. */
  onChallengePassed: (lessonId: string) => void
  /** Colapsa el panel (para enfocarse en el editor y el PDF). */
  onCollapse: () => void
  /** Navegación entre momentos (desde el cuerpo, no desde el header). */
  onGoLearn: () => void
  onGoExample: () => void
}

/**
 * Modo **Practicar**: panel de contexto con un selector segmentado
 * `Tarea | Archivos` (Archivos solo si la lección es multi-archivo). La tarea es
 * la protagonista; la explicación completa queda plegada.
 */
export function LessonPanel({
  lesson,
  activePath,
  onSelectFile,
  currentSource,
  onLoadIntoEditor,
  onChallengePassed,
  onCollapse,
  onGoLearn,
  onGoExample,
}: LessonPanelProps) {
  const multi = lesson.files.length > 0
  const [tab, setTab] = useState<'tarea' | 'archivos'>('tarea')

  return (
    <div className="flex h-full flex-col overflow-hidden text-sm text-(--color-ink)">
      <header className="flex items-start justify-between gap-2 px-5 pt-5">
        <div>
          <p className="text-xs font-semibold tracking-wide text-(--color-ink-muted) uppercase">Tarea</p>
          <h1 className="text-base font-semibold">{lesson.title}</h1>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Colapsar panel"
          title="Colapsar panel"
          className="shrink-0 rounded-md p-1 text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
        >
          <ChevronLeft />
        </button>
      </header>

      <nav className="flex flex-wrap gap-2 px-5 pt-3">
        <button
          type="button"
          onClick={onGoLearn}
          className="rounded-md border border-(--color-border) px-2.5 py-1 text-xs hover:bg-(--color-surface-muted)"
        >
          ‹ Volver a la lección
        </button>
        <button
          type="button"
          onClick={onGoExample}
          className="rounded-md border border-(--color-border) px-2.5 py-1 text-xs hover:bg-(--color-surface-muted)"
        >
          Ver el ejemplo
        </button>
      </nav>

      {multi && (
        <div className="px-5 pt-3">
          <PanelTabs
            value={tab}
            onChange={setTab}
            options={[
              ['tarea', 'Tarea'],
              ['archivos', 'Archivos'],
            ]}
          />
        </div>
      )}

      {multi && tab === 'archivos' ? (
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <FileList
            files={[{ path: lesson.mainFile }, ...lesson.files]}
            activePath={activePath}
            mainFile={lesson.mainFile}
            onSelect={onSelectFile}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-5 py-4">
          {lesson.challenge ? (
            <LessonChallenge
              lesson={lesson}
              currentSource={currentSource}
              onLoadIntoEditor={onLoadIntoEditor}
              onChallengePassed={onChallengePassed}
            />
          ) : (
            <button
              type="button"
              onClick={() => onLoadIntoEditor(lesson.example)}
              className="self-start rounded-md border border-(--color-border) px-3 py-1.5 hover:bg-(--color-surface-muted)"
            >
              Cargar ejemplo en el editor
            </button>
          )}
        </div>
      )}
    </div>
  )
}

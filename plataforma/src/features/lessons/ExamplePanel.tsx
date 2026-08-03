import { useState } from 'react'
import { ChevronLeft } from '@/components/icons'
import { FileList } from '@/features/workspace/FileList'
import { PanelTabs } from './PanelTabs'
import type { Lesson } from './types'

interface ExamplePanelProps {
  lesson: Lesson
  /** Archivo activo del editor (multi-archivo); el principal o un acompañante. */
  activePath: string
  onSelectFile: (path: string) => void
  /** Vuelve a cargar el ejemplo en el editor (por si lo editaste). */
  onReset: () => void
  onCollapse: () => void
  /** Navegación entre momentos (desde el cuerpo, no desde el header). */
  onGoLearn: () => void
  onGoPractice?: (() => void) | undefined
}

/**
 * Modo **Ejemplo**: panel de contexto con un selector segmentado
 * `Explicación | Archivos` (Archivos solo si la lección es multi-archivo).
 */
export function ExamplePanel({
  lesson,
  activePath,
  onSelectFile,
  onReset,
  onCollapse,
  onGoLearn,
  onGoPractice,
}: ExamplePanelProps) {
  const multi = lesson.files.length > 0
  const [tab, setTab] = useState<'explicacion' | 'archivos'>('explicacion')

  return (
    <div className="flex h-full flex-col overflow-hidden text-sm text-(--color-ink)">
      <header className="flex items-start justify-between gap-2 px-5 pt-5">
        <div>
          <p className="text-xs font-semibold tracking-wide text-(--color-ink-muted) uppercase">Ejemplo</p>
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
        {onGoPractice && (
          <button
            type="button"
            onClick={onGoPractice}
            className="rounded-md bg-(--color-primary) px-2.5 py-1 text-xs font-medium text-(--color-primary-ink) hover:opacity-90"
          >
            Ir a la práctica →
          </button>
        )}
      </nav>

      {multi && (
        <div className="px-5 pt-3">
          <PanelTabs
            value={tab}
            onChange={setTab}
            options={[
              ['explicacion', 'Explicación'],
              ['archivos', 'Archivos'],
            ]}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {multi && tab === 'archivos' ? (
          <FileList
            files={[{ path: lesson.mainFile }, ...lesson.files]}
            activePath={activePath}
            mainFile={lesson.mainFile}
            onSelect={onSelectFile}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-(--color-ink-muted)">
              Este ejemplo reúne, comentado, todo lo de la lección: compilá para verlo y editá
              libremente. Para la explicación teórica, volvé a la lección.
            </p>
            <button
              type="button"
              onClick={onReset}
              className="self-start rounded-md border border-(--color-border) px-3 py-1.5 text-sm hover:bg-(--color-surface-muted)"
            >
              Restablecer el ejemplo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

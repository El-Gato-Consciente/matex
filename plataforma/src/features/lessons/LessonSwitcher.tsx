import { Fragment } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown } from '@/components/icons'
import type { Lesson, Level } from './types'

interface LessonSwitcherProps {
  levels: readonly Level[]
  currentLessonId: string
  isCompleted: (lessonId: string) => boolean
  onSelect: (lessonId: string) => void
}

/**
 * Navegación de la ruta como **selector contextual** en el header: muestra la
 * lección actual (breadcrumb) y, al abrir, permite saltar a cualquier otra,
 * agrupada por nivel y por **módulo**.
 */
export function LessonSwitcher({
  levels,
  currentLessonId,
  isCompleted,
  onSelect,
}: LessonSwitcherProps) {
  const current = findCurrent(levels, currentLessonId)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-(--color-surface-muted) data-[state=open]:bg-(--color-surface-muted) outline-none">
        {current && <span className="text-(--color-ink-muted)">Nivel {current.level.level}</span>}
        <span className="text-(--color-ink-muted) opacity-40">/</span>
        <span className="font-medium">{current?.lesson.title ?? 'Lección'}</span>
        <ChevronDown className="text-(--color-ink-muted)" width={14} height={14} />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-[70vh] w-80 overflow-auto rounded-lg border border-(--color-border) bg-(--color-surface) p-1.5 shadow-xl"
        >
          {levels.map((level, index) => (
            <Fragment key={level.level}>
              {index > 0 && <DropdownMenu.Separator className="my-1 h-px bg-(--color-border)" />}
              <DropdownMenu.Label className="px-2 py-1 text-xs font-semibold tracking-wide text-(--color-ink-muted) uppercase">
                Nivel {level.level} · {level.title}
              </DropdownMenu.Label>

              {groupByModule(level.lessons).map((group, groupIndex) => (
                <Fragment key={group.module ?? `__${groupIndex}`}>
                  {group.module && (
                    <div className="px-2 pt-1.5 pb-0.5 text-[11px] font-medium text-(--color-ink-muted)">
                      {group.module}
                    </div>
                  )}
                  {group.lessons.map((lesson) => (
                    <LessonItem
                      key={lesson.id}
                      lesson={lesson}
                      active={lesson.id === currentLessonId}
                      completed={isCompleted(lesson.id)}
                      onSelect={onSelect}
                    />
                  ))}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

interface LessonItemProps {
  lesson: Lesson
  active: boolean
  completed: boolean
  onSelect: (lessonId: string) => void
}

function LessonItem({ lesson, active, completed, onSelect }: LessonItemProps) {
  return (
    <DropdownMenu.Item
      onSelect={() => onSelect(lesson.id)}
      className={[
        'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
        'data-[highlighted]:bg-(--color-surface-muted)',
        active ? 'text-(--color-ink)' : 'text-(--color-ink-muted)',
      ].join(' ')}
    >
      <span className="flex w-4 justify-center">
        {completed ? (
          <Check className="text-(--color-success)" width={14} height={14} />
        ) : (
          <span
            className={[
              'size-1.5 rounded-full',
              active ? 'bg-(--color-primary)' : 'bg-(--color-border)',
            ].join(' ')}
          />
        )}
      </span>
      {lesson.title}
    </DropdownMenu.Item>
  )
}

interface ModuleGroup {
  module: string | undefined
  lessons: Lesson[]
}

/** Agrupa lecciones consecutivas por módulo, preservando el orden. */
function groupByModule(lessons: readonly Lesson[]): ModuleGroup[] {
  const groups: ModuleGroup[] = []
  for (const lesson of lessons) {
    const last = groups[groups.length - 1]
    if (last && last.module === lesson.module) {
      last.lessons.push(lesson)
    } else {
      groups.push({ module: lesson.module, lessons: [lesson] })
    }
  }
  return groups
}

function findCurrent(levels: readonly Level[], lessonId: string) {
  for (const level of levels) {
    const lesson = level.lessons.find((candidate) => candidate.id === lessonId)
    if (lesson) return { level, lesson }
  }
  return undefined
}

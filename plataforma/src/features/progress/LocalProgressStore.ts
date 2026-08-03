import type { LessonProgress, ProgressStore } from './ProgressStore'

const STORAGE_KEY = 'matex.progress.v1'

/**
 * Adaptador de `ProgressStore` sobre `localStorage`. Cuando exista backend con
 * cuentas, se reemplaza por un adaptador remoto sin tocar la UI.
 */
export class LocalProgressStore implements ProgressStore {
  private readonly storage: Storage
  private readonly cache: Map<string, LessonProgress>

  constructor(storage: Storage = window.localStorage) {
    this.storage = storage
    this.cache = LocalProgressStore.load(storage)
  }

  isCompleted(lessonId: string): boolean {
    return this.cache.has(lessonId)
  }

  markCompleted(lessonId: string): void {
    if (this.cache.has(lessonId)) return
    this.cache.set(lessonId, { lessonId, completedAt: new Date().toISOString() })
    this.persist()
  }

  all(): readonly LessonProgress[] {
    return [...this.cache.values()]
  }

  private persist(): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify([...this.cache.values()]))
  }

  private static load(storage: Storage): Map<string, LessonProgress> {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return new Map()
      const entries = parsed.filter(isLessonProgress).map((p) => [p.lessonId, p] as const)
      return new Map(entries)
    } catch {
      return new Map()
    }
  }
}

function isLessonProgress(value: unknown): value is LessonProgress {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).lessonId === 'string' &&
    typeof (value as Record<string, unknown>).completedAt === 'string'
  )
}

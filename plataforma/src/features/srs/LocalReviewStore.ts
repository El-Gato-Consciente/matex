import type { ReviewStore } from './ReviewStore'
import { dueDate, nextBox } from './scheduler'
import type { Grade, Schedule } from './types'

const STORAGE_KEY = 'matex.reviews.v1'

/** Adaptador de `ReviewStore` sobre `localStorage`. */
export class LocalReviewStore implements ReviewStore {
  private readonly storage: Storage
  private readonly cache: Map<string, Schedule>

  constructor(storage: Storage = window.localStorage) {
    this.storage = storage
    this.cache = LocalReviewStore.load(storage)
  }

  get(itemId: string): Schedule | undefined {
    return this.cache.get(itemId)
  }

  isDue(itemId: string, now: Date = new Date()): boolean {
    const schedule = this.cache.get(itemId)
    if (!schedule) return true
    return new Date(schedule.dueAt) <= now
  }

  review(itemId: string, grade: Grade): void {
    const prevBox = this.cache.get(itemId)?.box ?? 0
    const box = nextBox(prevBox, grade)
    this.cache.set(itemId, { box, dueAt: dueDate(box) })
    this.persist()
  }

  private persist(): void {
    const entries = [...this.cache.entries()].map(([id, schedule]) => ({ id, ...schedule }))
    this.storage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }

  private static load(storage: Storage): Map<string, Schedule> {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return new Map()
      return new Map(
        parsed.filter(isStored).map((entry) => [entry.id, { box: entry.box, dueAt: entry.dueAt }]),
      )
    } catch {
      return new Map()
    }
  }
}

interface Stored extends Schedule {
  id: string
}

function isStored(value: unknown): value is Stored {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.box === 'number' &&
    typeof record.dueAt === 'string'
  )
}

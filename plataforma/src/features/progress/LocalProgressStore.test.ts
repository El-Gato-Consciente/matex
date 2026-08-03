import { describe, expect, it } from 'vitest'
import { createFakeStorage } from '@/test/fakeStorage'
import { LocalProgressStore } from './LocalProgressStore'

describe('LocalProgressStore', () => {
  it('marca y consulta lecciones completadas', () => {
    const store = new LocalProgressStore(createFakeStorage())
    expect(store.isCompleted('l1')).toBe(false)
    store.markCompleted('l1')
    expect(store.isCompleted('l1')).toBe(true)
    expect(store.all()).toHaveLength(1)
  })

  it('markCompleted es idempotente', () => {
    const store = new LocalProgressStore(createFakeStorage())
    store.markCompleted('l1')
    store.markCompleted('l1')
    expect(store.all()).toHaveLength(1)
  })

  it('persiste entre instancias', () => {
    const storage = createFakeStorage()
    new LocalProgressStore(storage).markCompleted('l1')
    expect(new LocalProgressStore(storage).isCompleted('l1')).toBe(true)
  })
})

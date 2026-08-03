import { describe, expect, it } from 'vitest'
import { createFakeStorage } from '@/test/fakeStorage'
import { LocalReviewStore } from './LocalReviewStore'

describe('LocalReviewStore', () => {
  it('un ítem sin agenda está vencido', () => {
    const store = new LocalReviewStore(createFakeStorage())
    expect(store.isDue('q1')).toBe(true)
  })

  it('una respuesta buena lo posterga (no vencido hoy)', () => {
    const store = new LocalReviewStore(createFakeStorage())
    store.review('q1', 'good') // box 1 → +1 día
    expect(store.isDue('q1')).toBe(false)
    expect(store.get('q1')?.box).toBe(1)
  })

  it('una respuesta mala lo reinicia (box 0, vencido)', () => {
    const store = new LocalReviewStore(createFakeStorage())
    store.review('q1', 'good')
    store.review('q1', 'bad')
    expect(store.get('q1')?.box).toBe(0)
    expect(store.isDue('q1')).toBe(true)
  })

  it('persiste entre instancias', () => {
    const storage = createFakeStorage()
    new LocalReviewStore(storage).review('q1', 'good')
    expect(new LocalReviewStore(storage).get('q1')?.box).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'
import { createFakeStorage } from '@/test/fakeStorage'
import { markWelcomed, shouldWelcome } from './welcome'

const fresh = { completedLessons: 0, projects: 0 }

describe('shouldWelcome', () => {
  it('recibe a quien entra por primera vez', () => {
    expect(shouldWelcome(fresh, createFakeStorage())).toBe(true)
  })

  it('no vuelve a recibir una vez marcada', () => {
    const storage = createFakeStorage()
    markWelcomed(storage)
    expect(shouldWelcome(fresh, storage)).toBe(false)
  })

  it('leer no consume la primera visita (StrictMode lee dos veces)', () => {
    const storage = createFakeStorage()
    shouldWelcome(fresh, storage)
    expect(shouldWelcome(fresh, storage)).toBe(true)
  })

  it('no recibe a quien ya usaba la app (progreso o proyectos), aunque no tenga la marca', () => {
    const storage = createFakeStorage()
    expect(shouldWelcome({ completedLessons: 2, projects: 0 }, storage)).toBe(false)
    expect(shouldWelcome({ completedLessons: 0, projects: 1 }, storage)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { relativeTime } from './relativeTime'

const now = new Date('2026-10-02T12:00:00Z')
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString()

describe('relativeTime', () => {
  it('menos de un minuto es «recién»', () => {
    expect(relativeTime(ago(20), now)).toBe('recién')
  })
  it('minutos y horas', () => {
    expect(relativeTime(ago(5 * 60), now)).toBe('hace 5 minutos')
    expect(relativeTime(ago(3 * 3600), now)).toBe('hace 3 horas')
  })
  it('ayer y semanas', () => {
    expect(relativeTime(ago(26 * 3600), now)).toBe('ayer')
    expect(relativeTime(ago(15 * 24 * 3600), now)).toBe('hace 2 semanas')
  })
  it('una fecha inválida no rompe', () => {
    expect(relativeTime('no-es-fecha', now)).toBe('')
  })
})

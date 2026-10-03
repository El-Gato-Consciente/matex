import { describe, expect, it } from 'vitest'
import { createFakeStorage } from '@/test/fakeStorage'
import { isExpired, loadSession, saveSession, sessionFromToken } from './session'

/** Un JWT con el payload dado (la firma no importa: la verifica el API Gateway). */
function jwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  return `${encode({ alg: 'RS256' })}.${encode(claims)}.firma`
}

const claims = { sub: 'g-123', email: 'ana@gmail.com', name: 'Ana Pérez', picture: 'https://x/y.png', exp: 2_000_000_000 }

describe('session', () => {
  it('lee usuario y vencimiento del token (con tildes en el nombre)', () => {
    const session = sessionFromToken(jwt(claims))
    expect(session?.user).toEqual({ sub: 'g-123', email: 'ana@gmail.com', name: 'Ana Pérez', picture: 'https://x/y.png' })
    expect(session?.expiresAt).toBe(2_000_000_000)
  })

  it('lo que no es un token de Google no es una sesión', () => {
    expect(sessionFromToken('basura')).toBeNull()
    expect(sessionFromToken(jwt({ email: 'sin-sub@x' }))).toBeNull()
  })

  it('vence con un minuto de margen', () => {
    const session = sessionFromToken(jwt({ ...claims, exp: 1_000 }))!
    expect(isExpired(session, new Date(1_000 * 1000 - 61_000))).toBe(false)
    expect(isExpired(session, new Date(1_000 * 1000 - 30_000))).toBe(true)
  })

  it('persiste entre recargas y se borra al cerrar sesión', () => {
    const storage = createFakeStorage()
    saveSession(sessionFromToken(jwt(claims)), storage)
    expect(loadSession(storage)?.user.sub).toBe('g-123')
    saveSession(null, storage)
    expect(loadSession(storage)).toBeNull()
  })
})

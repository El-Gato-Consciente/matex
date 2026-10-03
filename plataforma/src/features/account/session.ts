/**
 * **Sesión de la cuenta del ecosistema** (login con Google), pura: decodificar el token, saber
 * si venció y guardarla entre recargas. Sin DOM ni Google: lo testeable, aparte.
 *
 * El token es un **ID token de Google** (JWT, dura ~1 h). No se verifica la firma acá: el que lo
 * verifica es el API Gateway (autorizador `google_jwt`) en cada llamada. El navegador solo lo
 * lee para mostrar quién está conectado y saber cuándo pedir uno nuevo.
 */

export interface AccountUser {
  /** Identificador estable de Google: la clave de la cuenta en todos los sitios. */
  readonly sub: string
  readonly email: string
  readonly name: string
  readonly picture: string
}

export interface Session {
  readonly token: string
  readonly user: AccountUser
  /** Vencimiento del token, en segundos epoch (`exp` del JWT). */
  readonly expiresAt: number
}

const STORAGE_KEY = 'matex.account.v1'
/** Margen: un token que vence en menos de esto ya se trata como vencido. */
const EXPIRY_MARGIN_SECONDS = 60

/** Decodifica el payload de un JWT (sin verificar la firma). `null` si no tiene forma de token. */
export function sessionFromToken(token: string): Session | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
    )
    const claims = JSON.parse(json) as Record<string, unknown>
    if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number') return null
    return {
      token,
      expiresAt: claims.exp,
      user: {
        sub: claims.sub,
        email: typeof claims.email === 'string' ? claims.email : '',
        name: typeof claims.name === 'string' ? claims.name : '',
        picture: typeof claims.picture === 'string' ? claims.picture : '',
      },
    }
  } catch {
    return null
  }
}

export function isExpired(session: Session, now: Date = new Date()): boolean {
  return session.expiresAt - EXPIRY_MARGIN_SECONDS <= now.getTime() / 1000
}

export function loadSession(storage: Storage = window.localStorage): Session | null {
  const raw = storage.getItem(STORAGE_KEY)
  return raw ? sessionFromToken(raw) : null
}

export function saveSession(session: Session | null, storage: Storage = window.localStorage): void {
  if (session) storage.setItem(STORAGE_KEY, session.token)
  else storage.removeItem(STORAGE_KEY)
}

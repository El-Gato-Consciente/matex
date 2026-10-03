/**
 * **Google Identity Services** (la librería oficial de Google): carga del script, una sola vez, y
 * el subconjunto de su API que usa la app. Lo comparten el login (`AccountProvider`, ID token) y
 * el permiso de Drive (`driveAccess`, access token).
 */

export interface GoogleIdentity {
  initialize(config: {
    client_id: string
    callback: (response: { credential: string }) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    use_fedcm_for_prompt?: boolean
  }): void
  prompt(): void
  renderButton(element: HTMLElement, options: Record<string, string>): void
  disableAutoSelect(): void
}

export interface TokenResponse {
  access_token?: string
  expires_in?: number | string
  scope?: string
  error?: string
}

export interface TokenClient {
  requestAccessToken(overrides?: { prompt?: '' | 'none' | 'consent'; login_hint?: string }): void
}

export interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type: string }) => void
    login_hint?: string
  }): TokenClient
  hasGrantedAllScopes(response: TokenResponse, scope: string): boolean
  revoke(token: string, done?: () => void): void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity; oauth2: GoogleOAuth2 } }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'
let gisPromise: Promise<NonNullable<Window['google']>['accounts'] | null> | null = null

/** Carga el script de Google una sola vez. `null` si no carga (sin conexión, bloqueado). */
export function loadGoogleAccounts(): Promise<NonNullable<Window['google']>['accounts'] | null> {
  gisPromise ??= new Promise((resolve) => {
    if (window.google?.accounts) return resolve(window.google.accounts)
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve(window.google?.accounts ?? null)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
  return gisPromise
}

/** Atajo para el login (ID token). */
export async function loadGoogleIdentity(): Promise<GoogleIdentity | null> {
  return (await loadGoogleAccounts())?.id ?? null
}

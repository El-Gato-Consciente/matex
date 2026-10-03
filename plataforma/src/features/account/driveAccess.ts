import type { DriveAuth } from '@/features/sync/DriveStore'
import { loadGoogleAccounts, type TokenResponse } from './googleIdentity'

/**
 * **Permiso de Google Drive**, aparte del login. Pide solo `drive.file`: acceso a los archivos que
 * crea Matex, no al resto del Drive. El token vive **en el navegador** (decisión de producto: nada
 * de credenciales de Google en nuestras tablas), así que dura lo que Google lo deja vivir (~1 h).
 * Renovarlo necesita un clic del usuario: los navegadores bloquean las ventanas de Google que no
 * nacen de un gesto, así que no se intenta en segundo plano.
 */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const STORAGE_KEY = 'matex.drive.v1'
const EXPIRY_MARGIN_SECONDS = 60

export type DriveStatus =
  /** Nunca conectó Drive (o lo desconectó). */
  | 'disconnected'
  | 'connected'
  /** Lo conectó, pero el permiso venció: hace falta un clic para renovarlo. */
  | 'expired'

interface Stored {
  /** Cuenta (sub de Google) a la que pertenece el permiso. */
  user: string
  /** Si alguna vez dio el permiso (para decir «Reconectar» y no «Conectar»). */
  granted: boolean
  token?: string
  expiresAt?: number
}

export class DriveAccess implements DriveAuth {
  private readonly clientId: string
  private readonly user: string
  private readonly email: string
  private readonly storage: Storage

  constructor(clientId: string, user: { sub: string; email: string }, storage: Storage = window.localStorage) {
    this.clientId = clientId
    this.user = user.sub
    this.email = user.email
    this.storage = storage
  }

  token(): string | null {
    const stored = this.read()
    if (!stored?.token || !stored.expiresAt) return null
    return stored.expiresAt - EXPIRY_MARGIN_SECONDS > Date.now() / 1000 ? stored.token : null
  }

  status(): DriveStatus {
    const stored = this.read()
    if (!stored?.granted) return 'disconnected'
    return this.token() ? 'connected' : 'expired'
  }

  /**
   * Pide (o renueva) el permiso. **Llamar desde un clic**: abre la ventana de Google. La primera
   * vez muestra la pantalla de consentimiento; después, solo confirma la cuenta.
   */
  async connect(): Promise<boolean> {
    const accounts = await loadGoogleAccounts()
    if (!accounts) return false
    const response = await new Promise<TokenResponse>((resolve) => {
      const client = accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: DRIVE_SCOPE,
        login_hint: this.email,
        callback: resolve,
        error_callback: (error) => resolve({ error: error.type }),
      })
      client.requestAccessToken({ prompt: this.read()?.granted ? '' : 'consent' })
    })
    if (!response.access_token || !accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) return false
    this.write({
      user: this.user,
      granted: true,
      token: response.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + Number(response.expires_in ?? 3600),
    })
    return true
  }

  /** Revoca el permiso en Google y lo olvida acá. Los archivos en Drive quedan donde están. */
  async disconnect(): Promise<void> {
    const token = this.token()
    if (token) (await loadGoogleAccounts())?.oauth2.revoke(token)
    this.write(null)
  }

  private read(): Stored | null {
    try {
      const all = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Stored>
      return all[this.user] ?? null
    } catch {
      return null
    }
  }

  private write(value: Stored | null): void {
    let all: Record<string, Stored> = {}
    try {
      all = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Stored>
    } catch {
      all = {}
    }
    if (value) all[this.user] = value
    else delete all[this.user]
    this.storage.setItem(STORAGE_KEY, JSON.stringify(all))
  }
}

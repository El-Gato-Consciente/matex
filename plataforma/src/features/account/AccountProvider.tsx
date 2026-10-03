import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AccountContext, type Account, type AccountStatus } from './account'
import { loadGoogleIdentity } from './googleIdentity'
import { isExpired, loadSession, saveSession, sessionFromToken, type Session } from './session'

/**
 * **Cuenta del ecosistema, opcional.** Sin iniciar sesión la app funciona igual que siempre (todo
 * queda en el navegador); iniciar sesión solo suma sincronizar con la nube. Una sola cuenta de
 * Google sirve para todos los sitios de el-gato-consciente.
 *
 * Usa Google Identity Services: el token que entrega es el mismo que valida el autorizador
 * `google_jwt` del API Gateway, así que no hay backend de login propio.
 */

interface AccountProviderProps {
  readonly clientId: string | undefined
  /** Base de la API, para registrar el perfil (`GET /me`) en el primer login. */
  readonly apiBaseUrl: string | undefined
  readonly children: ReactNode
}

export function AccountProvider({ clientId, apiBaseUrl, children }: AccountProviderProps) {
  const [session, setSession] = useState<Session | null>(() => (clientId ? loadSession() : null))
  const [expired, setExpired] = useState(() => (session ? isExpired(session) : false))
  const [ready, setReady] = useState(false)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const onCredential = useCallback(
    (credential: string) => {
      const next = sessionFromToken(credential)
      if (!next) return
      saveSession(next)
      setSession(next)
      setExpired(false)
      // Alta/actualización del perfil del ecosistema; si falla, no impide usar la app.
      if (apiBaseUrl) {
        void fetch(`${apiBaseUrl.replace(/\/$/, '')}/me`, { headers: { Authorization: `Bearer ${credential}` } }).catch(() => {})
      }
    },
    [apiBaseUrl],
  )

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    void loadGoogleIdentity().then((gis) => {
      if (cancelled || !gis) return
      gis.initialize({
        client_id: clientId,
        callback: (response) => onCredential(response.credential),
        // Quien ya entró antes vuelve a entrar solo (renueva el token sin clics).
        auto_select: true,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,
      })
      setReady(true)
      const current = sessionRef.current
      if (current && isExpired(current)) gis.prompt()
    })
    return () => {
      cancelled = true
    }
  }, [clientId, onCredential])

  // El token dura ~1 h: un minuto antes de que venza, se pide uno nuevo en silencio.
  useEffect(() => {
    if (!session || !ready) return
    const delay = Math.max(0, (session.expiresAt - 90) * 1000 - Date.now())
    const timer = window.setTimeout(() => {
      setExpired(true)
      window.google?.accounts.id.prompt()
    }, delay)
    return () => window.clearTimeout(timer)
  }, [session, ready])

  const account = useMemo<Account>(() => {
    const status: AccountStatus = !clientId ? 'disabled' : !session ? 'signed-out' : expired ? 'expired' : 'signed-in'
    return {
      status,
      user: session?.user ?? null,
      getToken: () => {
        const current = sessionRef.current
        return current && !isExpired(current) ? current.token : null
      },
      renderSignInButton: (element) => {
        window.google?.accounts.id.renderButton(element, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          locale: 'es',
        })
      },
      markExpired: () => {
        setExpired(true)
        window.google?.accounts.id.prompt()
      },
      signOut: () => {
        window.google?.accounts.id.disableAutoSelect()
        saveSession(null)
        setSession(null)
        setExpired(false)
      },
    }
  }, [clientId, session, expired])

  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>
}

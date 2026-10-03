import { createContext, useContext } from 'react'
import type { AccountUser } from './session'

/**
 * Contrato de la **cuenta del ecosistema** (ver `AccountProvider`): el estado de la sesión y lo
 * que el resto de la app puede pedirle. Aparte del proveedor para que el recargado en caliente
 * de Vite funcione (un archivo de componentes no debería exportar también hooks).
 */
export type AccountStatus =
  /** Sin client id configurado: la cuenta no existe en este build (desarrollo offline). */
  | 'disabled'
  | 'signed-out'
  | 'signed-in'
  /** Hubo sesión pero el token venció y no se pudo renovar solo: hay que reconectar. */
  | 'expired'

export interface Account {
  readonly status: AccountStatus
  readonly user: AccountUser | null
  /** Token vigente para llamar a la API, o `null` (sin sesión o vencida). */
  getToken(): string | null
  /** Dibuja el botón oficial de Google adentro del elemento. */
  renderSignInButton(element: HTMLElement): void
  /** Avisa que la API rechazó el token (pasa a `expired` e intenta renovarlo solo). */
  markExpired(): void
  signOut(): void
}

export const AccountContext = createContext<Account | null>(null)

export function useAccount(): Account {
  const account = useContext(AccountContext)
  if (!account) throw new Error('useAccount: falta <AccountProvider> arriba en el árbol.')
  return account
}

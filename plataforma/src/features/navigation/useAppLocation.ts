import { useCallback, useEffect, useState } from 'react'
import { locationToPath, parseLocation, type AppLocation } from './location'

/** Ir a otra ubicación. `replace` cambia la URL **sin** dejar entrada en la historia. */
export type Navigate = (to: AppLocation, options?: { readonly replace?: boolean }) => void

/**
 * Adaptador entre la ubicación de la app (`AppLocation`, dato puro) y la **historia del
 * navegador**. Es lo único que toca `window.history`.
 *
 * Sin router de terceros a propósito: la app tiene cinco vistas y ninguna anidada de verdad, así
 * que el mapa completo entra en `location.ts` y se testea sin DOM. Lo que hacía falta no era un
 * router, era que Atrás y Adelante funcionaran.
 *
 * Usa rutas de verdad (`/proyectos/nuevo`) y no un hash porque el hosting ya está preparado:
 * CloudFront responde `index.html` ante 403/404 y el nginx local hace `try_files … /index.html`.
 */
export function useAppLocation(): readonly [AppLocation, Navigate] {
  const [location, setLocation] = useState<AppLocation>(() => parseLocation(window.location.pathname))

  // Atrás/Adelante: el navegador ya cambió la URL, así que la ubicación se relee de ahí.
  useEffect(() => {
    const onPopState = (): void => setLocation(parseLocation(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback<Navigate>((to, options) => {
    const path = locationToPath(to)
    // Navegar al mismo lugar no debe apilar entradas: si no, hacen falta N clicks en Atrás para
    // salir de donde nunca te movíste.
    if (path !== window.location.pathname) {
      if (options?.replace) window.history.replaceState(null, '', path)
      else window.history.pushState(null, '', path)
    }
    setLocation(to)
  }, [])

  return [location, navigate]
}

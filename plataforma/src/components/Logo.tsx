import { useId } from 'react'

/**
 * Trazo de una **Σ**. Girada 90° (horario) es la **M** de Matex: la matemática se
 * vuelve la marca. El logo estático la muestra ya girada; la intro (`Splash`)
 * anima el giro.
 */
const SIGMA_POINTS = '23,8.5 9.5,8.5 17.5,16 9.5,23.5 23,23.5'

interface LogoProps {
  /** Clases del wordmark (p. ej. ocultarlo en pantallas chicas). */
  wordmarkClassName?: string
  /** Agrega las clases de la animación de entrada (solo la usa `Splash`). */
  animated?: boolean
  /** Marca este logo como destino del vuelo final de la intro (el del header). */
  anchor?: boolean
}

/**
 * Logo de Matex: isotipo (Σ→M) + wordmark «MaTEX» con la E baja, como el logo de
 * TeX (Matex = Ma + TeX). Todo en `em`: escala con el `font-size` del contenedor,
 * y así la intro puede llevarlo al header con un solo `scale`.
 */
export function Logo({ wordmarkClassName = '', animated = false, anchor = false }: LogoProps) {
  return (
    <span
      className={['matex-logo', animated ? 'matex-logo--animated' : ''].join(' ')}
      data-logo-anchor={anchor ? '' : undefined}
    >
      <LogoMark />
      <span className={['matex-wordmark', wordmarkClassName].join(' ')} data-logo-wordmark="" aria-hidden="true">
        <span className="matex-wordmark-ma">Ma</span>
        <span className="matex-wordmark-t">T</span>
        <span className="matex-wordmark-e">E</span>
        <span className="matex-wordmark-x">X</span>
      </span>
      <span className="sr-only">Matex</span>
    </span>
  )
}

function LogoMark() {
  const gradientId = useId()
  return (
    <svg className="matex-logo-mark" viewBox="0 0 32 32" aria-hidden="true" data-logo-mark="">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#818cf8" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect className="matex-logo-badge" width="32" height="32" rx="8.5" fill={`url(#${gradientId})`} />
      <polyline
        className="matex-logo-glyph"
        points={SIGMA_POINTS}
        pathLength={1}
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

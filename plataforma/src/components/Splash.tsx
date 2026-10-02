import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Logo } from './Logo'

/** Cuándo arranca la salida: justo después de que la E termina de caer (ver index.css). */
const HOLD_MS = 1850
const FLIGHT_MS = 620
const SKIP_MS = 220

/** En cada carga, salvo con «reducir movimiento». */
function shouldShowSplash(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Intro al abrir el sitio: la Σ se dibuja y gira hasta ser la M, entra el wordmark
 * (la E cae a su lugar, como en el logo de TeX) y el logo **vuela al header**,
 * donde está el logo real. Clic o tecla la saltean.
 */
export function Splash() {
  const [visible, setVisible] = useState(shouldShowSplash)
  if (!visible) return null
  return <SplashOverlay onDone={() => setVisible(false)} />
}

function SplashOverlay({ onDone }: { onDone: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const exiting = useRef(false)

  // El logo del header se esconde mientras dura la intro: el de la intro aterriza ahí.
  useLayoutEffect(() => {
    const anchor = document.querySelector<HTMLElement>('[data-logo-anchor]')
    if (anchor) anchor.style.visibility = 'hidden'
    return () => {
      if (anchor) anchor.style.visibility = ''
    }
  }, [])

  function exit(skipped: boolean) {
    const backdrop = backdropRef.current
    const logo = logoRef.current
    if (exiting.current || !backdrop || !logo) return
    exiting.current = true
    const animations = (!skipped && flyToHeader(logo, backdrop)) || fadeOut(logo, backdrop)
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(onDone)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => exit(false), HOLD_MS)
    const skip = () => exit(true)
    window.addEventListener('keydown', skip)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', skip)
    }
    // `exit` solo lee refs: alcanza con registrarlo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="matex-splash" aria-hidden="true" onClick={() => exit(true)}>
      <div ref={backdropRef} className="matex-splash-backdrop" />
      <div ref={logoRef} className="matex-splash-logo">
        <Logo animated />
      </div>
    </div>
  )
}

/**
 * FLIP: lleva el logo de la intro a la posición y tamaño del logo del header.
 * Como el logo está todo en `em`, alcanza con un `scale` uniforme (el del isotipo).
 * Devuelve `null` si no hay dónde aterrizar (y se usa el fundido).
 */
function flyToHeader(logo: HTMLElement, backdrop: HTMLElement): Animation[] | null {
  const anchor = document.querySelector<HTMLElement>('[data-logo-anchor]')
  const target = anchor?.querySelector('[data-logo-mark]')?.getBoundingClientRect()
  const source = logo.querySelector('[data-logo-mark]')?.getBoundingClientRect()
  if (!anchor || !target || !source || target.width === 0) return null

  const box = logo.getBoundingClientRect()
  const sourceX = source.left + source.width / 2
  const sourceY = source.top + source.height / 2
  const dx = target.left + target.width / 2 - sourceX
  const dy = target.top + target.height / 2 - sourceY
  const scale = target.width / source.width
  logo.style.transformOrigin = `${sourceX - box.left}px ${sourceY - box.top}px`

  const timing: KeyframeAnimationOptions = {
    duration: FLIGHT_MS,
    easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
    fill: 'forwards',
  }
  const animations = [
    logo.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})` }], timing),
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { ...timing, easing: 'ease-in' }),
  ]
  // En pantallas chicas el header no muestra el wordmark: el de la intro se desvanece en vuelo.
  const targetWordmark = anchor.querySelector<HTMLElement>('[data-logo-wordmark]')
  const sourceWordmark = logo.querySelector<HTMLElement>('[data-logo-wordmark]')
  if (sourceWordmark && targetWordmark && getComputedStyle(targetWordmark).display === 'none') {
    animations.push(
      sourceWordmark.animate([{ opacity: 1 }, { opacity: 0 }], { ...timing, duration: FLIGHT_MS / 2 }),
    )
  }
  return animations
}

function fadeOut(logo: HTMLElement, backdrop: HTMLElement): Animation[] {
  const timing: KeyframeAnimationOptions = { duration: SKIP_MS, easing: 'ease-out', fill: 'forwards' }
  return [
    logo.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(0.96)' }], timing),
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], timing),
  ]
}

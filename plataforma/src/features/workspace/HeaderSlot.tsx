import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Slot del header: permite que un `Workspace` (Curso, Galería, Mis Proyectos)
 * **teletransporte** su toolbar contextual al **único** header de la app, en vez
 * de dibujar una segunda barra apilada. Así hay una sola toolbar superior — y un
 * único lugar donde el futuro editor visual podrá sumar sus controles.
 *
 * `setEl` viene de `useState`, así que es estable: se puede pasar directo como
 * `ref` sin re-montar el destino en cada render.
 */
const HeaderSlotContext = createContext<{
  el: HTMLElement | null
  setEl: (el: HTMLElement | null) => void
} | null>(null)

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  return <HeaderSlotContext.Provider value={{ el, setEl }}>{children}</HeaderSlotContext.Provider>
}

/** Destino del slot: se coloca UNA vez dentro del header de la app. */
export function HeaderSlotTarget({ className }: { className?: string }) {
  const ctx = useContext(HeaderSlotContext)
  return <div ref={ctx?.setEl} className={className} />
}

/** Renderiza sus hijos dentro del header (vía portal). Nada si no hay destino. */
export function HeaderSlotContent({ children }: { children: ReactNode }) {
  const ctx = useContext(HeaderSlotContext)
  return ctx?.el ? createPortal(children, ctx.el) : null
}

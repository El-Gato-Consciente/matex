import { useEffect, useState, type RefObject } from 'react'

/**
 * ¿El elemento está en pantalla? Con `once`, queda en `true` la primera vez que
 * entra (para revelar contenido); sin `once`, sigue la visibilidad (para pausar
 * animaciones que salen de pantalla y no gastar CPU).
 */
export function useInView(ref: RefObject<Element | null>, { once = false, threshold = 0.2 } = {}): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        setInView(entry.isIntersecting)
        if (entry.isIntersecting && once) observer.disconnect()
      },
      { threshold },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, once, threshold])
  return inView
}

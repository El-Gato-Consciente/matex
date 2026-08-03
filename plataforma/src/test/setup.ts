/**
 * Setup global de Vitest. Registra los matchers de jest-dom (p. ej.
 * `toBeInTheDocument`) y el auto-cleanup de Testing Library entre tests.
 *
 * Corre en TODOS los tests; los de lógica pura usan entorno node (sin `document`),
 * así que el cleanup —que toca el DOM— se registra solo cuando hay jsdom.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react')
  afterEach(cleanup)
}

/**
 * Indentación por profundidad como clases de Tailwind (sin estilos inline, que el
 * linter desaconseja). Se clampea para no crecer indefinidamente.
 */
const INDENT = ['pl-2', 'pl-6', 'pl-10', 'pl-14', 'pl-16'] as const

export function indentClass(depth: number): string {
  return INDENT[Math.min(Math.max(depth, 0), INDENT.length - 1)]!
}

import { signal } from '@preact/signals-core'
import type { AnySnippet } from './SnippetStore'

/** Non-null while the user is typing \query inside any mathInput node. */
export const backslashQuery = signal<string | null>(null)

/** Index of the currently keyboard-highlighted snippet (-1 = none). */
export const backslashSelectedIdx = signal<number>(-1)

let _commandFn: ((item: AnySnippet) => void) | null = null
let _navCount   = 0
let _navConfirm: (() => void) | null = null

export function setBackslashState(
  query: string | null,
  fn: ((item: AnySnippet) => void) | null,
): void {
  backslashQuery.value      = query
  backslashSelectedIdx.value = -1
  _commandFn = fn
}

/** Replace the active \query with the chosen snippet. */
export function insertFromBackslash(item: AnySnippet): void {
  _commandFn?.(item)
}

/**
 * Called by the sidebar on every update so the keyboard handler knows
 * how many items are visible and what to do on Enter.
 */
export function updateBackslashNav(count: number, confirm: () => void): void {
  _navCount   = count
  _navConfirm = confirm
}

// ── Global keyboard interceptor ───────────────────────────────────
// Runs in capture phase so it fires before TipTap / MathLive / textarea handlers.

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (backslashQuery.value === null) return

  if (e.key === 'ArrowDown') {
    if (_navCount === 0) return
    e.preventDefault(); e.stopPropagation()
    const cur = backslashSelectedIdx.value
    backslashSelectedIdx.value = cur < _navCount - 1 ? cur + 1 : 0

  } else if (e.key === 'ArrowUp') {
    if (_navCount === 0) return
    e.preventDefault(); e.stopPropagation()
    const cur = backslashSelectedIdx.value
    backslashSelectedIdx.value = cur <= 0 ? _navCount - 1 : cur - 1

  } else if (e.key === 'Enter' && backslashSelectedIdx.value >= 0) {
    e.preventDefault(); e.stopPropagation()
    _navConfirm?.()
  }
}, true)

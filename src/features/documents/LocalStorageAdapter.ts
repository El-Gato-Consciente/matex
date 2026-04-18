/* ─────────────────────────────────────────────────────────────────
   LocalStorageAdapter — Phase 1 persistence
   Saves and loads the TipTap document JSON to localStorage.
   Phase 4 will add IndexedDB for large docs and multi-document management.
   ───────────────────────────────────────────────────────────────── */

const DOC_KEY       = 'formalia:doc:main'
const THEME_KEY     = 'formalia:theme'
const HIGHLIGHT_KEY = 'formalia:highlight'
const THM_STYLE_KEY = 'formalia:thm-style'
const SIDEBAR_KEY   = 'formalia:sidebar:collapsed'

export class LocalStorageAdapter {

  // ── Document ────────────────────────────────────────────────────

  saveDocument(json: object): void {
    try {
      localStorage.setItem(DOC_KEY, JSON.stringify(json))
    } catch {
      // Ignore quota errors silently; document is still in memory
    }
  }

  loadDocument(): object | null {
    const raw = localStorage.getItem(DOC_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as object
    } catch {
      return null
    }
  }

  clearDocument(): void {
    localStorage.removeItem(DOC_KEY)
  }

  // ── Theme ────────────────────────────────────────────────────────

  saveTheme(dark: boolean): void {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
  }

  loadTheme(): 'dark' | 'light' {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  }

  // ── Highlight style ──────────────────────────────────────────────

  saveHighlight(mode: 'strong' | 'soft' | 'none'): void {
    localStorage.setItem(HIGHLIGHT_KEY, mode)
  }

  loadHighlight(): 'strong' | 'soft' | 'none' {
    const v = localStorage.getItem(HIGHLIGHT_KEY)
    return (v === 'soft' || v === 'none') ? v : 'strong'
  }

  // ── Theorem env style ────────────────────────────────────────────

  saveThmStyle(mode: 'strong' | 'soft' | 'none'): void {
    localStorage.setItem(THM_STYLE_KEY, mode)
  }

  loadThmStyle(): 'strong' | 'soft' | 'none' {
    const v = localStorage.getItem(THM_STYLE_KEY)
    return (v === 'soft' || v === 'none') ? v : 'strong'
  }

  // ── Sidebar state ────────────────────────────────────────────────

  saveSidebarCollapsed(collapsed: boolean): void {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
  }

  loadSidebarCollapsed(): boolean {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  }
}

/* ─────────────────────────────────────────────────────────────────
   LocalStorageAdapter — Phase 1 persistence
   Saves and loads the TipTap document JSON to localStorage.
   Phase 4 will add IndexedDB for large docs and multi-document management.
   ───────────────────────────────────────────────────────────────── */

const DOC_KEY   = 'formalia:doc:main'
const THEME_KEY = 'formalia:theme'
const SIDEBAR_KEY = 'formalia:sidebar:collapsed'

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

  // ── Sidebar state ────────────────────────────────────────────────

  saveSidebarCollapsed(collapsed: boolean): void {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
  }

  loadSidebarCollapsed(): boolean {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  }
}

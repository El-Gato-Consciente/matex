/* ─────────────────────────────────────────────────────────────────
   FormulaNavigation — TipTap extension
   Keyboard shortcuts for entering edit mode on formulas.

   Enter on a selected math node  → open floating editor
   Ctrl+M                         → insert inline formula + open editor
   Ctrl+Shift+M                   → insert display formula + open editor
   ───────────────────────────────────────────────────────────────── */

import { Extension } from '@tiptap/core'
import { activateNode, insertNewFormulaAndActivate } from '@core/editor/EditorStore'

const MATH_NODES = new Set(['mathInline', 'mathDisplay'])

export const FormulaNavigation = Extension.create({
  name: 'formulaNavigation',

  addKeyboardShortcuts() {
    return {
      // ── Enter on a selected formula → open floating editor ────────
      'Enter': () => {
        const { selection } = this.editor.state
        const sel = selection as { node?: { type: { name: string }; attrs: Record<string, unknown> }; from: number }
        if (!sel.node || !MATH_NODES.has(sel.node.type.name)) return false

        activateNode(sel.from, (sel.node.attrs['latex'] as string) ?? '', null, 'keyboard')
        return true
      },

      // ── Ctrl+M → insert inline formula and open editor ────────────
      'Mod-m': () => {
        insertNewFormulaAndActivate('', false, 'keyboard')
        return true
      },

      // ── Ctrl+Shift+M → insert display formula and open editor ─────
      'Mod-Shift-m': () => {
        insertNewFormulaAndActivate('', true, 'keyboard')
        return true
      },
    }
  },
})

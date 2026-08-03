import { mathCommandCatalog, type MathCommand } from './mathPalette'

/**
 * **Autocompletado inline del editor de fórmulas (ME-16).** Análogo al de CodeMirror (PL-05) pero
 * para los inputs de matemática (vanilla, sin CM6): al tipear `\alp` aparece un dropdown con los
 * comandos que matchean (del mismo catálogo que la paleta ME-30), navegable con ↑/↓ y aceptable con
 * Enter/Tab/click. Al aceptar, reemplaza el token `\palabra` por el snippet (`\alpha `, `\frac{}{}`…)
 * y ubica el cursor en el primer `{}` vacío si lo hay. Es puro DOM (los node views son vanilla).
 *
 * Devuelve una función de limpieza (quita listeners y el dropdown). El `input`/`textarea` debe
 * llamar a su propio `oninput` de preview por separado — al aceptar, disparamos un evento `input`
 * para que el resto (preview en vivo, autoGrow) reaccione.
 */

const MAX_ITEMS = 8

/** Token `\palabra` inmediatamente antes del cursor (o null). `start` = índice de la `\`. */
export function tokenBeforeCaret(value: string, caret: number): { word: string; start: number } | null {
  const upto = value.slice(0, caret)
  const m = upto.match(/\\([a-zA-Z]*)$/)
  if (!m) return null
  return { word: m[1] ?? '', start: caret - m[0].length }
}

export function attachMathAutocomplete(field: HTMLInputElement | HTMLTextAreaElement): () => void {
  const catalog = mathCommandCatalog()
  const menu = document.createElement('div')
  menu.className = 'matex-mathac'
  menu.setAttribute('role', 'listbox')
  menu.style.display = 'none'
  document.body.appendChild(menu)

  let matches: MathCommand[] = []
  let active = 0
  let tokenStart = 0

  const hide = (): void => {
    menu.style.display = 'none'
    matches = []
  }

  const render = (): void => {
    menu.replaceChildren()
    matches.forEach((c, i) => {
      const row = document.createElement('div')
      row.className = 'matex-mathac-row' + (i === active ? ' is-active' : '')
      row.setAttribute('role', 'option')
      const cmd = document.createElement('span')
      cmd.className = 'matex-mathac-cmd'
      cmd.textContent = c.cmd
      row.appendChild(cmd)
      if (c.title) {
        const desc = document.createElement('span')
        desc.className = 'matex-mathac-desc'
        desc.textContent = c.title
        row.appendChild(desc)
      }
      // `mousedown` (no `click`): se dispara antes del blur del input → no cierra el popover.
      row.addEventListener('mousedown', (e) => {
        e.preventDefault()
        accept(i)
      })
      menu.appendChild(row)
    })
    // Posición: debajo del input (predecible; el caret exacto en textarea es frágil).
    const r = field.getBoundingClientRect()
    menu.style.left = `${r.left}px`
    menu.style.top = `${r.bottom + 2}px`
    menu.style.display = 'block'
  }

  const update = (): void => {
    const caret = field.selectionStart ?? field.value.length
    const tok = tokenBeforeCaret(field.value, caret)
    if (!tok || tok.word.length < 1) return hide()
    const q = tok.word.toLowerCase()
    matches = catalog.filter((c) => c.cmd.slice(1).toLowerCase().startsWith(q)).slice(0, MAX_ITEMS)
    if (matches.length === 0) return hide()
    tokenStart = tok.start
    active = 0
    render()
  }

  const accept = (i: number): void => {
    const c = matches[i]
    if (!c) return
    const caret = field.selectionStart ?? field.value.length
    const before = field.value.slice(0, tokenStart)
    const after = field.value.slice(caret)
    const snippet = c.insert
    field.value = before + snippet + after
    // Cursor en el primer `{}` vacío del snippet, si hay; si no, al final del snippet.
    const holeRel = snippet.indexOf('{}')
    const pos = holeRel >= 0 ? tokenStart + holeRel + 1 : tokenStart + snippet.length
    field.setSelectionRange(pos, pos)
    hide()
    field.focus()
    field.dispatchEvent(new Event('input', { bubbles: true })) // preview en vivo + autoGrow
  }

  const onInput = (): void => update()
  const onKeydown = (ev: Event): void => {
    const e = ev as KeyboardEvent
    if (menu.style.display === 'none' || matches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      active = (active + 1) % matches.length
      render()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      active = (active - 1 + matches.length) % matches.length
      render()
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation() // evita que el Enter confirme/cierre el popover del nodo
      accept(active)
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      hide()
    }
  }

  field.addEventListener('input', onInput)
  field.addEventListener('keydown', onKeydown, true) // captura: gana antes que el keydown del popover
  field.addEventListener('blur', hide)

  return () => {
    field.removeEventListener('input', onInput)
    field.removeEventListener('keydown', onKeydown, true)
    field.removeEventListener('blur', hide)
    menu.remove()
  }
}

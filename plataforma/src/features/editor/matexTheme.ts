import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

/**
 * Tema dark a medida para el editor, alineado con la paleta de la app
 * (`index.css`). Reemplaza el tema genérico para que el editor no desentone con
 * los paneles. Dos partes: el "cromo" (fondos, cursor, selección) y el resaltado
 * de sintaxis por tags.
 */
const chrome = EditorView.theme(
  {
    '&': {
      backgroundColor: '#161922',
      color: '#e7e9ee',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#6366f1',
      fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#6366f1' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(99, 102, 241, 0.25)',
    },
    '.cm-gutters': {
      backgroundColor: '#161922',
      color: '#5b6472',
      border: 'none',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      color: '#98a1b3',
    },
    '.cm-scroller': { overflow: 'auto' },
    // Popup de autocompletado, alineado con la paleta dark.
    '.cm-tooltip': {
      backgroundColor: '#1c2030',
      border: '1px solid #2a3142',
      borderRadius: '8px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
    },
    '.cm-tooltip-autocomplete > ul': {
      fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
      maxHeight: '16rem',
    },
    '.cm-tooltip-autocomplete > ul > li': { padding: '3px 8px' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'rgba(99, 102, 241, 0.30)',
      color: '#ffffff',
    },
    '.cm-completionLabel': { color: '#e7e9ee' },
    '.cm-completionDetail': { color: '#98a1b3', fontStyle: 'normal', marginLeft: '0.75em' },
    '.cm-completionIcon': { color: '#a5b4fc', opacity: '0.9' },
    // Preview de fórmula (KaTeX) en el tooltip; hereda color claro para el dark.
    // Sin maxWidth/overflow para no generar scrollbars (las fórmulas son chicas).
    '.cm-math-preview': {
      color: '#e7e9ee',
      padding: '8px 12px',
    },
  },
  { dark: true },
)

const highlight = HighlightStyle.define([
  { tag: t.comment, color: '#5b6472', fontStyle: 'italic' },
  // Comandos LaTeX (\section, \begin, …)
  { tag: [t.tagName, t.keyword, t.controlKeyword, t.moduleKeyword, t.definitionKeyword], color: '#a5b4fc' },
  // Nombres de entornos / argumentos
  { tag: [t.attributeName, t.propertyName, t.labelName], color: '#7dd3fc' },
  { tag: [t.string, t.special(t.string), t.regexp], color: '#34d399' },
  { tag: [t.number, t.atom, t.bool], color: '#f0abfc' },
  { tag: [t.brace, t.bracket, t.paren, t.punctuation, t.separator], color: '#98a1b3' },
  { tag: [t.operator, t.derefOperator], color: '#e7e9ee' },
  { tag: t.meta, color: '#7c84f0' },
  { tag: t.invalid, color: '#f87171' },
])

/** Conjunto de extensiones del tema, listo para pasar al editor. */
export const matexEditorTheme = [chrome, syntaxHighlighting(highlight)]

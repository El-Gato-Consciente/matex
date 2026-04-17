# Demo 2 — Learnings: MathLive en aislamiento

> Knowhow práctico acumulado construyendo `demos/demo2-mathlive.html`.
> Patrón de la demo: lista de fórmulas → click → editar con MathLive.
> Este documento captura lo que **no está en la documentación oficial** —
> bugs encontrados, decisiones no obvias, patrones que funcionaron.

---

## 1. Setup: versión y carga local

### Usar npm local en lugar de CDN

`unpkg.com` y `cdn.jsdelivr.net` pueden no tener la versión más reciente propagada,
y en Edge/Windows pueden fallar por CORS o Tracking Prevention.

**Solución estable: instalar localmente.**

```bash
npm install mathlive@latest
```

Referenciar desde HTML (relativo al archivo que lo usa):

```html
<script type="module">
import { MathfieldElement } from '../node_modules/mathlive/mathlive.min.mjs'
```

Los fonts y assets (en `node_modules/mathlive/fonts/`) se sirven desde la misma
ruta relativa y no tienen problemas de CORS.

---

## 2. Configuración inicial — hacerla UNA SOLA VEZ

**La regla más importante**: cada vez que se toca una propiedad de `math-field`,
MathLive resetea internamente el estado del cursor/selección. Setear propiedades
múltiples veces o después de interacciones rompe el typing.

```javascript
async function init() {
  await customElements.whenDefined('math-field')
  configureField()   // ← una sola vez, acá
  // ... resto del setup
}

function configureField() {
  mf.smartMode  = false   // CRÍTICO: siempre math mode → \ activa modo LaTeX
  mf.defaultMode = 'math'
  mf.mathVirtualKeyboardPolicy = 'off'
  mf.menuItems  = []
  mf.popoverPolicy = 'auto'
  mf.macros = { R: '\\mathbb{R}', N: '\\mathbb{N}', /* ... */ }
  mf.inlineShortcuts = {
    ...mf.inlineShortcuts,   // preservar los ~200 defaults
    'hat': '\\hat{#@}', 'vec': '\\vec{#@}', 'bar': '\\bar{#@}',
    // ... otros custom
  }
}
```

### `smartMode = false` vs `smartMode = true`

| | `smartMode = true` | `smartMode = false` |
|---|---|---|
| Typing inmediato | ✓ | ✓ (con init correcto) |
| `\` activa modo LaTeX | ✗ (a veces en text mode) | ✓ (siempre en math mode) |
| Recomendado | No | **Sí** |

### Atributos HTML antes del upgrade

Propiedades que deben estar disponibles ANTES de que el Custom Element se registre:

```html
<math-field
  math-virtual-keyboard-policy="off"
  default-mode="math"
></math-field>
```

### Ocultar botones internos via Shadow DOM parts

```css
math-field::part(virtual-keyboard-toggle) { display: none !important; }
math-field::part(menu-toggle)             { display: none !important; }
```

---

## 3. Cargar fórmulas: `insert()` no `setValue()`

**`setValue()` no inicializa el estado interno del cursor.**
El campo queda en un estado donde se puede borrar pero no tipear.

**`insert()` con `replaceAll` sí lo hace correctamente:**

```javascript
function openFormula(id) {
  const f = formulas.find(x => x.id === id)

  syncSrc = 'init'
  mf.insert(f.latex || '', {
    insertionMode: 'replaceAll',
    selectionMode: 'after'    // cursor al final → listo para tipear
  })
  syncSrc = null

  mf.focus()
}
```

Por qué funciona: `insert()` inicializa el modelo interno (átomos, selección, historial)
además de setear el contenido. `setValue()` solo actualiza el valor de salida.

---

## 4. Zombie focus state

**Síntoma**: se puede borrar pero no tipear. Backspace funciona, el resto no.

**Causa**: el click aterriza en el padding del host element en lugar del elemento
editable interno del Shadow DOM. El host tiene foco pero el Shadow DOM no.

**Detección**: `mf.shadowRoot?.activeElement === null` cuando hay foco en el host.

**Fix**:

```javascript
mf.addEventListener('focus', () => {
  requestAnimationFrame(() => {
    if (!mf.shadowRoot?.activeElement) {
      mf.focus()  // redirige al elemento interno
    }
  })
})
```

`requestAnimationFrame` es necesario porque `shadowRoot.activeElement` no se
actualiza sincrónicamente después del evento `focus`.

---

## 5. El `\` y el modo LaTeX

### Cómo funciona internamente

En MathLive, la `\` en math mode está mapeada a:

```javascript
{ key: "\\", ifMode: "math", command: ["switchMode", "latex", "", "\\"] }
```

Esto activa el "latex mode" — un overlay de edición donde los átomos son
`LatexAtom`s. A medida que el usuario tipea, `updateAutocomplete()` busca
`LatexAtom` con value `"\\"` seguido de letras y llama a `suggest()`.

### `suggest()` no retorna resultados para `"\\"` solo

```javascript
function suggest(mf, s) {
  if (s.length === 0 || s === "\\" || !s.startsWith("\\")) return []
  // ...
}
```

El popover **no aparece** hasta que se tipea al menos una letra después de `\`.
Con `\h` ya hay resultados (`\hat`, `\hbar`, etc.).

### El popover vive en `document.body`

```javascript
// MathLive append a document.body
result = document.createElement("div")
result.id = "mathlive-suggestion-popover"
document.body.append(result)
```

CSS: `position: fixed; z-index: 100; display: none`.
Se vuelve visible con clase `is-visible` (que agrega `display: flex`)
después de un `setTimeout` de 32ms.

### El problema del layout de teclado

En teclados donde `\` se produce con AltGr (ej: algunos teclados hispanohablantes),
la combinación tiene `e.altKey = true` o `e.ctrlKey = true`. El keybinding de
MathLive usa `key: "\\"` sin modificadores, por lo que puede no dispararse.

**Resultado**: `\` inserta el símbolo `\backslash` en lugar de activar el modo LaTeX.

### Solución: botón explícito con `executeCommand`

```javascript
btn.addEventListener('mousedown', e => e.preventDefault())  // mantiene foco
btn.addEventListener('click', () => {
  mf.executeCommand(['switchMode', 'latex', '', '\\'])
  mf.focus()
})
```

Esto activa el modo LaTeX de forma confiable sin depender del teclado.

### Flujo completo del modo LaTeX

1. Activar (botón o `\` del teclado)
2. Tipear el nombre del comando: `hat`, `frac`, `vec`...
3. El popover de sugerencias aparece con la primera letra
4. **Tab** — autocompleta la sugerencia (agrega las letras restantes)
5. **Enter** — confirma el comando Y sus argumentos, vuelve a math mode
6. **Tab** (en math mode) — navega entre placeholders `#?`
7. **Esc** — cancela y vuelve a math mode sin insertar

---

## 6. Indicador visual de modo LaTeX

MathLive emite el evento `mode-change` al cambiar de modo:

```javascript
mf.addEventListener('mode-change', () => {
  const inLatex = mf.mode === 'latex'
  mf.classList.toggle('latex-mode', inLatex)
  hint.classList.toggle('visible', inLatex)
})
```

```css
math-field.latex-mode {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124,58,237,.12);
}
```

El cambio de color del borde comunica el cambio de modo sin exponer el concepto
técnico al usuario.

---

## 7. Inline shortcuts — la alternativa rápida

MathLive tiene ~200 shortcuts por defecto (`frac`, `sqrt`, `int`, `sum`, `->`, `<=`, etc.).
Tipear el nombre del shortcut sin backslash lo convierte automáticamente.

Agregar shortcuts custom preservando los defaults:

```javascript
mf.inlineShortcuts = {
  ...mf.inlineShortcuts,   // ← CRÍTICO: no pisar los defaults
  'hat':   '\\hat{#@}',    // #@ = selección actual (wrapping)
  'vec':   '\\vec{#@}',    // #? = placeholder navegable con Tab
  'bar':   '\\bar{#@}',
  'norm':  '\\|#?\\|',
  'RR':    '\\mathbb{R}',
}
```

Comportamiento de `#@`: si hay texto seleccionado al activar el shortcut, lo envuelve.
Sin selección, el cursor queda dentro como `#?` (placeholder).

---

## 8. Snippets: `mf.insert()` con templates

```javascript
mf.insert('\\frac{#?}{#?}', { selectionMode: 'placeholder' })
// selectionMode: 'placeholder' → cursor en el primer #?
// Tab navega al siguiente
```

Los botones de snippet necesitan `mousedown` + `preventDefault()` para no
robar el foco del campo. Sin esto, MathLive queda en zombie focus state
y deja de aceptar teclado.

```javascript
btn.addEventListener('mousedown', e => e.preventDefault())
btn.addEventListener('click', () => {
  mf.insert(template, { selectionMode: 'placeholder' })
  mf.focus()
})
```

---

## 9. Sincronización bidireccional

### Flag `syncSrc` para evitar feedback loops

Igual que en Demo 1, un flag previene que el `input` handler reaccione
a cambios programáticos:

```javascript
let syncSrc = null  // 'init' | 'confirm' | null

// Programático: activar flag
syncSrc = 'init'
mf.insert(...)
syncSrc = null

// Handler: ignorar si viene de código
mf.addEventListener('input', () => {
  if (syncSrc !== null) return
  // ... actualizar estado externo
})
```

### Auto-save en blur

```javascript
mf.addEventListener('blur', () => {
  commitCurrentValue()  // guarda mf.getValue('latex') en el estado
})
```

---

## 10. Todos los botones que conviven con `math-field`

**Regla universal**: cualquier botón en la UI que deba mantenerse sin robar
el foco del campo necesita `mousedown` + `e.preventDefault()`.

Aplica a: snippets, botón confirmar, botón añadir fórmula, botón modo LaTeX,
y cualquier otro control de la misma pantalla.

```javascript
todosLosBotones.forEach(btn => {
  btn.addEventListener('mousedown', e => e.preventDefault())
})
```

Sin esto: el `mousedown` roba el foco, MathLive entra en zombie focus state,
el campo acepta borrar pero no tipear hasta que se vuelve a hacer click.

---

## Resumen: configuración mínima que funciona

```javascript
await customElements.whenDefined('math-field')

// Config: una sola vez
mf.smartMode  = false
mf.defaultMode = 'math'
mf.mathVirtualKeyboardPolicy = 'off'
mf.menuItems  = []
mf.popoverPolicy = 'auto'
mf.inlineShortcuts = { ...mf.inlineShortcuts, /* custom */ }

// Cargar fórmula: insert() no setValue()
mf.insert(latex, { insertionMode: 'replaceAll', selectionMode: 'after' })
mf.focus()

// Zombie fix
mf.addEventListener('focus', () => {
  requestAnimationFrame(() => {
    if (!mf.shadowRoot?.activeElement) mf.focus()
  })
})

// Todos los botones
btn.addEventListener('mousedown', e => e.preventDefault())
```

# Demo 1 — Learnings: TipTap + KaTeX + Popover

> Knowhow práctico acumulado construyendo `demos/demo1-tiptap-katex.html`.
> Este documento captura lo que **no está en la documentación oficial** —
> bugs encontrados, soluciones no obvias, patrones que funcionaron.

---

## 1. NodeViews: lo que la docs no dice

### `atom: true` es obligatorio para fórmulas

Sin `atom: true`, ProseMirror intenta colocar el cursor _dentro_ del nodo.
Con `atom: true` el nodo es tratado como un carácter único — el cursor salta
por encima o lo selecciona completo (NodeSelection).

```javascript
const MathInline = Node.create({
  name: 'mathInline', group: 'inline', inline: true, atom: true, draggable: false,
  // ...
})
```

### `stopEvent()` devuelve `false` — no `true`

Devolver `true` en `stopEvent()` hace que el NodeView capture todos los eventos
del teclado, lo que rompe la navegación del documento. Devolver `false` le dice
a ProseMirror que siga manejando esos eventos.

```javascript
stopEvent() { return false }  // ✅ correcto
stopEvent() { return true }   // ❌ rompe teclado en el documento
```

### `contentEditable = 'false'` es necesario

Sin esto, ProseMirror puede intentar editar el contenido del NodeView.

```javascript
this.dom.contentEditable = 'false'
```

### `editor.view.nodeDOM(pos)` para obtener el DOM del nodo

Para posicionar un popover junto a una fórmula, necesitamos el elemento DOM.
Este método acepta la posición ProseMirror del nodo (no el índice).

```javascript
const domNode = editor.view.nodeDOM(nodePos)
const rect = domNode.getBoundingClientRect()
```

**Gotcha**: el DOM puede no estar disponible inmediatamente después de insertar.
Usar `requestAnimationFrame` como fallback:

```javascript
function showPopover(nodePos) {
  const domNode = editor.view.nodeDOM(nodePos)
  if (!domNode) {
    requestAnimationFrame(() => {
      if (activeNodePos === nodePos) showPopover(nodePos)
    })
    return
  }
  // ...
}
```

---

## 2. NodeSelection vs TextSelection

### Insertar un nodo y seleccionarlo inmediatamente

Después de `replaceSelectionWith`, la posición que tenías puede haber cambiado.
Usar `NodeSelection.create(tr.doc, pos)` con la posición _antes_ del reemplazo:

```javascript
insertMathInline: latex => ({ state, dispatch }) => {
  const node = this.type.create({ latex: latex ?? '' })
  if (dispatch) {
    const pos = state.selection.from      // guardar antes del tr
    const tr  = state.tr.replaceSelectionWith(node)
    tr.setSelection(NodeSelection.create(tr.doc, pos))  // ← pos original
    dispatch(tr)
  }
  return true
}
```

### Mover cursor _después_ de una fórmula (Escape / Ctrl+Enter)

`TextSelection.near()` resuelve correctamente la posición después del nodo:

```javascript
const afterPos = activeNodePos + freshNode.nodeSize
const sel = TextSelection.near(freshState.doc.resolve(afterPos))
view.dispatch(freshState.tr.setSelection(sel))
```

### `selection.node` solo existe en NodeSelection

`editor.state.selection.node` devuelve `undefined` si la selección no es una
NodeSelection. Siempre verificar antes de usarlo:

```javascript
const selNode = editor.state.selection.node  // puede ser undefined
if (selNode && selNode.type.name === 'mathInline') { ... }
```

---

## 3. Sincronización bidireccional sin feedback loops

El patrón que funcionó usa **tres mecanismos ortogonales**:

### Flag `isDispatchingFromPanel`

Previene que `onSelectionUpdate` reaccione a un dispatch que vino del textarea:

```javascript
isDispatchingFromPanel = true
view.dispatch(tr)
isDispatchingFromPanel = false
```

```javascript
function syncPanelFromSelection(editor) {
  if (isDispatchingFromPanel) return
  // ...
}
```

### Flag `isFromNode`

Previene que el `input` listener del textarea reaccione a valores cargados
programáticamente:

```javascript
isFromNode = true
formulaInput.value = selNode.attrs.latex
isFromNode = false
```

```javascript
formulaInput.addEventListener('input', () => {
  if (isFromNode) return
  // ...
})
```

### Guard `editorEl.contains(activeElement)`

ProseMirror dispara `onSelectionUpdate` al perder el foco (blur normalization).
Si el foco está en el popover/sidebar, no borrar el estado activo:

```javascript
function syncPanelFromSelection(editor) {
  const editorEl = document.getElementById('editor')
  if (editorEl && !editorEl.contains(document.activeElement)) return
  // ...
}
```

**Sin este guard**: cualquier clic en un snippet limpiaba `activeNodePos`, haciendo
que el snippet se insertara en una fórmula nueva en lugar de la activa.

---

## 4. Snippets y foco — el bug más difícil

### El problema

Flujo sin fix:
1. Usuario hace clic en botón de snippet
2. `mousedown` → textarea pierde foco → `blur` event
3. `blur` triggerea lógica que cierra el estado activo
4. Luego llega el `click` → `activeNodePos` ya es `null`
5. El snippet crea una fórmula nueva en lugar de insertar en la activa

### La solución

Tres capas:

**Capa 1**: `mousedown` + `preventDefault()` en todos los botones del sidebar:

```javascript
btn.addEventListener('mousedown', e => e.preventDefault())
```

Esto previene que el `mousedown` cause que el textarea pierda el foco.

**Capa 2**: el guard `editorEl.contains(activeElement)` en `syncPanelFromSelection`
(ver sección anterior) — evita que el blur dispatch de ProseMirror limpie el estado.

**Capa 3**: `focus` listener en el textarea que recupera `activeNodePos` si se perdió:

```javascript
formulaInput.addEventListener('focus', () => {
  if (activeNodePos !== null) return
  const selNode = editor.state.selection.node
  if (selNode && (selNode.type.name === 'mathInline' || selNode.type.name === 'mathDisplay')) {
    activeNodePos = selection.from
    // ...
  }
})
```

---

## 5. Popover: medición de dimensiones

### `autoResizeInput()` necesita que el popover esté visible

`scrollHeight` devuelve 0 cuando el elemento tiene `display: none` ancestral.
La secuencia correcta:

```javascript
function showPopover(nodePos) {
  // ...
  popoverEl.style.visibility = 'hidden'   // oculto pero no display:none
  popoverEl.classList.add('visible')       // ← ahora display:block
  autoResizeInput()                        // scrollHeight funciona aquí
  const popoverH = popoverEl.offsetHeight  // también correcto
  // ...
  popoverEl.style.visibility = ''          // mostrar
}
```

### Medir ancho de texto: usar span espejo, no canvas

`canvas.measureText()` tiene mismatch con los fonts reales del browser porque:
- Los web fonts pueden no estar cargados cuando se llama
- Las métricas de canvas no coinciden exactamente con el layout del browser

**Solución**: un `<span>` espejo con el mismo font, fuera del viewport:

```html
<span id="fp-mirror" aria-hidden="true"></span>
```

```css
#fp-mirror {
  position: fixed;
  top: -9999px; left: -9999px;
  font: 400 13px/1.5 var(--font-mono);
  white-space: pre;       /* ← crítico: preserva espacios y tabs */
  visibility: hidden;
  pointer-events: none;
}
```

```javascript
function calcPopoverWidth() {
  const text = formulaInput.value || formulaInput.getAttribute('placeholder') || ''
  const longestLine = text.split('\n').reduce((a, b) => a.length > b.length ? a : b, '')
  fpMirror.textContent = longestLine
  const textPx = fpMirror.getBoundingClientRect().width  // medición nativa exacta
  const padH   = 30
  const maxW   = document.getElementById('editor-wrap').clientWidth - 24
  return Math.round(Math.max(160, Math.min(textPx + padH, maxW)))
}
```

### Posicionar el popover sobre/bajo la fórmula

```javascript
const spaceBelow = window.innerHeight - rect.bottom - GAP - MARGIN
const spaceAbove = rect.top - GAP - MARGIN

if (spaceBelow >= popoverH || spaceBelow >= spaceAbove) {
  top = rect.bottom + GAP     // debajo
  arrowBelow = false
} else {
  top = rect.top - GAP - popoverH  // arriba
  arrowBelow = true
}
```

La flecha se reposiciona para apuntar siempre al centro de la fórmula:

```javascript
const arrowLeft = Math.max(10, Math.min(
  rect.left + rect.width / 2 - left - 5,   // centro de la fórmula
  popoverW - 24
))
```

---

## 6. Historial (Undo/Redo)

### Edición en tiempo real sin ensuciar el historial

Mientras el usuario escribe en el textarea, cada keystroke no debe generar un
entry en el historial. Usar `addToHistory: false`:

```javascript
const tr = state.tr
tr.setNodeMarkup(activeNodePos, null, { latex })
tr.setMeta('addToHistory', false)    // ← no registrar en historial
view.dispatch(tr)
```

### Un solo Undo-point al terminar de editar

En el `blur` del textarea, hacer un dispatch normal (sin `addToHistory: false`).
Esto crea un punto de historial por "sesión de edición":

```javascript
formulaInput.addEventListener('blur', () => {
  if (activeNodePos === null) return
  const latex = formulaInput.value
  view.dispatch(state.tr.setNodeMarkup(activeNodePos, null, { latex }))
})
```

---

## 7. InputRules: sintaxis `$...$`

```javascript
addInputRules() {
  return [new InputRule({
    find: /\$([^\$\n]+)\$$/,   // $contenido$ al final de la línea de escritura
    handler: ({ state, range, match }) => {
      const latex = match[1].trim()
      if (!latex) return null
      state.tr.replaceRangeWith(range.from, range.to, type.create({ latex }))
    },
  })]
}
```

**Gotcha**: el regex debe terminar en `$` para que ProseMirror lo evalúe
en el momento correcto (cuando se escribe el segundo `$`).

---

## 8. MathDisplay: insertar como bloque hermano

`insertMathInline` usa `replaceSelectionWith` (reemplaza el cursor).
`insertMathDisplay` debe insertarse como nodo de bloque hermano:

```javascript
insertMathDisplay: latex => ({ state, dispatch }) => {
  const node = this.type.create({ latex: latex ?? '' })
  if (dispatch) {
    const { $from } = state.selection
    const insertPos = $from.after($from.depth)   // ← fin del bloque actual
    const tr = state.tr.insert(insertPos, node)
    tr.setSelection(NodeSelection.create(tr.doc, insertPos))
    dispatch(tr)
  }
  return true
}
```

Usar `replaceSelectionWith` para un nodo de bloque no funciona cuando el cursor
está en medio de texto — ProseMirror no sabe cómo dividir el párrafo.

---

## 9. KaTeX: render en NodeViews

```javascript
katex.render(latex, container, {
  throwOnError: true,   // ← para detectar errores y mostrar clase has-error
  displayMode,          // true para display, false para inline
  output: 'html',
  trust: false          // ← seguridad: no ejecutar \htmlClass etc.
})
```

El estado vacío necesita tratarse explícitamente — KaTeX tira error con string vacío:

```javascript
function renderLatex(latex, container, displayMode) {
  if (!latex || !latex.trim()) {
    container.innerHTML = displayMode
      ? '<span class="math-empty">vacío — editá en el popover</span>'
      : '<span class="math-empty-dot"></span>'
    return true
  }
  // ...
}
```

---

## 10. Estilos: una sola caja, no dos

El antipatrón es tener un textarea con borde dentro de un panel con borde.
La solución minimalista: **el popover es el contenedor, el textarea es transparente**:

```css
#formula-popover {
  border: 1.5px solid var(--border-strong);
  border-radius: var(--r-lg);
  padding: 9px 11px;
}

#formula-input {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  resize: none;
  overflow: hidden;       /* ← sin scrollbar; la altura se ajusta con JS */
}

/* Focus: iluminar el popover entero, no el textarea */
#formula-popover:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(37,99,235,.1);
}

/* Error: borde rojo en el popover */
#formula-popover.has-error {
  border-color: var(--error);
  box-shadow: 0 0 0 3px rgba(220,38,38,.08);
}
```

---

## 11. Scroll del editor: reposicionar el popover

Si el usuario hace scroll mientras el popover está abierto, debe seguir a la fórmula:

```javascript
document.getElementById('editor-wrap').addEventListener('scroll', () => {
  if (activeNodePos !== null && popoverEl.classList.contains('visible'))
    showPopover(activeNodePos)
})
```

---

## 12. Snippets: patrón `#@` / `#?`

- `#@` → reemplazado por el texto actualmente seleccionado en el textarea (wrapping)
- `#?` → placeholder; el cursor se posiciona en el primero; los restantes quedan vacíos

```javascript
let snippet = template.replace(/#@/g, selected)
const cursorOffset = snippet.indexOf('#?')
snippet = snippet.replace(/#\?/g, '')

formulaInput.value = before + snippet + after
const cursorPos = cursorOffset >= 0
  ? start + cursorOffset
  : start + snippet.length
formulaInput.setSelectionRange(cursorPos, cursorPos)
```

---

## Resumen de patterns anti-feedback-loop

| Escenario | Solución |
|---|---|
| textarea → TipTap → NodeView → textarea | Flag `isDispatchingFromPanel` |
| código carga valor en textarea → textarea.input handler se dispara | Flag `isFromNode` |
| blur de ProseMirror limpia estado mientras se usa popover | Guard `editorEl.contains(activeElement)` |
| mousedown en snippet roba foco del textarea | `mousedown` + `e.preventDefault()` |
| DOM del nodo no disponible al insertar | `requestAnimationFrame` retry con guard de pos |
| scrollHeight=0 al auto-resize con popover oculto | Llamar después de `classList.add('visible')` |

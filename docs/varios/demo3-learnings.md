# Demo 3 — Learnings: TipTap + MathLive + KaTeX integrados

> Knowhow práctico acumulado construyendo `demos/demo3-integration.html`.
> Patrón de la demo: editor de texto enriquecido con fórmulas LaTeX clickeables,
> popover flotante con editor visual (MathLive) + editor de código (textarea).
> Este documento captura lo que **no está en la documentación oficial** —
> la complejidad real de integrar tres librerías con modelos de eventos distintos.

---

## 1. Arquitectura general

### Las tres capas y sus roles

```
TipTap (ProseMirror)
  └─ NodeViews: renderiza con KaTeX, detecta clicks
       └─ Popover flotante (fuera del DOM de TipTap)
            ├─ MathLive (editor visual)
            └─ Textarea (editor de código LaTeX)
                 └─ Fuente de verdad → dispatch a TipTap
```

**KaTeX** renderiza en el documento (lectura). **MathLive** edita visualmente en el
popover (solo cuando está abierto). **Textarea** es la fuente de verdad compartida:
lo que tiene el textarea es lo que está en TipTap.

### Por qué MathLive vive FUERA del DOM de TipTap

TipTap/ProseMirror reemplaza los NodeViews en cada re-render. Si MathLive estuviera
dentro de un NodeView, sería destruido y recreado en cada cambio de documento —
perdería foco, estado interno y cursor. La solución: un único `<math-field>` en el
`<body>` que se reutiliza para todas las fórmulas.

---

## 2. El problema central: feedback loops

La integración de tres fuentes de input (MathLive, textarea, TipTap) genera loops:

```
textarea input → MathLive → input event → textarea input → ...
MathLive input → TipTap dispatch → onUpdate → MathLive → ...
```

### Por qué los flags simples (`isFromTipTap`) no alcanzan

`fpMf.insert()` despacha su evento `input` via un **setTimeout interno** de ~32ms,
**no sincrónicamente**. Esto hace que cualquier flag seteado antes del insert y
limpiado después ya esté limpio cuando el evento dispara:

```javascript
isFromTipTap = true
fpMf.insert(latex)      // programa setTimeout({input event}, ~32ms)
isFromTipTap = false    // limpiado ANTES de que el evento dispare
// ... 32ms después: input event dispara, isFromTipTap === false → loop
```

Intentos fallidos: `requestAnimationFrame` (16ms < 32ms), `setTimeout(80ms)`
(MathLive puede exceder ese tiempo), debounce con validación.

### La solución: `editingSource` como variable de control

En lugar de flags de "qué acción disparó este evento", se trackea **quién tiene
el control editorial actualmente**:

```javascript
let editingSource = null  // 'mathlive' | 'textarea' | null

// Handler de MathLive — solo corre si MathLive está en control
fpMf.addEventListener('input', () => {
  if (editingSource !== 'mathlive') return  // descarta eventos programáticos
  // ... actualizar textarea + TipTap
})

// Al hacer focus en MathLive:
fpMf.addEventListener('focus', () => { editingSource = 'mathlive' })

// Al hacer focus en textarea:
formulaInput.addEventListener('focus', () => { editingSource = 'textarea' })

// Al perder foco:
fpMf.addEventListener('blur', () => { editingSource = null })
formulaInput.addEventListener('blur', () => { editingSource = null })
```

**Por qué funciona:** cuando el textarea tiene el control (`editingSource = 'textarea'`),
todos los eventos `input` de MathLive son descartados sin importar cuándo disparen
sus timers internos.

---

## 3. `insert()` vs `setValue()` y el problema del foco

### `setValue()` deja zombie state

```javascript
fpMf.setValue(latex)  // ❌ inicializa el valor pero NO el modelo de cursor
// Resultado: se puede borrar con Backspace pero no tipear
```

### `insert()` con `replaceAll` es no-determinístico sin foco activo

```javascript
// Sin foco activo — puede agregar en lugar de reemplazar:
fpMf.insert(latex, { insertionMode: 'replaceAll' })  // ⚠ unreliable

// Con foco activo — funciona correctamente:
fpMf.focus()
fpMf.insert(latex, { insertionMode: 'replaceAll', selectionMode: 'after' })  // ✓
```

### La solución: cargar en el handler de `focus`

```javascript
fpMf.addEventListener('focus', () => {
  editingSource = 'mathlive'
  if (skipMfReload) { skipMfReload = false; return }
  fpMf.insert(formulaInput.value, { insertionMode: 'replaceAll', selectionMode: 'after' })
  // zombie fix
  requestAnimationFrame(() => {
    if (!fpMf.shadowRoot?.activeElement) fpMf.focus()
  })
})
```

El insert se hace **dentro del focus handler** porque en ese punto el elemento ya
tiene foco activo garantizado.

---

## 4. El flag `skipMfReload` — evitar doble insert

`showPopover()` necesita hacer un insert para inicializar el cursor antes de llamar
`focus()`. Sin la protección, el focus handler haría un segundo insert innecesario:

```javascript
// En showPopover():
skipMfReload = true                          // 1. señal al focus handler
fpMf.insert(formulaInput.value, {...})       // 2. insert inicial
fpMf.focus()                                 // 3. dispara focus handler
//   → focus handler ve skipMfReload=true → lo limpia → omite su insert
```

Lo mismo aplica en `setEditMode('visual')` cuando se cambia de modo código a visual.

---

## 5. El modo LaTeX interno de MathLive y sus trampas

### `getValue('latex')` retorna contenido truncado en modo LaTeX

Cuando MathLive está en modo LaTeX (activado con `\`), los caracteres tipeados
son `LatexAtom`s en construcción, **no están en el árbol principal de átomos**.
Llamar `getValue('latex')` en este estado devuelve la fórmula SIN el comando
a medio tipear:

```
Fórmula: x^2 + \fra   ← usuario tipeando \frac
getValue() retorna: "x^2 + "   ← el \fra no está serializado
```

### Bug: click en otra fórmula mientras se está en modo LaTeX

Flujo problemático:
1. MathLive en modo LaTeX (tipeando `\hat`)
2. Click en otra fórmula → MathLive blur
3. blur handler llama `getValue()` → retorna fórmula truncada
4. `dispatchToTipTap(truncated)` → fórmula original destruida
5. `showPopover()` llama `insert()` en modo LaTeX → comportamiento indefinido

### Solución: `exitLatexMode()` + blur guard

```javascript
function exitLatexMode() {
  if (fpMf.mode === 'latex') fpMf.executeCommand(['complete', 'reject'])
  fpMf.classList.remove('latex-mode')
  fpLatexHint.classList.remove('visible')
  popoverEl.classList.remove('latex-mode-active')
}

// En blur: no commitear si estamos en modo LaTeX
fpMf.addEventListener('blur', () => {
  if (fpMf.mode === 'latex') {
    editingSource = null
    return  // fórmula queda intacta como estaba antes del \
  }
  // ... commit normal
})

// En showPopover: resetear antes de insertar
function showPopover(nodePos) {
  exitLatexMode()  // ← garantiza que insert() opera en modo math
  // ...
}
```

`complete/reject` cancela el comando en construcción y vuelve a math mode sin
confirmar nada.

---

## 6. NodeView click handlers — autocontenidos

### El problema de depender de `syncPanelFromSelection`

```javascript
// ❌ Frágil: depende de que onSelectionUpdate haya corrido antes
this.dom.addEventListener('click', () => {
  showPopover(activeNodePos)  // activeNodePos puede ser null o el anterior
})
```

`syncPanelFromSelection` tiene un guard `editorEl.contains(document.activeElement)`
que lo hace retornar temprano si el foco está en el popover. Al hacer click en
otra fórmula mientras el popover está abierto, el guard cancela el sync.

### Solución: el click handler setea todo directamente

```javascript
this.dom.addEventListener('click', () => {
  const pos = this.getPos()              // posición fresca desde ProseMirror
  activeNodePos = pos                    // setear AQUÍ, no depender de sync
  isFromTipTap = true
  formulaInput.value = this.node.attrs.latex
  isFromTipTap = false
  autoResizeInput()
  sbNode.textContent = '$ inline'
  refreshStatus(this.node.attrs.latex)
  document.querySelectorAll('#snippets-sidebar .snip, .sb-quick-btn, #btn-latex-mode, #btn-save-snip')
    .forEach(b => b.disabled = false)
  showPopover(pos)
})
```

---

## 7. Toggle Visual / Código — arquitectura del popover

### Error común: el toggle dentro del wrap que se oculta

```html
<!-- ❌ Al colapsar fp-mf-wrap, el toggle desaparece con él -->
<div id="fp-mf-wrap">
  <div id="fp-mf-toolbar">
    <div id="fp-mode-toggle">...</div>  <!-- oculto junto con MathLive -->
  </div>
  <math-field>...</math-field>
</div>
```

### Estructura correcta: toolbar hermano de ambos wraps

```html
<!-- ✓ Toolbar siempre visible, cada wrap se oculta independientemente -->
<div id="fp-mf-toolbar">          <!-- SIEMPRE visible -->
  <div id="fp-mode-toggle">...</div>
  <button id="btn-latex-mode">\ LaTeX</button>
</div>
<div id="fp-mf-wrap">             <!-- visible en modo visual -->
  <math-field>...</math-field>
</div>
<div id="fp-source-wrap">         <!-- visible en modo código -->
  <textarea id="formula-input"></textarea>
</div>
```

### Textarea en `display:none` — comportamiento

- **Leer/escribir `.value`**: funciona normalmente aunque el contenedor esté oculto ✓
- **`scrollHeight`**: retorna 0 cuando el elemento está en `display:none` → `autoResizeInput()` setea `height:0`, pero `min-height` en CSS lo compensa ✓
- **`.focus()`**: funciona para darle foco cuando se muestra ✓

---

## 8. El popover del sugerencias de MathLive

### Dónde vive y cómo se controla

MathLive appenda su popover de sugerencias directamente a `document.body`:

```javascript
// Interno de MathLive:
result = document.createElement("div")
result.id = "mathlive-suggestion-popover"
document.body.append(result)
// CSS: position: fixed; z-index: 100; display: none
```

Se vuelve visible con clase `is-visible` después de un `setTimeout` de 32ms.

### Problema de z-index

El popover de sugerencias tiene `z-index: 100`. El formula popover tiene `z-index: 200`.
**El popover de sugerencias quedaba detrás.** Fix:

```css
#mathlive-suggestion-popover { z-index: 300 !important; }
```

### Parpadeo en navegación con flechas

La clase `is-animated` se re-agrega en cada cambio de selección, re-disparando la
animación `ML__fade-in`. Fix:

```css
#mathlive-suggestion-popover.is-animated {
  animation: none !important;
  transition: none !important;
}
```

### Restyling completo

El popover de sugerencias es 100% overrideable vía CSS con `!important` desde el
documento padre (no está en Shadow DOM):

```css
#mathlive-suggestion-popover {
  background: var(--surface) !important;
  border: 1.5px solid var(--border-strong) !important;
  border-radius: var(--r-lg) !important;
  z-index: 300 !important;
}
.ML__popover__command { font-size: 1em !important; }        /* símbolo renderizado */
.ML__popover__latex   { font: 500 11px/1.4 monospace !important; }  /* \nombre */
```

---

## 9. Sincronización bidireccional — diseño final

### Diagrama de flujo limpio

```
[Click en fórmula TipTap]
    → activeNodePos = pos
    → formulaInput.value = latex
    → showPopover() → exitLatexMode() → insert() → fpMf.focus()
         → focus handler: editingSource='mathlive', skipMfReload check

[Usuario edita en MathLive]
    → input event (editingSource==='mathlive') ✓
    → formulaInput.value = fpMf.getValue()
    → dispatchToTipTap(latex, false)   ← sin historia
    → blur event → dispatchToTipTap(latex, true)  ← con historia

[Usuario edita en textarea]
    → focus: editingSource='textarea'
    → input event → dispatchToTipTap(latex, false)
      (MathLive NO se actualiza en tiempo real — insert() sin foco es unreliable)
    → Al volver a MathLive: focus handler recarga desde formulaInput.value ✓
    → blur event → dispatchToTipTap(latex, true)

[Cambio de modo Visual ↔ Código]
    → exitLatexMode() primero
    → Visual: skipMfReload=true, insert(), fpMf.focus()
    → Código: editingSource='textarea', formulaInput.focus()
```

### `dispatchToTipTap` — el único punto de escritura a TipTap

```javascript
function dispatchToTipTap(latex, addToHistory) {
  if (activeNodePos === null) return
  const { state, view } = editor
  const node = state.doc.nodeAt(activeNodePos)
  if (!node || ...) { activeNodePos = null; return }  // invalidar si el nodo ya no existe
  const tr = state.tr.setNodeMarkup(activeNodePos, null, { latex })
  if (!addToHistory) tr.setMeta('addToHistory', false)  // cambios intermedios sin Undo
  isDispatchingFromPanel = true
  view.dispatch(tr)
  isDispatchingFromPanel = false
}
```

`isDispatchingFromPanel` previene que `onSelectionUpdate` cierre el popover mientras
el panel está escribiendo a TipTap.

---

## 10. KaTeX en TipTap NodeViews

### Renderizado en tiempo real sin overhead

```javascript
_render() {
  const ok = renderLatex(this.node.attrs.latex, this.dom, false)
  this.dom.classList.toggle('has-error', !ok)
}

// En renderLatex:
function renderLatex(latex, container, displayMode) {
  if (!latex?.trim()) {
    container.innerHTML = '<span class="math-empty-dot"></span>'
    return true
  }
  try {
    katex.render(latex, container, { throwOnError: true, displayMode })
    return true
  } catch (err) {
    container.innerHTML = `<span class="math-errstr">⚠ ${latex.slice(0,40)}</span>`
    return false
  }
}
```

TipTap llama `update(node)` en el NodeView cuando el atributo cambia. Solo re-renderizar
cuando el latex realmente cambió:

```javascript
update(node) {
  if (node.type.name !== 'mathInline') return false  // rechazar si el tipo no coincide
  const changed = node.attrs.latex !== this.node.attrs.latex
  this.node = node
  if (changed) this._render()                        // solo re-render si cambió
  return true
}
```

### Input rules — inserción desde texto

```javascript
addInputRules() {
  return [new InputRule({
    find: /\$([^\$\n]+)\$$/,
    handler: ({ state, range, match }) => {
      const latex = match[1].trim()
      if (!latex) return null
      state.tr.replaceRangeWith(range.from, range.to, this.type.create({ latex }))
    },
  })]
}
```

Permite tipear `$x^2$` para insertar inline sin necesidad del toolbar.

---

## 11. Dark mode con CSS custom properties

### Override en cascada

Los custom properties en CSS se heredan hacia los descendientes. Definir overrides
en `body.dark` es suficiente para toda la aplicación:

```css
:root {
  --bg: #fafaf9;
  --surface: #ffffff;
  /* ... */
}

body.dark {
  --bg: #1a1917;
  --surface: #262523;
  /* ... todos los tokens sobreescritos */
}
```

### MathLive y Shadow DOM en dark mode

MathLive renderiza en Shadow DOM. La propiedad `color` **sí se hereda** dentro
del Shadow DOM desde el host element:

```css
body.dark math-field#fp-mf { color: var(--text); }
```

Esto hace que el texto matemático dentro de MathLive adopte el color del tema oscuro.

### Overrides necesarios para colores hardcodeados

Los colores hardcodeados en el CSS (hover states, iconos) requieren overrides explícitos:

```css
body.dark .tbtn.math         { color: #818cf8; }
body.dark .tbtn.math:hover   { background: #1e1a40; }
body.dark .snip:hover        { background: #22193a; }
body.dark .snip-icon         { color: #818cf8; }
/* etc. */
```

**Regla:** si un color usa `var(--token)` se adapta solo. Si está hardcodeado, necesita override.

---

## 12. Sidebar colapsable — patrón CSS

### Width transition + hide content

El contenido se oculta inmediatamente (`display: none`), mientras el ancho anima:

```css
#snippets-sidebar { transition: width .18s; overflow: hidden; }
#snippets-sidebar.collapsed { width: 44px; }

#snippets-sidebar.collapsed #sb-title,
#snippets-sidebar.collapsed #snippet-search,
#snippets-sidebar.collapsed #snippet-list { display: none; }  /* ← inmediato */
```

El resultado visual: los elementos desaparecen snap, el contenedor se contrae
suavemente. Más limpio que animar opacity + width juntos.

### Panel de iconos quick-access

El panel colapsado muestra iconos con `title` como tooltip:

```javascript
const QUICK_SNIPS = [
  { icon: 'a/b', label: 'Fracción', t: '\\frac{#@}{#?}' },
  { icon: '√',   label: 'Raíz',    t: '\\sqrt{#@}'      },
  // ...
]
// Mismo patrón de mousedown+preventDefault que los snips regulares
btn.addEventListener('mousedown', e => e.preventDefault())
btn.addEventListener('click', () => insertSnippet(s.t))
```

---

## 13. Persistencia de preferencias UI

localStorage para preferencias que sobreviven entre sesiones:

```javascript
// Tema
localStorage.setItem('formalia-theme', dark ? 'dark' : 'light')
localStorage.getItem('formalia-theme') === 'dark'

// Sidebar
localStorage.setItem('formalia-sb-collapsed', col ? '1' : '0')
localStorage.getItem('formalia-sb-collapsed') === '1'

// Snippets custom
localStorage.setItem('formalia-custom-snippets', JSON.stringify(arr))
JSON.parse(localStorage.getItem('formalia-custom-snippets') ?? '[]')
```

Inicialización idempotente en el boot del módulo: leer → aplicar → listo.

---

## 14. Top-level await en módulos ES — orden de ejecución

El módulo usa `await customElements.whenDefined('math-field')` a nivel top-level.
Todo lo que viene después del `await` corre en microtask, no sincrónicamente.

**Implicaciones:**

| Declarado antes del await | Declarado después del await |
|---|---|
| `const editor = new Editor(...)` | `const popoverEl = getElementById(...)` |
| NodeView classes | `const formulaInput = ...` |
| Extension definitions | Event listeners de popover |

Los event handlers registrados DESPUÉS del `await` cierran sobre variables que aún
no existen al momento del registro. Esto está bien porque:
1. Los handlers solo corren en respuesta a interacción del usuario
2. La interacción solo puede ocurrir DESPUÉS de que el módulo terminó de inicializar
3. Para entonces, todas las variables ya están inicializadas

**Excepción:** `syncPanelFromSelection` puede ser llamado por `onSelectionUpdate`
durante la creación del editor (antes del await). Tiene un guard explícito:

```javascript
const editorEl = document.getElementById('editor')
if (editorEl && !editorEl.contains(document.activeElement)) return
```

En el boot, `document.activeElement === body`, por lo que el guard retorna temprano
sin acceder a variables en TDZ.

---

## Resumen: los patrones que funcionan

```javascript
// 1. Guard principal contra feedback loops
let editingSource = null  // 'mathlive' | 'textarea' | null
fpMf.addEventListener('input', () => {
  if (editingSource !== 'mathlive') return
  // ...
})

// 2. Cargar en focus, no antes
fpMf.addEventListener('focus', () => {
  editingSource = 'mathlive'
  if (skipMfReload) { skipMfReload = false; return }
  fpMf.insert(formulaInput.value, { insertionMode: 'replaceAll', selectionMode: 'after' })
})

// 3. Salir de modo LaTeX antes de cualquier operación
function exitLatexMode() {
  if (fpMf.mode === 'latex') fpMf.executeCommand(['complete', 'reject'])
  // limpiar clases visuales...
}

// 4. Blur guard en modo LaTeX
fpMf.addEventListener('blur', () => {
  if (fpMf.mode === 'latex') { editingSource = null; return }
  // commit normal...
})

// 5. showPopover siempre limpia el estado
function showPopover(nodePos) {
  exitLatexMode()    // ← antes de insert()
  skipMfReload = true
  fpMf.insert(formulaInput.value, { insertionMode: 'replaceAll', selectionMode: 'after' })
  fpMf.focus()
}

// 6. NodeViews autocontenidos
this.dom.addEventListener('click', () => {
  const pos = this.getPos()  // ← siempre fresco
  activeNodePos = pos
  formulaInput.value = this.node.attrs.latex
  showPopover(pos)
})
```

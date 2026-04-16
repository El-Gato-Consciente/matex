# MathLive — Investigación Profunda

> Documento de referencia técnica para la integración de MathLive en Formalia.
> Cubre la API completa de `<math-field>`, el teclado virtual, menús, eventos,
> sincronización bidireccional, y todo lo relevante para usarlo como editor
> de fórmulas en un toolbar externo al editor TipTap.

---

## 1. Arquitectura del Componente

### `<math-field>` como Web Component

MathLive expone un Custom Element estándar: `<math-field>` (clase `MathfieldElement`).
Internamente implementa un editor LaTeX de propósito específico con:

- Shadow DOM completo para aislar estilos y estructura interna
- Motor de parsing LaTeX propio (independiente de KaTeX/MathJax)
- Representación interna en un formato basado en átomos (no el árbol LaTeX textual)
- Renderizado propio con MathJax fonts o fuentes estándar TeX

```
MathfieldElement (Custom Element)
  ├── Shadow DOM
  │     ├── Campo editable interno (aria-richtext)
  │     ├── Teclado virtual (condicional)
  │     └── Menú contextual (condicional)
  ├── Valor LaTeX (serializado desde átomos internos)
  ├── Valor MathJSON (serializado desde átomos internos)
  └── Eventos DOM estándar (input, change, etc.)
```

### Instalación

```bash
npm install mathlive
```

```typescript
// Importar el elemento (registra <math-field> en el CustomElements registry)
import 'mathlive'

// O importar la clase directamente
import { MathfieldElement } from 'mathlive'

// En HTML
// <math-field id="formula">x^2 + y^2</math-field>
```

### Inicialización

```typescript
const mf = document.getElementById('formula') as MathfieldElement
// O crearlo programáticamente:
const mf = new MathfieldElement()
document.getElementById('toolbar')!.appendChild(mf)
```

---

## 2. API getValue / setValue

### Formatos disponibles

```typescript
// LECTURA
mf.getValue()                    // LaTeX (formato por defecto)
mf.getValue('latex')             // LaTeX canónico
mf.getValue('latex-unstyled')    // LaTeX sin comandos de estilo (\textbf, etc.)
mf.getValue('latex-expanded')    // LaTeX con macros expandidos
mf.getValue('math-json')         // MathJSON (objeto JS o string según versión)
mf.getValue('ascii-math')        // AsciiMath (menos preciso)
mf.getValue('spoken')            // Descripción hablada (para accesibilidad)
mf.getValue('spoken-text')       // Solo texto hablado, sin SSML
mf.getValue('spoken-ssml')       // Con marcado SSML
mf.getValue('mathml')            // MathML (serialización estándar)

// ESCRITURA
mf.setValue('x^2 + y^2')                          // LaTeX
mf.setValue('x^2', { selectionMode: 'after' })    // Con opciones
mf.value = '\\frac{a}{b}'                         // Propiedad directa (LaTeX)
```

### Cuándo usar cada formato

| Formato | Cuándo usarlo |
|---|---|
| `'latex'` | Almacenar, editar, exportar — es el formato canónico |
| `'math-json'` | Cuando necesitamos parsear la expresión para el AST interno de Formalia |
| `'latex-expanded'` | Antes de parsear: expande macros y facilita análisis |
| `'mathml'` | Si se necesita exportar a HTML semántico |
| `'spoken'` | Accesibilidad |
| `'ascii-math'` | Compatibilidad con sistemas legacy (no recomendado como fuente de verdad) |

### Precisión y fidelidad

```typescript
// 'latex' puede incluir información de estilo que 'latex-unstyled' omite
mf.getValue('latex')          // '\textbf{x}^2'
mf.getValue('latex-unstyled') // 'x^2'

// 'math-json' puede perder información de presentación LaTeX:
// '\mathrm{d}x' → puede serializar como 'dx' en MathJSON
// Para AST de Formalia, usar 'math-json' + verificar fidelidad de round-trip
```

### setValue con opciones

```typescript
interface SetValueOptions {
  insertionMode?: 'replaceAll' | 'insertBefore' | 'insertAfter'
  selectionMode?: 'placeholder' | 'after' | 'before' | 'item'
  format?: string  // Formato del valor proporcionado
  suppressChangeNotifications?: boolean  // No disparar evento 'change'
}

// Reemplazar todo el contenido sin disparar eventos
mf.setValue('\\int_a^b f(x)\\,dx', {
  suppressChangeNotifications: true,
})

// Insertar después de la posición actual
mf.setValue('\\alpha', { insertionMode: 'insertAfter' })
```

---

## 3. MathJSON

### Qué es MathJSON

MathJSON es un formato de intercambio de expresiones matemáticas creado por
el equipo de Cortex (los mismos de MathLive). Es un JSON estructurado que
representa árboles de expresión matemática.

```json
// x^2 + y^2 = r^2 en MathJSON
["Equal",
  ["Add",
    ["Power", "x", 2],
    ["Power", "y", 2]
  ],
  ["Power", "r", 2]
]

// \frac{d}{dx} f(x) en MathJSON
["Derivative", ["Apply", "f", "x"], "x"]
```

### Cuándo preferir MathJSON sobre LaTeX

| Situación | Recomendación |
|---|---|
| Parsear para el AST de Formalia | MathJSON — más estructurado que parsear LaTeX |
| Almacenar en nodo TipTap | LaTeX — más compacto, round-trip más fiable |
| Normalización semántica | MathJSON — operaciones sobre estructura, no strings |
| Exportar a `.tex` | LaTeX — es el target final |
| Detección de patrones (e.g., "¿es una integral?") | MathJSON — trivial con JSON |

### Limitaciones de MathJSON

- **Pérdida de información de presentación**: comandos puramente visuales como
  `\mathbf`, `\color`, espacio fino `\,` pueden perderse o alterarse.
- **Macros no expandidos**: `\R` no se convierte en `\mathbb{R}` automáticamente
  a menos que se registren macros en MathLive.
- **Arrays y matrices**: la serialización puede diferir entre versiones.
- **El formato es propiedad de Cortex**: puede cambiar entre versiones de MathLive.

### Truco del math-field oculto

Para parsear LaTeX → MathJSON sin instanciar un campo visible:

```typescript
// Un único campo oculto como parser
const hiddenParser = new MathfieldElement()
hiddenParser.style.display = 'none'
hiddenParser.mathVirtualKeyboardPolicy = 'off'
document.body.appendChild(hiddenParser)

function latexToMathJson(latex: string): object {
  hiddenParser.setValue(latex, { suppressChangeNotifications: true })
  const json = hiddenParser.getValue('math-json')
  return typeof json === 'string' ? JSON.parse(json) : json
}
```

**Caveats del campo oculto:**
- El campo oculto debe estar en el DOM (no basta con crearlo, hay que hacer appendChild).
- `display: none` puede afectar al layout interno; usar `visibility: hidden; position: absolute` si hay problemas.
- No es thread-safe — usar en el hilo principal solamente.
- El campo puede no estar completamente inicializado hasta el siguiente frame tras el append.

---

## 4. Eventos

### Eventos principales

```typescript
// 'input' — dispara en CADA cambio del valor (por keystroke, setValue programático, etc.)
mf.addEventListener('input', (e: Event) => {
  const latex = (e.target as MathfieldElement).value
  // Actualizar estado
})

// 'change' — dispara cuando el usuario "confirma" (blur, Enter, etc.)
// Similar al 'change' de un <input>
mf.addEventListener('change', (e: Event) => {
  const latex = (e.target as MathfieldElement).value
})

// 'selection-change' — dispara cuando la selección interna cambia
// Útil para mostrar en el toolbar qué está seleccionado
mf.addEventListener('selection-change', (e: Event) => {
  const selection = (e.target as MathfieldElement).selection
})

// 'focus' / 'blur' estándar
mf.addEventListener('focus', () => { /* activar toolbar */ })
mf.addEventListener('blur', () => { /* desactivar toolbar */ })

// 'mode-change' — cuando cambia entre modo math y texto
mf.addEventListener('mode-change', (e: CustomEvent) => {
  console.log(e.detail.mode)  // 'math' | 'text' | 'latex'
})

// 'keystroke' — evento de bajo nivel para cada tecla
mf.addEventListener('keystroke', (e: CustomEvent) => {
  // e.detail.keystroke: string (e.g., 'Meta-KeyA')
  // e.detail.event: KeyboardEvent original
  // Retornar false para cancelar el keystroke
})
```

### Orden de eventos por acción

| Acción del usuario | Eventos disparados (en orden) |
|---|---|
| Teclear un carácter | `keystroke` → `input` |
| Click en botón externo que llama setValue | `input` (si no suppressChangeNotifications) |
| Presionar Enter/Tab | `change` → `blur` (si Tab) |
| Focus/Blur | `focus` / `blur` |
| Seleccionar con mouse | `selection-change` |

### Diferencia crítica entre 'input' y 'change'

Para sincronizar el FormulaPanel con el editor TipTap en tiempo real, usar `'input'`.
Para confirmar la fórmula al presionar Enter, usar `'change'` o capturar Enter en `'keystroke'`.

```typescript
// Sincronización en tiempo real mientras el usuario edita
mf.addEventListener('input', () => {
  pipeline.process(mf.getValue('math-json'), 'math-json')
})

// Confirmar inserción con Enter
mf.addEventListener('keystroke', (e: CustomEvent) => {
  if (e.detail.keystroke === 'Enter') {
    e.preventDefault()
    editor.commands.confirmActiveFormula()
  }
})
```

---

## 5. Teclado Virtual

### El problema del teclado virtual

Por defecto, MathLive muestra un teclado virtual en dispositivos táctiles y en
escritorio cuando el campo recibe foco. Para Formalia, **no lo queremos**:
tendremos nuestros propios botones de snippets.

### Deshabilitar completamente el teclado virtual

```typescript
// Propiedad en la instancia
mf.mathVirtualKeyboardPolicy = 'off'

// O via HTML attribute
// <math-field math-virtual-keyboard-policy="off">

// O globalmente para TODOS los math-fields de la página
window.mathVirtualKeyboard.show = () => {}  // No-op
```

### mathVirtualKeyboardPolicy — valores posibles

| Valor | Comportamiento |
|---|---|
| `'auto'` | Muestra teclado en touch, oculta en desktop |
| `'manual'` | Solo muestra si se llama explícitamente |
| `'off'` | Nunca muestra el teclado virtual |
| `'sandboxed'` | El campo maneja su propio teclado (sin compartir con otros) |

**Para Formalia: usar `'off'` siempre.**

```typescript
// En la inicialización del FormulaPanel
const mf = document.getElementById('formula-field') as MathfieldElement
mf.mathVirtualKeyboardPolicy = 'off'
```

### Suprimir el toggle button del teclado

MathLive puede mostrar un pequeño botón "teclado" dentro del campo. Para ocultarlo:

```css
/* Ocultar el toggle de teclado virtual */
math-field::part(virtual-keyboard-toggle) {
  display: none;
}
```

### mathVirtualKeyboard global

Si hay múltiples math-fields en la página y se quiere controlar el teclado desde
uno solo (p.ej., en una implementación custom):

```typescript
const keyboard = window.mathVirtualKeyboard
keyboard.show()
keyboard.hide()
keyboard.visible  // boolean
keyboard.layouts  // layouts disponibles
```

---

## 6. Menús y Contexto

### El menú contextual inline

MathLive muestra un menú inline cuando se selecciona contenido dentro del campo.
Por defecto incluye opciones como "Copiar como LaTeX", "Copiar como MathML", etc.

### Deshabilitar el menú contextual completamente

```typescript
// Propiedad en la instancia
mf.menuItems = []  // Array vacío = sin menú

// O configurar con pocas opciones
mf.menuItems = [
  { label: 'Copiar LaTeX', onMenuSelect: () => navigator.clipboard.writeText(mf.value) },
]
```

### El menú emergente al escribir

Cuando el usuario escribe ciertos comandos (p.ej., `\sqrt`), MathLive puede
mostrar sugerencias de autocompletado. Para deshabilitar:

```typescript
// No hay una propiedad directa "disable autocomplete" en versiones recientes
// Se puede sobreescribir el comportamiento con:
mf.inlineShortcuts = {}  // Vaciar shortcuts inline
```

### contextMenuItems vs menuItems

En versiones recientes de MathLive (0.97+):

```typescript
// menuItems — menú que aparece al seleccionar
mf.menuItems = []

// No confundir con el menú de clic derecho del OS —
// ese es el contextmenu nativo del navegador y se maneja con:
mf.addEventListener('contextmenu', (e) => {
  e.preventDefault()  // Suprimir menú nativo también si se desea
})
```

---

## 7. Control Programático

### executeCommand — insertar comandos LaTeX

```typescript
// Insertar un snippet LaTeX en la posición del cursor
mf.executeCommand(['insert', '\\frac{#@}{#?}'])
// #@ = contenido actualmente seleccionado
// #? = placeholder para el usuario

// Comandos de movimiento del cursor
mf.executeCommand('moveToMathfieldEnd')
mf.executeCommand('moveToMathfieldStart')
mf.executeCommand('selectAll')

// Comandos de edición
mf.executeCommand('deleteBackward')
mf.executeCommand('deleteForward')
mf.executeCommand(['applyStyle', { fontWeight: 'bold' }])
```

### insert() — insertar LaTeX directamente

```typescript
// insert es el método principal para snippets
mf.insert('\\int_{#?}^{#?} #? \\,d#?', {
  insertionMode: 'insertAfter',  // Insertar después del cursor
  selectionMode: 'placeholder',  // Mover cursor al primer placeholder
})
```

### Opciones de insert()

```typescript
interface InsertOptions {
  insertionMode?: 'replaceAll' | 'replaceSelection' | 'insertBefore' | 'insertAfter'
  selectionMode?: 'placeholder' | 'after' | 'before' | 'item'
  placeholder?: string      // Texto de placeholder personalizado
  format?: string           // Formato del string insertado ('latex' por defecto)
  suppressChangeNotifications?: boolean
  feedback?: boolean        // Feedback visual/sonoro
  scrollIntoView?: boolean
  mode?: 'math' | 'text'
}
```

### Gestión del foco

```typescript
// Dar foco al campo
mf.focus()

// Verificar si tiene foco
document.activeElement === mf

// Foco con selección
mf.focus()
mf.executeCommand('selectAll')
```

### selection API

```typescript
// Obtener selección actual
const selection = mf.selection
// selection.ranges: Array de [start, end]
// selection.direction: 'forward' | 'backward' | 'none'

// Setear selección programáticamente
mf.selection = {
  ranges: [[0, -1]],  // Seleccionar todo
  direction: 'forward',
}

// position (cursor sin selección)
mf.position = 0  // Ir al principio
```

---

## 8. Keybindings Personalizados

### Reemplazar atajos de teclado

```typescript
// Sobreescribir comportamiento de Enter (p.ej., confirmar fórmula en lugar de newline)
mf.keybindings = [
  ...mf.keybindings,  // Mantener los existentes
  {
    key: 'Enter',
    command: ['performWithFeedback', 'commit'],  // No existe por defecto
    // O sobreescribir con una función custom
  },
]
```

**Nota**: La API de keybindings de MathLive es verbosa y algo opaca. La manera
más limpia es manejar teclado via el evento `'keystroke'`:

```typescript
mf.addEventListener('keystroke', (e: CustomEvent) => {
  const keystroke: string = e.detail.keystroke

  // Tab = confirmar e ir al siguiente placeholder
  if (keystroke === 'Tab') {
    e.preventDefault()
    // Lógica custom
    return
  }

  // Escape = cancelar edición
  if (keystroke === 'Escape') {
    e.preventDefault()
    editor.commands.cancelFormulaEdit()
    return
  }
})
```

### Inline shortcuts

Los inline shortcuts se activan cuando el usuario escribe ciertos strings.
Por ejemplo, escribir `pi` puede convertirse en `\pi`.

```typescript
// Deshabilitar todos los shortcuts inline (para mayor control)
mf.inlineShortcuts = {}

// O añadir shortcuts propios
mf.inlineShortcuts = {
  ...MathfieldElement.defaultInlineShortcuts,
  'RR': '\\mathbb{R}',
  'NN': '\\mathbb{N}',
  'ZZ': '\\mathbb{Z}',
  'QQ': '\\mathbb{Q}',
  'CC': '\\mathbb{C}',
}
```

---

## 9. Estilos y Theming

### CSS custom properties disponibles

```css
math-field {
  /* Colores */
  --primary-color: #0066cc;
  --text-color: #1a1a1a;
  --placeholder-color: #aaa;
  --contains-highlight-backgroundcolor: #e8f0fe;

  /* Fuentes */
  --smart-fence-color: #888;
  --latex-color: #555;

  /* Tamaño */
  font-size: 20px;  /* Controla el tamaño del math directamente */

  /* Bordes y background del campo */
  --hue: 212;
  background: var(--surface-color, white);
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
}
```

### Partes del Shadow DOM accesibles via ::part()

```css
math-field::part(container) { /* Contenedor principal */ }
math-field::part(content) { /* El área editable */ }
math-field::part(virtual-keyboard-toggle) { display: none; } /* Ocultar toggle KB */
math-field::part(menu-toggle) { display: none; }
```

### Modo oscuro

```css
@media (prefers-color-scheme: dark) {
  math-field {
    --text-color: #e0e0e0;
    background: #2a2a2a;
    border-color: #555;
  }
}
```

### Ajustar tamaño dinámicamente

```typescript
// MathLive usa 'font-size' del elemento padre para escalar
// El math-field NO tiene un ancho/alto fijo por contenido por defecto
mf.style.fontSize = '22px'
mf.style.width = '100%'
mf.style.minHeight = '48px'
```

---

## 10. Integración Vanilla TypeScript (sin framework)

### Patrón de inicialización

```typescript
import 'mathlive'  // Registra <math-field>

class FormulaPanel {
  private mf: MathfieldElement
  private syncSrc: null | 'text' | 'mathlive' = null

  init(container: HTMLElement) {
    this.mf = document.createElement('math-field') as MathfieldElement
    this.mf.id = 'formula-field'
    this.mf.mathVirtualKeyboardPolicy = 'off'
    this.mf.menuItems = []
    this.mf.style.width = '100%'
    this.mf.style.fontSize = '20px'

    container.appendChild(this.mf)

    this.mf.addEventListener('input', this.onMathfieldInput)
    this.mf.addEventListener('keystroke', this.onMathfieldKeystroke)
  }

  private onMathfieldInput = () => {
    if (this.syncSrc === 'text') return  // El input viene del textarea, ignorar
    this.syncSrc = 'mathlive'
    const mathJson = this.mf.getValue('math-json')
    EditorStore.processFormula(mathJson, 'math-json')
    requestAnimationFrame(() => { this.syncSrc = null })
  }

  setValueFromLatex(latex: string) {
    if (this.syncSrc === 'mathlive') return  // Ya estamos procesando, no ciclar
    this.syncSrc = 'text'
    this.mf.setValue(latex, { suppressChangeNotifications: true })
    requestAnimationFrame(() => { this.syncSrc = null })
  }

  destroy() {
    this.mf.removeEventListener('input', this.onMathfieldInput)
    this.mf.removeEventListener('keystroke', this.onMathfieldKeystroke)
  }
}
```

### Esperar a que el elemento esté listo

MathLive registra `<math-field>` de forma asíncrona. Si se intenta usar antes
de que el customElement esté definido:

```typescript
// Esperar la definición del elemento
await customElements.whenDefined('math-field')
const mf = document.getElementById('formula') as MathfieldElement
mf.setValue('x^2')
```

O con el import asíncrono:

```typescript
const { MathfieldElement } = await import('mathlive')
```

---

## 11. Sincronización Bidireccional con Textarea

### El problema de los feedback loops

Si A escucha a B y B escucha a A, cualquier cambio crea un ciclo infinito.
Con MathLive ↔ textarea esto es muy real: setValue dispara 'input', que actualiza
el textarea, que podría disparar otro setValue.

### La solución: syncSrc con tres estados y requestAnimationFrame

```typescript
type SyncSource = null | 'text' | 'mathlive'
let syncSrc: SyncSource = null

// Cuando el usuario escribe en el textarea
textarea.addEventListener('input', () => {
  if (syncSrc === 'mathlive') return  // El cambio viene de MathLive, ignorar

  syncSrc = 'text'
  mf.setValue(textarea.value, { suppressChangeNotifications: true })
  // suppressChangeNotifications evita que setValue dispare 'input'
  requestAnimationFrame(() => { syncSrc = null })
})

// Cuando el usuario edita en math-field
mf.addEventListener('input', () => {
  if (syncSrc === 'text') return  // El cambio viene del textarea, ignorar

  syncSrc = 'mathlive'
  textarea.value = mf.getValue('latex')
  requestAnimationFrame(() => { syncSrc = null })
})
```

**Por qué tres estados y no un boolean:**
- Un boolean lock `isSync = true/false` falla porque `mf.selection = ...` puede
  disparar `'selection-change'` **síncronamente** antes de que el lock se libere.
- El `requestAnimationFrame` garantiza que el lock se libera en el siguiente frame,
  después de que todos los eventos síncronos se hayan procesado.
- El tercer estado permite identificar cuál de los dos campos inició el cambio y
  suprimir solo el eco, no toda sincronización futura.

---

## 12. El Truco del math-field Oculto

### Para parsear LaTeX → MathJSON en el pipeline

```typescript
class MathLiveParser {
  private static _hidden: MathfieldElement | null = null

  private static get hidden(): MathfieldElement {
    if (!this._hidden) {
      this._hidden = new MathfieldElement()
      this._hidden.setAttribute('style',
        'visibility:hidden;position:absolute;pointer-events:none;'
      )
      this._hidden.mathVirtualKeyboardPolicy = 'off'
      this._hidden.menuItems = []
      document.body.appendChild(this._hidden)
    }
    return this._hidden
  }

  static parseLatex(latex: string): object {
    const mf = this.hidden
    mf.setValue(latex, { suppressChangeNotifications: true })
    const json = mf.getValue('math-json')
    return typeof json === 'string' ? JSON.parse(json) : json
  }

  static latexToNormalizedLatex(latex: string): string {
    const mf = this.hidden
    mf.setValue(latex, { suppressChangeNotifications: true })
    return mf.getValue('latex')  // LaTeX normalizado por MathLive
  }
}
```

**Caveats importantes:**
1. El elemento oculto **debe estar en el DOM** para funcionar correctamente.
2. No usar `display: none` — usar `visibility: hidden` + `position: absolute`.
3. Las operaciones son **síncronas** — no hay que await nada.
4. Un único elemento oculto es suficiente (singleton) — crear múltiples es costoso.
5. Si MathLive no reconoce un macro, lo deja como `\unknownCommand` en el output.

---

## 13. Performance

### ¿Cuánto pesa MathLive?

- Bundle completo (con fuentes): ~500KB minificado, ~150KB gzippeado
- El código JS solo (sin fuentes): ~300KB minificado
- Fuentes matemáticas (woff2): ~300KB adicionales

### Lazy loading

```typescript
// Solo cargar MathLive cuando el usuario necesita editar una fórmula
async function openFormulaEditor(latex: string) {
  const { MathfieldElement } = await import('mathlive')
  // La primera carga tarda, las siguientes son del caché
  const mf = new MathfieldElement()
  mf.value = latex
  document.getElementById('formula-panel')!.appendChild(mf)
}
```

### Múltiples instancias

Para Formalia, la arquitectura correcta es **una sola instancia** de `<math-field>`
que se reutiliza para editar cualquier fórmula del documento. Crear una instancia
por cada fórmula del documento es un error de performance grave.

```typescript
// ✅ UN solo math-field global en el toolbar
const globalMF = document.getElementById('formula-field') as MathfieldElement

// Cuando el usuario selecciona una fórmula en el documento:
onFormulaSelected(latex: string) {
  globalMF.setValue(latex, { suppressChangeNotifications: true })
  globalMF.focus()
}

// ❌ NO crear una instancia por fórmula en el documento
document.querySelectorAll('[data-math]').forEach(el => {
  const mf = new MathfieldElement()  // NUNCA — demasiado costoso
  el.appendChild(mf)
})
```

### Inicialización diferida

```typescript
// Importar el módulo pero no crear el elemento hasta que se necesite
import type { MathfieldElement } from 'mathlive'

let mfModule: typeof import('mathlive') | null = null

async function ensureMathLiveLoaded() {
  if (!mfModule) {
    mfModule = await import('mathlive')
  }
  return mfModule
}
```

---

## 14. Ciclo de Vida

### connectedCallback y disponibilidad

MathLive ejecuta la inicialización real del editor en `connectedCallback` (cuando
el elemento se añade al DOM). Antes de ese momento, `mf.value` puede estar vacío
o no funcionar correctamente.

```typescript
// Patrón seguro de inicialización
const mf = new MathfieldElement()
document.body.appendChild(mf)  // connectedCallback se ejecuta aquí

// Inmediatamente después del append ya es seguro usar el elemento,
// pero para mayor seguridad usar:
requestAnimationFrame(() => {
  mf.setValue('x^2')  // Seguro
})
```

### Timing con Vite / import dinámico

```typescript
// En Vite, el import de 'mathlive' define el custom element de forma asíncrona
// Si se crea el HTML antes del import, el elemento puede no estar inicializado

// Seguro:
await import('mathlive')
const mf = document.getElementById('formula-field') as MathfieldElement
mf.setValue('x^2')  // Ahora sí

// Alternativamente:
customElements.whenDefined('math-field').then(() => {
  const mf = document.getElementById('formula-field') as MathfieldElement
  mf.setValue('x^2')
})
```

---

## 15. Trampas y Problemas Conocidos

### 1. setValue no dispara 'input' por defecto — FALSO

En versiones recientes, `setValue()` **sí dispara** `'input'` a menos que
se use `suppressChangeNotifications: true`. Este es el origen de muchos
feedback loops en integraciones.

```typescript
// ✅ Siempre usar suppressChangeNotifications al setear desde código
mf.setValue(latex, { suppressChangeNotifications: true })
```

### 2. mf.value vs mf.getValue('latex') — diferencias sutiles

```typescript
mf.value          // Propiedad: LaTeX con convenciones de MathLive
mf.getValue('latex')  // Método: misma salida pero puede diferir sutilmente
// En la práctica son equivalentes, pero getValue() es más explícito
```

### 3. El teclado virtual aparece inesperadamente en mobile

Aunque `mathVirtualKeyboardPolicy = 'off'` está configurado, algunos navegadores
móviles pueden mostrar el teclado del sistema (no el de MathLive). Para suprimir
también ese:

```typescript
mf.readOnly = true  // Solo lectura — no aparece teclado del sistema
// Pero esto bloquea la edición, así que no sirve para el FormulaPanel
```

La solución real es gestionar foco cuidadosamente en mobile.

### 4. Shadow DOM y eventos

Los eventos de MathLive **sí propaguen** al DOM padre (tienen `composed: true`).
Sin embargo, `event.target` siempre apunta a `<math-field>`, no al elemento interno.

```typescript
document.addEventListener('input', (e) => {
  if (e.target instanceof MathfieldElement) {
    // Este evento viene de math-field, no de otro input
  }
})
```

### 5. Las fuentes matemáticas tardan en cargar

La primera vez que se monta `<math-field>`, las fuentes TeX se cargan asíncronamente.
Hasta que cargan, las fórmulas pueden verse con fuentes del sistema.

```typescript
// Pre-cargar fuentes al inicio de la app
import 'mathlive/fonts'  // Si existe en la versión instalada
// O simplemente aceptar el FOUT y confiar en el caché del navegador
```

### 6. macros y comandos desconocidos

Si el LaTeX contiene macros no estándar (`\R`, `\N`, etc.), MathLive los muestra
como texto rojo o los ignora. Para registrar macros:

```typescript
mf.macros = {
  ...MathfieldElement.defaultMacros,
  R: '\\mathbb{R}',
  N: '\\mathbb{N}',
  Z: '\\mathbb{Z}',
  Q: '\\mathbb{Q}',
  C: '\\mathbb{C}',
  d: '\\mathrm{d}',
}
```

### 7. Versiones: cambios breaking relevantes

| Versión | Cambio notable |
|---|---|
| ~0.90 | Renombrado de `MathField` a `MathfieldElement` |
| ~0.95 | `mathVirtualKeyboardPolicy` reemplazó `virtualKeyboardMode` |
| ~0.97 | `menuItems` API introducida; `smartMode` deprecado en algunos contextos |
| ~0.98 | Cambios en el formato de MathJSON output |
| ~0.100 | Cambios en la API del teclado virtual global |

**Verificar siempre el CHANGELOG de MathLive antes de actualizar.**

---

## 16. Diferencias entre paquetes

### `mathlive` vs otros imports

```typescript
// Paquete principal — recomendado
import 'mathlive'
import { MathfieldElement } from 'mathlive'

// Import solo del elemento (sin el parser/engine completo)
// En versiones recientes ya no existe esta separación — todo está en 'mathlive'

// Types solo (para TypeScript, sin side effects)
import type { MathfieldElement } from 'mathlive'
```

### Tipos TypeScript

MathLive incluye sus propios tipos en el paquete. No se necesita `@types/mathlive`.

```typescript
import type {
  MathfieldElement,
  InsertOptions,
  Selector,
  MathfieldOptions,
  Keybinding,
} from 'mathlive'
```

---

## 17. Inserción de Snippets / Templates

### Patrones de inserción para botones del toolbar

```typescript
class SnippetButton {
  constructor(
    public label: string,
    public latex: string,
    public description: string,
  ) {}

  insert(mf: MathfieldElement): void {
    mf.insert(this.latex, {
      insertionMode: 'replaceSelection',  // Envuelve lo seleccionado si hay selección
      selectionMode: 'placeholder',       // Cursor va al primer #?
      feedback: true,                     // Feedback visual
    })
    mf.focus()
  }
}

// Snippets predefinidos
const SNIPPETS = [
  new SnippetButton('Fracción',    '\\frac{#@}{#?}',              'a/b'),
  new SnippetButton('Raíz',        '\\sqrt{#@}',                   '√'),
  new SnippetButton('Integral',    '\\int_{#?}^{#?} #? \\,d#?',   '∫'),
  new SnippetButton('Sumatorio',   '\\sum_{#?}^{#?} #?',          'Σ'),
  new SnippetButton('Límite',      '\\lim_{#? \\to #?} #?',       'lim'),
  new SnippetButton('Derivada',    '\\frac{d}{d#?} #?',           "f'"),
  new SnippetButton('Matriz 2x2',  '\\begin{pmatrix} #? & #? \\\\ #? & #? \\end{pmatrix}', 'M'),
  new SnippetButton('Superíndice', '#@^{#?}',                     'xⁿ'),
  new SnippetButton('Subíndice',   '#@_{#?}',                     'xₙ'),
]
```

### Placeholders en MathLive

| Símbolo | Significado |
|---|---|
| `#?` | Placeholder navegable (el cursor se posiciona aquí) |
| `#@` | El contenido actualmente seleccionado (si hay) |
| `#0`..`#9` | Placeholders numerados (orden de navegación) |

### Insertar en ambos modos (LaTeX input y MathLive)

Para Formalia, los botones de snippets deben funcionar tanto cuando el usuario
está editando en el textarea LaTeX como cuando está en el math-field:

```typescript
class SnippetService {
  static insert(latex: string, mf: MathfieldElement, textarea: HTMLTextAreaElement, activeMode: 'latex' | 'mathlive') {
    if (activeMode === 'mathlive') {
      mf.insert(latex, { selectionMode: 'placeholder', feedback: true })
      mf.focus()
    } else {
      // Insertar en el textarea en la posición del cursor
      const pos = textarea.selectionStart
      const before = textarea.value.slice(0, pos)
      const after = textarea.value.slice(textarea.selectionEnd)
      const cleanLatex = latex.replace(/#@/g, textarea.value.slice(pos, textarea.selectionEnd))
                               .replace(/#\?/g, '')  // Remover placeholders
      textarea.value = before + cleanLatex + after
      textarea.dispatchEvent(new Event('input'))
    }
  }
}
```

---

## 18. Resumen de Propiedades Clave

```typescript
const mf = document.querySelector('math-field') as MathfieldElement

// === LECTURA / ESCRITURA ===
mf.value                     // LaTeX del contenido actual
mf.getValue('math-json')     // MathJSON
mf.setValue(latex, opts)     // Setear valor programáticamente

// === TECLADO VIRTUAL ===
mf.mathVirtualKeyboardPolicy = 'off'  // Deshabilitar completamente

// === MENÚ ===
mf.menuItems = []             // Deshabilitar menú

// === COMPORTAMIENTO ===
mf.inlineShortcuts = { ...MathfieldElement.defaultInlineShortcuts, 'RR': '\\mathbb{R}' }
mf.macros = { ...MathfieldElement.defaultMacros, 'R': '\\mathbb{R}' }
mf.keybindings = [...]

// === ACCESIBILIDAD ===
mf.readOnly = false           // true para solo lectura
mf.disabled = false

// === FOCUS ===
mf.focus()
mf.blur()

// === INSERCIÓN ===
mf.insert('\\frac{#@}{#?}', { selectionMode: 'placeholder' })
mf.executeCommand('deleteBackward')

// === SELECCIÓN ===
mf.selection                 // Objeto de selección actual
mf.position                  // Posición del cursor (número)
```

---

## Resumen Ejecutivo para Formalia

| Aspecto | Decisión | Razón |
|---|---|---|
| Ubicación del `<math-field>` | Toolbar externo al editor | Evitar conflictos Shadow DOM / ProseMirror |
| Teclado virtual | `mathVirtualKeyboardPolicy = 'off'` | Usaremos nuestros propios botones |
| Menú contextual | `menuItems = []` | UI propia de Formalia |
| Obtener valor | `getValue('math-json')` para AST, `value` para LaTeX | MathJSON para pipeline, LaTeX para storage |
| Sincronización | syncSrc 3 estados + rAF | Evitar feedback loops |
| Parsear LaTeX externo | math-field oculto singleton | Convertir textarea → MathJSON para el pipeline |
| Instancias | 1 global en toolbar | Performance |
| Snippets | `mf.insert(latex, { selectionMode: 'placeholder' })` | Experiencia de usuario fluida |
| Macros custom | Registrar en `mf.macros` | `\R`, `\N`, etc. visibles correctamente |

# TipTap v2 — Investigación Profunda

> Documento de referencia técnica para la integración de TipTap v2 en Formalia.
> Cubre arquitectura, patrones, trampas y buenas prácticas específicas para
> un entorno con NodeViews vanilla TS, KaTeX, y estado gestionado por señales.

---

## 1. Arquitectura Central

### TipTap como wrapper de ProseMirror

TipTap v2 es una capa de abstracción sobre ProseMirror. No esconde ProseMirror —
lo expone limpiamente a través de una API más ergonómica.

```
TipTap
  ├── Editor          instancia raíz
  │     ├── EditorState    (estado ProseMirror — inmutable)
  │     ├── EditorView     (DOM + event handling de ProseMirror)
  │     └── Schema         (construido desde las extensions)
  ├── Extensions      sistema modular (Nodes, Marks, Behaviors)
  └── Commands API    capa sobre transactions
```

**La instancia `Editor`:**

```typescript
import { Editor } from '@tiptap/core'

const editor = new Editor({
  element: document.getElementById('editor'),
  extensions: [StarterKit, MathInline, MathDisplay],
  content: '<p>Hola mundo</p>',
  onCreate: ({ editor }) => { /* montado */ },
  onUpdate: ({ editor }) => { /* contenido cambió */ },
  onSelectionUpdate: ({ editor }) => { /* selección cambió */ },
  onDestroy: () => { /* destruido */ },
})
```

**Acceso a capa ProseMirror:**

```typescript
editor.view          // EditorView (ProseMirror)
editor.state         // EditorState (inmutable)
editor.schema        // Schema construido desde extensions
editor.state.doc     // Árbol del documento (Node)
editor.state.selection // Selección actual
```

### Schema

El Schema se construye automáticamente a partir de las extensions registradas.
No se define manualmente — se define _declarativamente_ en cada extension.

```typescript
editor.schema.nodes  // Record<string, NodeType>
editor.schema.marks  // Record<string, MarkType>
```

### Transacciones

El estado ProseMirror es **inmutable**. Toda modificación pasa por una transacción:

```typescript
const tr = editor.state.tr
tr.insertText('hola', 5)
tr.setNodeMarkup(10, null, { latex: 'x^2' })
editor.view.dispatch(tr)
```

---

## 2. Custom Nodes

### Node.create()

```typescript
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core'

const MathInline = TiptapNode.create({
  name: 'mathInline',
  group: 'inline',   // Dónde puede aparecer este nodo
  inline: true,      // Es inline (como texto)
  atom: true,        // No tiene contenido editable interno
  draggable: false,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: element => element.getAttribute('data-latex') ?? '',
        renderHTML: attrs => ({ 'data-latex': attrs.latex }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="math-inline"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-type': 'math-inline' }, HTMLAttributes)]
  },

  addNodeView() {
    return ({ node, view, getPos }) =>
      new MathInlineView(node, view, getPos as () => number)
  },
})
```

### parseHTML vs renderHTML

- **parseHTML**: deserialización — se usa al pegar HTML o cargar contenido.
- **renderHTML**: serialización — se usa en `editor.getHTML()` y clipboard.
- **Ambos son independientes del NodeView** — el NodeView controla el render visual.

### addAttributes() en detalle

```typescript
addAttributes() {
  return {
    // Atributo simple con default
    latex: { default: '' },

    // Con parseHTML y renderHTML propios
    displayMode: {
      default: false,
      parseHTML: el => el.hasAttribute('data-display'),
      renderHTML: attrs => attrs.displayMode ? { 'data-display': '' } : {},
    },

    // ID único (generado si no existe)
    id: {
      default: () => `math-${Math.random().toString(36).slice(2, 8)}`,
    },
  }
}
```

**Trampas en atributos:**
- Atributos no declarados en `addAttributes()` son silenciosamente eliminados por ProseMirror.
- El `default` se usa cuando el nodo se crea sin ese atributo. Si es una función, se evalúa en cada creación.
- Al usar `editor.getJSON()` todos los atributos declarados están presentes.

---

## 3. NodeViews

### Por qué NodeViews vanilla TypeScript

Para Formalia, los NodeViews **deben** ser vanilla TypeScript, nunca componentes Lit:

- ProseMirror gestiona directamente el DOM del editor.
- Los componentes Lit usan Shadow DOM por defecto.
- Shadow DOM dentro del DOM de ProseMirror causa conflictos de eventos (especialmente teclado y selección).

### Interfaz completa de NodeView

```typescript
import { NodeView } from 'prosemirror-view'
import type { Node, EditorView, Decoration } from 'prosemirror-view'

class MathDisplayView implements NodeView {
  dom: HTMLElement
  // contentDOM solo si el nodo tiene contenido editable
  // contentDOM?: HTMLElement

  constructor(
    private node: Node,
    private view: EditorView,
    private getPos: () => number | undefined,
  ) {
    this.dom = document.createElement('div')
    this.dom.className = 'math-display'
    this.dom.contentEditable = 'false'  // CRÍTICO para nodos atom

    this.dom.addEventListener('click', this.onClick)
    this.render()
  }

  // Llamado cuando el nodo cambia (attrs o contenido)
  // Retorna true si el NodeView manejó el update, false para re-crear
  update(node: Node, _decorations: Decoration[]): boolean {
    if (node.type.name !== 'mathDisplay') return false
    if (node.attrs.latex === this.node.attrs.latex) return true
    this.node = node
    this.render()
    return true
  }

  // Llamado cuando el nodo es seleccionado (NodeSelection)
  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode')
  }

  // Llamado cuando el nodo es deseleccionado
  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode')
  }

  // Llamado cuando el NodeView es destruido
  destroy() {
    this.dom.removeEventListener('click', this.onClick)
  }

  // ---- Privado ----

  private render() {
    try {
      katex.render(this.node.attrs.latex, this.dom, {
        throwOnError: false,
        displayMode: true,
      })
    } catch (e) {
      this.dom.textContent = `[Error: ${this.node.attrs.latex}]`
    }
  }

  private onClick = (e: MouseEvent) => {
    e.preventDefault()
    const pos = this.getPos()
    if (pos === undefined) return
    const tr = this.view.state.tr
    tr.setSelection(NodeSelection.create(this.view.state.doc, pos))
    this.view.dispatch(tr)
  }
}
```

### Registro del NodeView en la extension

```typescript
addNodeView() {
  // Opción 1: clase
  return MathDisplayView

  // Opción 2: factory function (más control)
  return ({ node, view, getPos, decorations }) =>
    new MathDisplayView(node, view, getPos as () => number)
}
```

### contentDOM — cuándo usarlo

Solo para nodos que **contienen contenido editable**:

```typescript
class TheoremEnvView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement  // ProseMirror gestiona este

  constructor(node, view, getPos) {
    this.dom = document.createElement('div')
    this.dom.className = 'theorem-env'

    const label = document.createElement('div')
    label.className = 'theorem-label'
    label.textContent = node.attrs.envType

    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'theorem-content'

    this.dom.appendChild(label)
    this.dom.appendChild(this.contentDOM)
    // ProseMirror llenará contentDOM con el contenido del nodo
  }
}
```

**NUNCA** escribir directamente en `contentDOM.innerHTML` — ProseMirror lo gestiona.

### Trampas críticas de NodeViews

1. **`update()` retornando `false`**: ProseMirror destruye y re-crea el NodeView completo. Es costoso. Solo retornar `false` si el tipo de nodo cambió.

2. **`getPos()` puede retornar `undefined`**: Verificar siempre antes de usarlo:
   ```typescript
   const pos = this.getPos()
   if (pos === undefined) return  // Nodo fue eliminado
   ```

3. **`selectNode`/`deselectNode` no son automáticos**: Se debe implementar explícitamente el feedback visual.

4. **Memory leaks**: Siempre limpiar event listeners y observers en `destroy()`.

5. **No usar `document.createElement` fuera del constructor**: Puede causar referencias obsoletas.

---

## 4. Sistema de Extensions

### Tres tipos de extension

```typescript
import { Node, Mark, Extension } from '@tiptap/core'

Node.create({ name: 'mathInline', group: 'inline', atom: true, ... })
Mark.create({ name: 'bold', ... })
Extension.create({ name: 'history', ... })  // Sin representación DOM
```

### addCommands()

```typescript
addCommands() {
  return {
    // Comando simple — retorna boolean (éxito/fallo)
    insertMathInline: (latex: string) => ({ commands }) => {
      return commands.insertContent({
        type: this.name,
        attrs: { latex },
      })
    },

    // Comando de bajo nivel — transacción directa
    setFormulaAtPos: (pos: number, latex: string) => ({ state, dispatch }) => {
      const node = state.doc.nodeAt(pos)
      if (!node) return false
      const tr = state.tr.setNodeMarkup(pos, null, { ...node.attrs, latex })
      dispatch?.(tr)
      return true
    },
  }
}
```

### addKeyboardShortcuts()

```typescript
addKeyboardShortcuts() {
  return {
    // Mod = Ctrl en Windows/Linux, Cmd en Mac
    'Mod-Alt-i': () => this.editor.commands.insertMathInline(''),
    'Mod-Alt-d': () => this.editor.commands.insertMathDisplay(''),

    // Override de tecla existente con lógica condicional
    'Backspace': ({ editor }) => {
      const { $from } = editor.state.selection
      if ($from.parent.type.name === 'mathInline') {
        // Lógica especial para borrar dentro de un nodo math
        return true  // Manejado, no propagar
      }
      return false  // Dejar comportamiento por defecto
    },
  }
}
```

### addInputRules() — disparadores de escritura

```typescript
import { InputRule } from '@tiptap/core'

addInputRules() {
  return [
    // "$$<texto>$$" → nodo mathDisplay
    new InputRule({
      find: /\$\$([^\$]*)\$\$$/,
      handler: ({ state, range, match }) => {
        const latex = match[1]
        const node = this.type.create({ latex })
        state.tr.replaceRangeWith(range.from, range.to, node)
      },
    }),
    // "$<texto>$" → nodo mathInline
    new InputRule({
      find: /\$([^\$]+)\$$/, 
      handler: ({ state, range, match }) => {
        const latex = match[1]
        const node = this.type.create({ latex })
        state.tr.replaceRangeWith(range.from, range.to, node)
      },
    }),
  ]
}
```

### addPasteRules()

```typescript
import { PasteRule } from '@tiptap/core'

addPasteRules() {
  return [
    new PasteRule({
      find: /\$([^\$]+)\$/g,
      handler: ({ match, range, state }) => {
        const latex = match[1]
        const node = this.type.create({ latex })
        state.tr.replaceRangeWith(range.from, range.to, node)
      },
    }),
  ]
}
```

### Sistema de prioridad

Las extensions se procesan en orden de registro. Para override de comportamiento:

```typescript
extensions: [
  StarterKit,
  // Esta paragraph override la del StarterKit
  Paragraph.configure({ HTMLAttributes: { class: 'p-custom' } }),
]
```

---

## 5. Transacciones y Commands

### `tr.setNodeMarkup()`

Cambia los atributos (y opcionalmente el tipo) de un nodo en una posición dada:

```typescript
tr.setNodeMarkup(
  pos: number,            // Posición del nodo en el documento
  type?: NodeType | null, // null = mantener tipo actual
  attrs?: Record<string, any>, // Nuevos atributos (merged con los actuales)
  marks?: Mark[]          // Marks del nodo (generalmente null)
)

// Ejemplo: actualizar el LaTeX de un nodo math
const tr = editor.state.tr
tr.setNodeMarkup(nodePos, null, { latex: 'x^2 + y^2' })
editor.view.dispatch(tr)
```

### `editor.commands` vs `editor.chain()`

```typescript
// commands — operación directa, retorna boolean
editor.commands.insertMathInline('x')   // Una transacción
editor.commands.insertMathInline('y')   // Otra transacción
// Resultado: dos entradas en el historial de undo

// chain — operaciones atómicas, retorna ChainAPI
editor.chain()
  .focus()
  .insertMathInline('x')
  .insertMathInline('y')
  .run()
// Resultado: una sola transacción, un solo undo
```

**Regla**: Usar `chain()` cuando múltiples comandos deben ser atómicos (una sola entrada de undo). Usar `commands` para operaciones independientes.

### Comandos personalizados con acceso a ProseMirror

```typescript
addCommands() {
  return {
    updateActiveFormula: (latex: string) => ({ editor, state, dispatch }) => {
      // Encontrar el nodo math seleccionado
      const { from } = state.selection
      const $from = state.doc.resolve(from)
      
      // Buscar en el nodo actual y sus ancestros
      let mathPos: number | null = null
      if (state.selection instanceof NodeSelection) {
        const node = state.doc.nodeAt(state.selection.from)
        if (node?.type.name === 'mathInline' || node?.type.name === 'mathDisplay') {
          mathPos = state.selection.from
        }
      }
      
      if (mathPos === null) return false
      
      const tr = state.tr.setNodeMarkup(mathPos, null, { latex })
      dispatch?.(tr)
      return true
    },
  }
}
```

---

## 6. Sistema de Eventos

### Todos los eventos del Editor

```typescript
const editor = new Editor({
  onCreate: ({ editor }) => {
    // Editor montado y listo. Usar para inicialización post-mount.
  },

  onUpdate: ({ editor, transaction }) => {
    // Contenido del documento cambió.
    // transaction.docChanged === true aquí siempre.
    saveToLocalStorage(editor.getJSON())
  },

  onSelectionUpdate: ({ editor, transaction }) => {
    // La selección cambió (puede o no haber cambio de contenido).
    const node = editor.state.selection.$from.parent
    if (node.type.name === 'mathInline') {
      // Sincronizar FormulaPanel con el nodo seleccionado
      activeFormulaSignal.value = node.attrs.latex
    }
  },

  onTransaction: ({ editor, transaction }) => {
    // TODA transacción — incluyendo las que no cambian el documento.
    // Útil para detectar cambios de selección Y de contenido en un solo handler.
    // transaction.docChanged — contenido cambió
    // transaction.selectionSet — selección cambió
  },

  onFocus: ({ editor, event }) => {
    // El editor ganó el foco.
  },

  onBlur: ({ editor, event }) => {
    // El editor perdió el foco.
    // Atención: esto también se dispara al hacer click en el FormulaPanel externo.
  },

  onDestroy: () => {
    // Editor destruido. Limpiar subscripciones, signals, etc.
  },
})
```

### Patrón para sincronizar FormulaPanel externo

```typescript
onSelectionUpdate: ({ editor }) => {
  const { selection } = editor.state
  
  if (selection instanceof NodeSelection) {
    const node = selection.node
    if (node.type.name === 'mathInline' || node.type.name === 'mathDisplay') {
      // Activar fórmula en el panel externo
      EditorStore.setActiveFormula(node.attrs.latex)
      return
    }
  }
  
  // No hay fórmula seleccionada
  EditorStore.clearActiveFormula()
},
```

---

## 7. Decoraciones

Las decoraciones son overlays visuales **efímeros** que no modifican el documento.
Son reconstruidas en cada transacción relevante.

### Tipos de decoración

```typescript
import { Decoration, DecorationSet } from 'prosemirror-view'

// Widget: inserta un DOM element en una posición sin afectar contenido
Decoration.widget(pos, () => {
  const el = document.createElement('span')
  el.className = 'cursor-indicator'
  return el
}, { side: -1 })  // side: -1 = antes del carácter

// Inline: aplica atributos a un rango de texto
Decoration.inline(from, to, { class: 'math-highlight' })

// Node: aplica atributos a un nodo completo
Decoration.node(from, to, { class: 'math-selected' })
```

### Plugin de decoraciones (via extension)

```typescript
addProseMirrorPlugins() {
  return [
    new Plugin({
      key: new PluginKey('mathDecorations'),
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, set) => {
          const decorations: Decoration[] = []
          tr.doc.descendants((node, pos) => {
            if (node.type.name === 'mathInline' && node.attrs.hasError) {
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, { class: 'math-error' })
              )
            }
          })
          return DecorationSet.create(tr.doc, decorations)
        },
      },
      props: {
        decorations(state) { return this.getState(state) },
      },
    })
  ]
}
```

**NodeViews > Decorations** para renderizar fórmulas: los NodeViews tienen acceso a `selectNode/deselectNode`, son más fáciles de gestionar y tienen un ciclo de vida explícito.

---

## 8. Input Rules y Paste Rules

### textblockTypeInputRule

Para convertir texto en nodos de bloque tipados:

```typescript
import { textblockTypeInputRule } from '@tiptap/core'

// "# " → Heading nivel 1, "## " → nivel 2, etc.
textblockTypeInputRule({
  find: /^(#{1,6})\s$/,
  type: this.type,
  getAttributes: match => ({ level: match[1].length }),
})
```

### wrappingInputRule

Para envolver contenido en un nodo contenedor:

```typescript
import { wrappingInputRule } from '@tiptap/core'

// "> " → Blockquote
wrappingInputRule({
  find: /^\s*>\s$/,
  type: this.type,
})
```

### InputRule personalizado para matemáticas

```typescript
// "/thm" → TheoremEnv
new InputRule({
  find: /\/thm\s$/,
  handler: ({ state, range }) => {
    const node = state.schema.nodes.theoremEnv.create({ envType: 'theorem' })
    state.tr.replaceRangeWith(range.from, range.to, node)
  },
})
```

---

## 9. Shadow DOM y Conflictos con Web Components

### Por qué `<math-field>` NO puede vivir dentro del DOM de TipTap

ProseMirror captura eventos en su `contenteditable`. Los eventos dentro de Shadow DOM
tienen `event.composed = false` en algunos casos, y aunque propaguen, `event.target`
apunta al shadow host, no al elemento interno. Esto rompe:

1. La gestión de selección de ProseMirror (confunde qué está seleccionado)
2. Los atajos de teclado (el editor recibe teclas que deberían ir al math-field)
3. Los input rules (los caracteres escritos en math-field podrían activar reglas del editor)
4. El sistema de foco (ProseMirror pierde y recupera foco inesperadamente)

**Arquitectura correcta:**

```
┌── Toolbar (fuera del editor) ──────────────────────┐
│  <math-field id="formula-field">  ← Shadow DOM OK  │
│  [botones de snippets]                              │
└────────────────────────────────────────────────────┘
┌── Editor Container ────────────────────────────────┐
│  <div class="tiptap ProseMirror" contenteditable>  │
│    <span data-type="math-inline">                  │  ← NodeView vanilla TS
│      <span class="katex">...</span>                │  ← KaTeX render directo
│    </span>                                         │
│  </div>                                            │
└────────────────────────────────────────────────────┘
```

### NodeViews NO son componentes Lit

Aunque Formalia usa Lit para la UI del toolbar, los NodeViews dentro del editor
deben ser clases TypeScript puras que implementen la interfaz NodeView de ProseMirror.

```typescript
// ✅ CORRECTO
class MathInlineView implements NodeView {
  dom: HTMLElement
  constructor(node, view, getPos) {
    this.dom = document.createElement('span')
    katex.render(node.attrs.latex, this.dom, { throwOnError: false })
  }
}

// ❌ INCORRECTO — Shadow DOM dentro de ProseMirror DOM
@customElement('math-inline-view')
class MathInlineView extends LitElement {
  render() { return html`<katex-renderer>` }
}
```

---

## 10. History — Undo/Redo

### Configuración

```typescript
import { History } from '@tiptap/extension-history'

// Incluido en StarterKit — para desactivarlo:
StarterKit.configure({ history: false })

// O configurar directamente:
History.configure({
  depth: 100,          // Cuántos pasos guardar
  newGroupDelay: 500,  // ms entre grupos de undo
})
```

### Interacción con transacciones externas

Cuando EditorStore actualiza el documento desde signals externos (p.ej., al editar
en el FormulaPanel), la transacción se registra en el historial normalmente. Esto
es el comportamiento deseado: el usuario puede deshacer un cambio de fórmula.

Para operaciones que **no deben registrarse en el historial**:

```typescript
// Marcar una transacción como "no histórica"
const tr = editor.state.tr
tr.setMeta('addToHistory', false)
tr.setNodeMarkup(pos, null, { latex: newLatex })
editor.view.dispatch(tr)
```

### Atomicidad del historial

Las operaciones en cadena (`chain()`) producen una sola entrada de historial:

```typescript
// UNA entrada de undo para toda esta secuencia
editor.chain()
  .focus()
  .insertContent({ type: 'mathDisplay', attrs: { latex: 'E=mc^2' } })
  .run()
```

---

## 11. Performance

### Evitar re-renders innecesarios en NodeViews

```typescript
update(node: Node, _decorations: Decoration[]): boolean {
  if (node.type.name !== this.nodeName) return false

  // Solo re-renderizar si el LaTeX cambió
  if (node.attrs.latex === this.node.attrs.latex) {
    this.node = node
    return true  // "Manejado, sin cambio visual"
  }

  this.node = node
  this.renderKaTeX()
  return true
}
```

### Debounce en onUpdate

```typescript
const debouncedSave = debounce((json: object) => {
  localStorage.setItem('formalia-doc', JSON.stringify(json))
}, 1500)

onUpdate: ({ editor }) => {
  debouncedSave(editor.getJSON())
}
```

### chain() para operaciones en lote

```typescript
// ❌ Lento — 3 transacciones, 3 re-renders
editor.commands.op1()
editor.commands.op2()
editor.commands.op3()

// ✅ Rápido — 1 transacción, 1 re-render
editor.chain().op1().op2().op3().run()
```

### Documentos grandes

Para documentos muy grandes (>500 nodos), considerar:

- Paginación virtual (solo renderizar nodos visibles)
- Cargar el documento en chunks (lazy loading por sección)
- Diferir KaTeX renders fuera del viewport usando IntersectionObserver en los NodeViews

```typescript
class MathDisplayView implements NodeView {
  private observer: IntersectionObserver

  constructor(node, view, getPos) {
    this.dom = document.createElement('div')
    this.dom.textContent = node.attrs.latex  // Placeholder

    this.observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !this.rendered) {
        this.renderKaTeX()
        this.rendered = true
        this.observer.disconnect()
      }
    })
    this.observer.observe(this.dom)
  }

  destroy() {
    this.observer.disconnect()
  }
}
```

---

## 12. Anti-patterns y Trampas Conocidas

### 1. Modificar el estado directamente (sin transacción)

```typescript
// ❌ NUNCA — rompe el sistema inmutable de ProseMirror
editor.state.doc.content[0].attrs.latex = 'x=2'

// ✅ Siempre via transacción
editor.view.dispatch(
  editor.state.tr.setNodeMarkup(pos, null, { latex: 'x=2' })
)
```

### 2. getPos() sin verificar undefined

```typescript
// ❌ Crash si el nodo fue eliminado
tr.setNodeMarkup(this.getPos(), ...)

// ✅
const pos = this.getPos()
if (pos === undefined) return
tr.setNodeMarkup(pos, ...)
```

### 3. No implementar deselectNode()

```typescript
// ❌ El nodo queda visualmente "seleccionado" para siempre
selectNode() { this.dom.classList.add('selected') }
// falta deselectNode()

// ✅
selectNode()   { this.dom.classList.add('selected') }
deselectNode() { this.dom.classList.remove('selected') }
```

### 4. Memory leaks en NodeViews

```typescript
// ❌ Event listeners nunca se limpian
class MathView implements NodeView {
  constructor() {
    this.dom.addEventListener('click', this.onClick)
    this.resizeObserver = new ResizeObserver(...)
    this.resizeObserver.observe(this.dom)
  }
  // Sin destroy() — leak garantizado
}

// ✅
destroy() {
  this.dom.removeEventListener('click', this.onClick)
  this.resizeObserver.disconnect()
  this.intersectionObserver?.disconnect()
}
```

### 5. Registrar plugins duplicados

```typescript
// ❌ El plugin se registra dos veces
const editor = new Editor({
  extensions: [MyExtension],  // Ya registra el plugin
})
editor.registerPlugin(myPlugin)  // DUPLICADO

// ✅ Solo via extension
const MyExtension = Extension.create({
  addProseMirrorPlugins() {
    return [myPlugin]
  },
})
```

### 6. Usar editor antes de onCreate

```typescript
// ❌ El editor puede no estar montado aún
const editor = new Editor({ content: '...' })
console.log(editor.getHTML())  // Puede estar vacío

// ✅ Usar el callback onCreate
const editor = new Editor({
  content: '...',
  onCreate: ({ editor }) => {
    console.log(editor.getHTML())  // Seguro
  },
})
```

### 7. Confundir parseHTML con renderHTML

```typescript
// ERROR CONCEPTUAL: parseHTML no es para mostrar al usuario
// parseHTML = "cómo leo HTML que viene del exterior"
// renderHTML = "cómo serializo este nodo a HTML"
// addNodeView = "cómo muestro este nodo al usuario en el editor"
```

---

## 13. Buenas Prácticas

### 1. EditorStore como único punto de contacto

Los componentes externos (Lit, formulario) nunca importan `editor` directamente.
Solo acceden a `EditorStore`:

```typescript
// EditorStore.ts
import { signal } from '@preact/signals-core'
import type { Editor } from '@tiptap/core'

let _editor: Editor | null = null
export const activeLatex  = signal<string>('')
export const activeNodePos = signal<number | null>(null)

export function initEditor(editor: Editor) {
  _editor = editor
}

export function setActiveFormula(latex: string) {
  if (!_editor || activeNodePos.value === null) return
  _editor.view.dispatch(
    _editor.state.tr.setNodeMarkup(activeNodePos.value, null, { latex })
  )
}
```

### 2. Separar lógica de render

```typescript
// mathRenderer.ts — función pura, testeable
export function renderLatexToDOM(latex: string, container: HTMLElement, displayMode = false): void {
  katex.render(latex, container, {
    throwOnError: false,
    displayMode,
    output: 'html',
  })
}

// NodeView usa la función, no la reimplementa
class MathInlineView implements NodeView {
  private render() {
    renderLatexToDOM(this.node.attrs.latex, this.dom, false)
  }
}
```

### 3. Tipar las extensions

```typescript
interface MathInlineOptions {
  enableNormalization: boolean
}

interface MathInlineStorage {
  lastRenderedLatex: string
}

const MathInline = TiptapNode.create<MathInlineOptions, MathInlineStorage>({
  name: 'mathInline',

  addOptions() {
    return { enableNormalization: true }
  },

  addStorage() {
    return { lastRenderedLatex: '' }
  },

  // this.options.enableNormalization — tipado
  // this.storage.lastRenderedLatex — tipado
})
```

### 4. InputRules para flujo de escritura natural

```typescript
// El usuario escribe $\int_a^b f(x)\,dx$ y Enter para insertar
// O escribe $$ para abrir un bloque de display
// Estas reglas reducen la necesidad de menús
```

### 5. Validar fórmulas antes de insertar

```typescript
insertMathInline: (latex: string) => ({ commands }) => {
  // Validar con KaTeX antes de insertar al documento
  try {
    katex.renderToString(latex, { throwOnError: true })
  } catch {
    // Insertar igual pero marcar como error en attrs
    return commands.insertContent({
      type: 'mathInline',
      attrs: { latex, hasError: true },
    })
  }
  return commands.insertContent({
    type: 'mathInline',
    attrs: { latex, hasError: false },
  })
}
```

---

## 14. TypeScript — Soporte y Tipado

### Tipado de extensiones con genéricos

```typescript
// TOptions = opciones de configure()
// TStorage = storage local de la extension
TiptapNode.create<TOptions, TStorage>({ ... })
```

### Declarar comandos custom en el namespace global

Para que TypeScript reconozca `editor.commands.insertMathInline`:

```typescript
// types/tiptap.d.ts
import '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathInline: {
      insertMathInline: (latex: string) => ReturnType
      updateMathAtPos: (pos: number, latex: string) => ReturnType
    }
    mathDisplay: {
      insertMathDisplay: (latex: string) => ReturnType
    }
  }
}
```

Luego en la extension:

```typescript
addCommands() {
  return {
    insertMathInline: (latex: string) => ({ commands }) => {
      return commands.insertContent({ type: this.name, attrs: { latex } })
    },
  } as Record<string, any>  // Cast necesario internamente
}
```

### Tipos de ProseMirror desde TipTap

```typescript
// Importar tipos ProseMirror via TipTap (evita duplicar dependencias)
import type { Node } from '@tiptap/pm/model'
import type { EditorView, NodeView, Decoration } from '@tiptap/pm/view'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import type { NodeSelection } from '@tiptap/pm/state'
```

---

## 15. StarterKit

### Qué incluye StarterKit

| Extension | Descripción |
|---|---|
| Document | Nodo raíz (obligatorio) |
| Paragraph | Párrafo de texto |
| Text | Nodo de texto inline |
| Bold | Marca negrita |
| Italic | Marca cursiva |
| Strike | Marca tachado |
| Code | Marca código inline |
| Heading | Nodos h1–h6 |
| BulletList | Lista sin orden |
| OrderedList | Lista ordenada |
| ListItem | Ítem de lista |
| Blockquote | Cita en bloque |
| CodeBlock | Bloque de código |
| HardBreak | Salto de línea forzado |
| HorizontalRule | Separador |
| History | Undo/Redo |
| Dropcursor | Cursor de arrastre |
| Gapcursor | Cursor entre nodos atom |

### Configuración para Formalia

```typescript
StarterKit.configure({
  // Desactivar lo que no usamos
  codeBlock: false,       // Usaremos nuestros math blocks
  strike: false,

  // Configurar History
  history: {
    depth: 200,
    newGroupDelay: 500,
  },

  // Limitar headings
  heading: {
    levels: [1, 2, 3],
  },
})
```

### Gapcursor — especialmente importante para nodos atom

El `Gapcursor` es esencial cuando se tienen nodos `atom: true` (como los math nodes).
Sin él, el cursor no puede posicionarse antes o después del nodo con el teclado.

```typescript
// StarterKit incluye Gapcursor automáticamente.
// Si se usa una configuración custom sin StarterKit, añadirlo explícitamente:
import { Gapcursor } from '@tiptap/extension-gapcursor'

extensions: [
  Document, Paragraph, Text, History, Gapcursor,
  MathInline, MathDisplay,
]
```

---

## Resumen Ejecutivo para Formalia

| Decisión | Elección | Razón |
|---|---|---|
| NodeViews | Vanilla TypeScript | Evita conflictos Shadow DOM con ProseMirror |
| `<math-field>` | Fuera del editor DOM | Evita conflictos de eventos con ProseMirror |
| Señales | @preact/signals | Bridge entre Tiptap y componentes Lit externos |
| Commands | chain() para operaciones atómicas | Una entrada de historial por operación compleja |
| Render math | KaTeX síncrono | No bloquea, cubre 99% de matemáticas universitarias |
| Gapcursor | Incluido siempre | Navegación con teclado alrededor de nodos atom |
| TypeScript | Declarar commands en namespace | Autocompletado de editor.commands.insertMathInline |

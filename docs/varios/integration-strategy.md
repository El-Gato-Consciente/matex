# Estrategia de Integración: TipTap + KaTeX + MathLive

> Documento de estrategia para lograr una integración estable y robusta
> de TipTap (editor de texto), KaTeX (render de fórmulas) y MathLive
> (editor visual de fórmulas) en Formalia.
>
> Este documento responde a: ¿en qué orden construimos esto? ¿por qué ese orden?
> ¿qué riesgos hay en cada etapa? ¿cómo hacemos que los botones de snippets
> funcionen con ambos editores de fórmulas simultáneamente?

---

## 1. El Problema Central

Necesitamos que el usuario pueda editar fórmulas matemáticas de dos maneras:

1. **Modo código**: escribir LaTeX directamente en un textarea (Codex Mode)
2. **Modo visual**: usar MathLive `<math-field>` como editor WYSIWYG (Visual Mode)

Y además, tener **botones de snippets** (fracciones, integrales, etc.) que funcionen
de manera idéntica en ambos modos.

La complejidad no es ninguno de estos componentes en aislado — cada uno funciona
bien por sí solo. El desafío es la **sincronización bidireccional** entre los tres:

```
Textarea (LaTeX crudo)
    ↕  sincronización sin feedback loop
MathLive (visual, Shadow DOM)
    ↕  ambos reflejan la fórmula del nodo TipTap seleccionado
TipTap node (LaTeX canónico — fuente de verdad)
    ↕
KaTeX (render visual en el documento)
```

Y encima de esto, los botones de snippets que insertan en **cualquiera que esté activo**.

---

## 2. Por qué NO hacer todo de una vez

Construir la integración completa desde el primer día es una trampa. Los riesgos:

- **MathLive tiene subtilezas no obvias** en su ciclo de vida, su teclado virtual,
  y sus eventos. Descubrirlos mientras también se depura TipTap multiplica la
  complejidad de debugging.
- **El sistema de sincronización** (syncSrc + rAF) es delicado. Introducirlo
  junto con la integración TipTap crea una superficie de bugs enorme.
- **Los botones de snippets** necesitan saber qué editor está activo. Esta lógica
  es simple una vez que cada modo está estabilizado, pero es difícil de probar
  si ninguno de los dos funciona correctamente todavía.
- **Riesgo de deuda técnica**: una integración construida sobre fundamentos inestables
  acumula workarounds que son costosos de limpiar más tarde.

**El principio guía: estabilizar antes de complejizar.**

---

## 3. Las Tres Fases

```
FASE A — Demo 1: TipTap + KaTeX + LaTeX Input
  ↓  estabilizado, testeado, documentado
FASE B — Demo 2: MathLive en aislamiento
  ↓  estabilizado, sus sutilezas entendidas
FASE C — Integración completa: Demo 3 unifica A + B
```

Cada fase produce un artefacto usable y testeable de manera independiente.

---

## 4. Fase A — Demo 1: TipTap + KaTeX + LaTeX Input

### Objetivo

Editor de texto completo con soporte de fórmulas LaTeX editables vía textarea.
Sin MathLive. Sin modo visual. Solo: escribo LaTeX, lo veo renderizado con KaTeX.

### Lo que se construye

```
┌─────────────────────────────────────────┐
│  TOOLBAR                                │
│  [B] [I] [$] [$$] [↩] [↪]             │
│  ┌─────────────────────────────────────┐│
│  │ \frac{a}{b}   ← textarea LaTeX      ││  ← FormulaPanel simple
│  └─────────────────────────────────────┘│
│  [√] [∫] [Σ] [lim] ← botones snippets  │
├─────────────────────────────────────────┤
│  Documento (TipTap canvas)              │
│  El texto con fórmulas $\frac{a}{b}$   │  ← KaTeX en NodeViews
│  renderizadas en el editor              │
└─────────────────────────────────────────┘
```

### Stack de Fase A

| Componente | Tecnología |
|---|---|
| Editor de texto | TipTap v2 |
| Nodos de fórmulas | Custom Nodes: MathInline, MathDisplay |
| Render visual en documento | KaTeX (en NodeViews vanilla TS) |
| Panel de edición de fórmulas | Textarea HTML simple |
| Botones de snippets | Botones que insertan en el textarea |
| Estado | @preact/signals (EditorStore) |

### Flujo de datos en Fase A

```
Usuario escribe en textarea
  → textarea.addEventListener('input')
  → pipeline.process(textarea.value, 'latex')
  → ASTParser → MathAST → Normalizer → ASTSerializer
  → canonical LaTeX string
  → EditorStore.setActiveFormula(canonical)
  → tr.setNodeMarkup(pos, null, { latex: canonical })
  → NodeView.update() → katex.render() → DOM
```

### Snippets en Fase A

Los botones de snippets insertan LaTeX en el textarea en la posición del cursor:

```typescript
function insertSnippet(template: string) {
  const textarea = document.getElementById('formula-input') as HTMLTextAreaElement
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = textarea.value.slice(0, start)
  const selected = textarea.value.slice(start, end)
  const after = textarea.value.slice(end)

  // Reemplazar #@ con el texto seleccionado
  const snippet = template.replace('#@', selected).replace(/#\?/g, '')
  textarea.value = before + snippet + after

  // Disparar input para activar el pipeline
  textarea.dispatchEvent(new Event('input'))
  textarea.focus()
}
```

### Criterios de completitud para Fase A

- [ ] Insertar fórmula inline con `$` en el texto
- [ ] Insertar fórmula de display con `$$`
- [ ] Editar fórmula existente (click → FormulaPanel se sincroniza)
- [ ] Render KaTeX correcto en el documento
- [ ] Todos los botones de snippets insertan correctamente en el textarea
- [ ] El normalizer aplica reglas básicas (AutoDelimiters, DxSpacing)
- [ ] Undo/Redo funciona (incluyendo cambios de fórmulas)
- [ ] Serialización a JSON y restauración desde JSON
- [ ] No hay memory leaks en los NodeViews (verificar con DevTools)
- [ ] No hay feedback loops entre textarea y NodeView

### Por qué empezar aquí

- **TipTap sin MathLive** es un sistema mucho más simple de depurar.
- El textarea tiene comportamiento 100% predecible (no hay Shadow DOM, no hay eventos raros).
- Los NodeViews con KaTeX son el núcleo de Formalia — deben estar perfectos antes de
  añadir complejidad.
- Los snippets en un textarea son triviales — los podemos diseñar correctamente antes
  de tener que adaptarlos a un segundo editor.

---

## 5. Fase B — Demo 2: MathLive en Aislamiento

### Objetivo

Entender profundamente MathLive **sin TipTap** — un prototipo independiente que
explore todas sus sutilezas antes de integrarlo en el editor principal.

### Por qué una demo separada

MathLive tiene comportamientos no obvios que es mejor entender por separado:

- El teclado virtual que aparece en contextos inesperados
- Los menús inline que no queremos pero que aparecen por defecto
- Los eventos 'input' que se disparan al setear valor programáticamente
- Las fuentes que tardan en cargar (FOUT)
- Los macros que se ven en rojo si no están registrados
- El timing de inicialización (connectedCallback vs whenDefined)
- El comportamiento del Shadow DOM con estilos del padre

### Lo que se explora en este prototipo

```typescript
// Un HTML file independiente que prueba:

// 1. Teclado virtual completamente desactivado
mf.mathVirtualKeyboardPolicy = 'off'

// 2. Todos los menús desactivados
mf.menuItems = []

// 3. Botones de snippets propios
SNIPPETS.forEach(s => {
  btn.onclick = () => mf.insert(s.template, { selectionMode: 'placeholder' })
})

// 4. Sincronización textarea ↔ math-field sin feedback loops
// (el patrón syncSrc de tres estados)

// 5. Macros registrados correctamente
mf.macros = { R: '\\mathbb{R}', ... }

// 6. Estilos custom (el campo debe verse como parte de Formalia)

// 7. Comportamiento de Tab entre placeholders de snippets
// ¿funciona bien con #? ? ¿necesitamos interceptar Tab?

// 8. Comportamiento de Enter (¿confirma? ¿inserta newline?)
// Interceptar con 'keystroke' event

// 9. FOUT: ¿cuándo están disponibles las fuentes matemáticas?
// ¿Hay que precargar?
```

### Qué preguntas responde esta demo

| Pregunta | Por qué importa |
|---|---|
| ¿Los snippets con `#?` funcionan como esperamos? | Define el API de snippets para Fase C |
| ¿Tab navega entre placeholders correctamente? | Si no, necesitamos interceptar Tab |
| ¿El campo se ve bien con nuestros estilos? | Evita sorpresas visuales en Fase C |
| ¿Hay eventos de 'input' fantasma al setear valor? | Define si necesitamos suppressChangeNotifications siempre |
| ¿MathLive normaliza el LaTeX que devuelve? | Puede diferir del LaTeX que escribimos |
| ¿El campo oculto para parsear funciona bien? | Necesario para el ASTParser |
| ¿Qué eventos dispara al focus/blur? | Para sincronizar con TipTap en Fase C |

### Criterios de completitud para Fase B

- [ ] math-field funciona sin teclado virtual
- [ ] math-field funciona sin menús
- [ ] Todos los snippets insertan correctamente y posicionan el cursor
- [ ] Tab navega entre placeholders (o tenemos workaround si no)
- [ ] Enter se puede interceptar para "confirmar fórmula"
- [ ] Sincronización textarea ↔ math-field funciona sin feedback loops
- [ ] Los macros custom se muestran correctamente
- [ ] Los estilos de Formalia aplican al campo
- [ ] El campo oculto para parsear funciona correctamente
- [ ] Documentadas todas las sorpresas encontradas (→ añadir a `mathlive-deep-research.md`)

---

## 6. Fase C — Demo 3: Integración Completa

### Objetivo

Unificar lo de Fase A y Fase B. El FormulaPanel tiene dos modos:
- **Codex**: textarea LaTeX (de Fase A)
- **Visual**: MathLive `<math-field>` (de Fase B)

Un toggle cambia entre modos. Los botones de snippets funcionan en ambos.

### Arquitectura del FormulaPanel unificado

```
┌── FormulaPanel ─────────────────────────────────┐
│                                    [Codex|Visual]│  ← Toggle de modo
│  ┌──────────────────────────────────────────────┐│
│  │  [Modo Codex]  textarea LaTeX                 ││
│  │  \frac{a+b}{c-d}                              ││
│  └──────────────────────────────────────────────┘│
│                       ─ ó ─                      │
│  ┌──────────────────────────────────────────────┐│
│  │  [Modo Visual]  <math-field>                  ││
│  │  a+b / c-d   (renderizado visualmente)        ││
│  └──────────────────────────────────────────────┘│
│                                                   │
│  [√] [x²] [∫] [Σ] [lim] [⌨] [→] ← Snippets    │
└───────────────────────────────────────────────────┘
```

### Flujo de datos en Fase C

```
CODEX MODE:
  textarea.input
    → syncSrc = 'text'
    → mf.setValue(latex, { suppressChangeNotifications: true })
    → pipeline.process(latex, 'latex')
    → EditorStore.setActiveFormula(canonical)
    → rAF → syncSrc = null

VISUAL MODE:
  mf.input
    → syncSrc = 'mathlive'
    → textarea.value = mf.getValue('latex')
    → pipeline.process(mf.getValue('math-json'), 'math-json')
    → EditorStore.setActiveFormula(canonical)
    → rAF → syncSrc = null

SNIPPET BUTTON:
  if (activeMode === 'codex'):
    insertInTextarea(snippetTemplate)
    textarea.dispatchEvent(new Event('input'))
  if (activeMode === 'visual'):
    mf.insert(snippetTemplate, { selectionMode: 'placeholder' })
    mf.focus()

SELECCIONAR FÓRMULA EN DOCUMENTO (TipTap):
  onSelectionUpdate → EditorStore.setActiveNodePos(pos)
  → activeLatex.value = node.attrs.latex
  → FormulaPanel recibe el signal
  → if (codex): textarea.value = latex (sin dispara pipeline)
  → if (visual): mf.setValue(latex, { suppressChangeNotifications: true })
```

### La interfaz SnippetService (agnóstica del modo)

```typescript
// Este es el contrato que los botones de snippets usan
// No importa si estamos en modo Codex o Visual

interface IFormulaEditor {
  insertSnippet(template: string): void
  getValue(): string  // LaTeX canónico
  setValue(latex: string): void  // Sin disparar pipeline
  focus(): void
}

class CodexEditor implements IFormulaEditor {
  constructor(private textarea: HTMLTextAreaElement) {}
  
  insertSnippet(template: string): void {
    const start = this.textarea.selectionStart
    const selected = this.textarea.value.slice(start, this.textarea.selectionEnd)
    const snippet = template.replace('#@', selected).replace(/#\?/g, '')
    // Insertar en cursor
    this.textarea.setRangeText(snippet, start, this.textarea.selectionEnd, 'end')
    this.textarea.dispatchEvent(new Event('input'))
  }
  
  getValue(): string { return this.textarea.value }
  setValue(latex: string): void { this.textarea.value = latex }
  focus(): void { this.textarea.focus() }
}

class VisualEditor implements IFormulaEditor {
  constructor(private mf: MathfieldElement) {}
  
  insertSnippet(template: string): void {
    this.mf.insert(template, {
      selectionMode: 'placeholder',
      feedback: true,
    })
    this.mf.focus()
  }
  
  getValue(): string { return this.mf.value }
  setValue(latex: string): void {
    this.mf.setValue(latex, { suppressChangeNotifications: true })
  }
  focus(): void { this.mf.focus() }
}

class FormulaPanel {
  private activeEditor: IFormulaEditor
  
  setMode(mode: 'codex' | 'visual') {
    this.activeEditor = mode === 'codex'
      ? this.codexEditor
      : this.visualEditor
  }
  
  // Los botones de snippets llaman ESTO sin saber qué modo está activo
  insertSnippet(template: string) {
    this.activeEditor.insertSnippet(template)
  }
}
```

### Por qué esta abstracción es la clave

Los botones de snippets **no deben saber** si están en modo Codex o Visual.
Eso es responsabilidad del `FormulaPanel`. Esta separación:

1. Hace que los snippets sean triviales de implementar una vez
2. Hace que añadir un tercer modo (p.ej., un teclado de símbolos táctil) sea
   añadir una clase que implementa `IFormulaEditor`, sin tocar los botones
3. Es testeable de manera aislada
4. Evita el `if (mode === 'codex') { ... } else { ... }` disperso por todo el código

### Criterios de completitud para Fase C

- [ ] Toggle Codex ↔ Visual cambia el panel visible
- [ ] Al cambiar de modo, el contenido del campo se preserva
- [ ] Todos los snippets funcionan en modo Codex (insertan en textarea)
- [ ] Todos los snippets funcionan en modo Visual (insertan en math-field con placeholders)
- [ ] Tab navega entre placeholders en modo Visual
- [ ] Enter en el FormulaPanel confirma la fórmula y pone el foco en el editor
- [ ] Escape en el FormulaPanel cancela y restaura el LaTeX original
- [ ] Al seleccionar un nodo math en el documento, el FormulaPanel se sincroniza en cualquier modo
- [ ] No hay feedback loops en ningún modo ni transición de modo
- [ ] El pipeline de normalización funciona con input desde ambos modos
- [ ] Undo/Redo funciona independientemente del modo de edición

---

## 7. Riesgos y Mitigaciones

### Riesgo 1: La sincronización MathLive ↔ TipTap crea feedback loops

**Síntoma**: Al editar en math-field, el documento parpadea o la formula se
resetea al valor anterior.

**Causa**: `mf.setValue()` dispara 'input', que llama al pipeline, que actualiza
el nodo TipTap, que a su vez podría intentar actualizar el math-field.

**Mitigación**:
1. Siempre usar `suppressChangeNotifications: true` en `mf.setValue()` llamado desde código.
2. El pipeline actualiza TipTap con `tr.setMeta('addToHistory', false)` para
   las actualizaciones en tiempo real (solo registrar en historia al confirmar).
3. Usar el patrón syncSrc de tres estados rigurosamente.

### Riesgo 2: MathLive normaliza el LaTeX de manera diferente a nuestro Normalizer

**Síntoma**: Al editar la misma fórmula en modo Codex y luego en modo Visual
y volver a Codex, el LaTeX cambia (p.ej., `\int` → `\int `).

**Causa**: MathLive tiene su propio serializer LaTeX que puede producir output
ligeramente diferente al nuestro.

**Mitigación**:
1. La fuente de verdad es siempre el LaTeX que pasa por nuestro `ASTSerializer`.
2. Al obtener valor de MathLive, usar `getValue('math-json')` → nuestro ASTParser
   → nuestro ASTSerializer. Nunca usar directamente `mf.getValue('latex')` como
   fuente de verdad del nodo TipTap.
3. Documentar las diferencias de normalización encontradas.

### Riesgo 3: El math-field aparece en contextos de mobile inesperadamente

**Síntoma**: En dispositivos táctiles, el teclado del sistema aparece al tocar
el math-field aunque tengamos `mathVirtualKeyboardPolicy = 'off'`.

**Mitigación**:
1. Para MVP: Formalia es una aplicación de escritorio. Mobile se trata en Fase 4.
2. Para cuando llegue: usar `mf.readOnly = true` cuando no está activo, cambiarlo
   a `false` solo cuando el usuario selecciona una fórmula para editar.

### Riesgo 4: Las fuentes de MathLive y KaTeX no son idénticas

**Síntoma**: Las fórmulas se ven visualmente diferentes en el panel (MathLive)
y en el documento (KaTeX).

**Causa**: MathLive usa fuentes TeX (Computer Modern / STIX) para renderizar;
KaTeX también usa fuentes similares pero la codificación exacta puede diferir.

**Mitigación**:
1. Esto es cosmético, no funcional — aceptable en MVP.
2. KaTeX es el render definitivo (en el documento exportado). MathLive es el
   editor — una diferencia visual leve es aceptable.
3. Si se quiere minimizar: configurar KaTeX con `output: 'html'` y usar fuentes
   compatibles con las de MathLive.

### Riesgo 5: Rendimiento con documentos con muchas fórmulas

**Síntoma**: El editor se vuelve lento con documentos que tienen >100 fórmulas.

**Causa**: KaTeX renderiza síncrono en cada NodeView.update(). Con muchas fórmulas
simultáneas, esto puede bloquear el hilo principal.

**Mitigación**:
1. En NodeView.update(), solo re-renderizar si el LaTeX cambió (no re-renderizar
   si solo cambió la selección).
2. Usar IntersectionObserver para diferir renders fuera del viewport.
3. Cachear el output de KaTeX por string de LaTeX (Map de latex → DOMstring).

---

## 8. El Orden Correcto de Construcción (Resumen)

```
SEMANA 1-N: FASE A — Demo 1
  ✓ TipTap setup con Vite + TypeScript
  ✓ StarterKit + nodos MathInline + MathDisplay
  ✓ NodeViews con KaTeX
  ✓ FormulaPanel con textarea
  ✓ EditorStore + signals
  ✓ Pipeline básico (ASTParser → Normalizer → ASTSerializer)
  ✓ Snippets en textarea
  ✓ Undo/Redo
  ✓ Serialización a .ltxj
  → CHECKPOINT: Demo 1 funciona sin MathLive

SEMANA N+1: FASE B — Demo 2 (MathLive aislado)
  ✓ HTML standalone con math-field
  ✓ Teclado virtual desactivado
  ✓ Menús desactivados
  ✓ Snippets con mf.insert() + placeholders
  ✓ Sincronización textarea ↔ math-field
  ✓ Macros custom registrados
  ✓ Estilos de Formalia aplicados
  ✓ Campo oculto para parsear probado
  ✓ Documentar todas las sorpresas
  → CHECKPOINT: MathLive bien entendido y aislado

SEMANA N+2-M: FASE C — Demo 3 (Integración)
  ✓ IFormulaEditor interface
  ✓ CodexEditor + VisualEditor implementados
  ✓ FormulaPanel con toggle Codex/Visual
  ✓ SnippetService agnóstico del modo
  ✓ Sincronización MathLive ↔ TipTap con syncSrc
  ✓ Pipeline unificado (path A y B convergen)
  ✓ Enter confirma, Escape cancela
  ✓ Tests de no-regresión para feedback loops
  → CHECKPOINT: Integración completa y estable
```

---

## 9. Principios de Diseño para la Integración

### 1. Una sola fuente de verdad

El LaTeX canónico en `node.attrs.latex` (TipTap) es la fuente de verdad.
MathLive y el textarea son **inputs** que producen ese valor, no copias del estado.

### 2. La sincronización fluye en una dirección por vez

Nunca hay dos fuentes escribiendo al mismo tiempo. El flag `syncSrc` garantiza
que solo hay un "escritor" activo en cada momento.

### 3. La abstracción de modo es completa

Los botones de snippets, el pipeline de normalización, y el EditorStore no saben
en qué modo está el FormulaPanel. Solo hablan con interfaces, no con implementaciones.

### 4. Confirmación explícita vs actualización en tiempo real

- **Tiempo real**: mientras el usuario edita, el nodo TipTap se actualiza pero
  los cambios **no** se registran en el historial de undo (tr.setMeta('addToHistory', false)).
- **Confirmación**: al presionar Enter o hacer click en otro nodo, se confirma
  el cambio y **se registra** en el historial.

Esto evita que el historial se llene de pasos intermedios al editar una fórmula.

### 5. Fail-safe visible

Si KaTeX no puede renderizar una fórmula (syntax error), el NodeView muestra
el LaTeX crudo o un indicador de error visible — nunca un nodo en blanco.
Lo mismo para MathLive con macros desconocidos.

---

## 10. Lo que NO hacemos (deliberadamente)

| Lo que no hacemos | Por qué |
|---|---|
| Un math-field por cada fórmula del documento | Performance: una sola instancia global |
| MathLive dentro del DOM de TipTap | Conflictos Shadow DOM / ProseMirror |
| Sincronización sin suppressChangeNotifications | Feedback loops garantizados |
| Componentes Lit como NodeViews | Shadow DOM inside ProseMirror DOM |
| Integrar MathLive antes de estabilizar el modo Codex | Complejidad innecesaria antes de tener base sólida |
| Usar `mf.getValue('latex')` como fuente de verdad directa | La normalización de MathLive puede diferir de la nuestra |
| Abrir el teclado virtual de MathLive | Usamos nuestros propios botones de snippets |

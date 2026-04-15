# Especificación Funcional y Arquitectónica
# Editor LaTeX WYSIWYG — `latexeditor`

> **Versión:** 2.0 — Documento de referencia para desarrollo incremental por fases.  
> **Audiencia:** Desarrolladores e IAs asistentes en IDE (Cursor, Copilot, etc.).  
> **Propósito:** Hoja de ruta técnica y de producto que debe consultarse antes de escribir cualquier línea de código.  
> **Changelog v2:** Incorpora AST como autoridad matemática, motor de normalización tipográfica, panel coach/guía y visión de producto revisada.

---

## 0. Resumen Ejecutivo

`latexeditor` no es simplemente "un editor de LaTeX más fácil". Es un **entorno de escritura matemática asistida** — un compilador de intención matemática. El usuario no piensa "estoy escribiendo código LaTeX", sino que trabaja desde la intención matemática: elige la estructura, escribe la notación, y el sistema se encarga de producir LaTeX correcto, legible y tipográficamente impecable.

El diferencial del producto se apoya en cuatro pilares:
1. **MathLive como entrada primaria** — edición visual estructurada, sin fricción con la sintaxis.
2. **AST matemático como fuente de verdad** — no el texto LaTeX plano, sino una representación semántica intermedia que permite normalizar, validar y serializar con consistencia.
3. **Motor de normalización tipográfica** — el sistema actúa como un formatter matemático inteligente (análogo a Prettier para JS), corrigiendo y sugiriendo según reglas tipográficas del manifiesto.
4. **Templates como estructuras semánticas** — no layouts genéricos, sino patrones de intención matemática (demostración, derivación, sistema de ecuaciones) con reglas de composición ya incorporadas.

La interfaz es unificada: no hay popups, no hay cambios de contexto. La fórmula se edita *in-situ* desde un panel de control siempre visible. El LaTeX canónico es siempre visible y editable, pero nunca es la única forma de interactuar.

### Principios rectores (en orden de prioridad)

1. **Aesthetic-first.** La interfaz debe ser tan cuidada como el output. Tipografía, espaciado y jerarquía visual no son decoración — son funcionalidad.
2. **El AST es la fuente de verdad matemática.** El texto LaTeX que ve el usuario es una proyección del AST, no al revés. Toda edición pasa por el AST antes de producir LaTeX canónico.
3. **Sin popups, sin modales, sin cambios de contexto.** La edición ocurre *in-situ*. Los paneles auxiliares aparecen de forma suave y contextual.
4. **Normalización visible y reversible.** El sistema corrige y sugiere, pero nunca en silencio. El usuario siempre puede ver qué se ajustó, por qué, y revertirlo.
5. **Clean code > velocidad de feature.** Cada módulo tiene una responsabilidad única. Si un archivo supera las 300 líneas, es señal de que hay que dividirlo.
6. **Preparado para escalar.** Las interfaces de los servicios (almacenamiento, compilación, manifiestos, normalizador) deben estar desacopladas desde el día uno.

---

## 1. Stack Tecnológico

### 1.1 Core

| Capa | Tecnología | Justificación |
|---|---|---|
| Framework / Build | **Vite + TypeScript** | Bundler ultrarrápido, HMR nativo, tipado estricto desde el inicio |
| Editor de texto rico | **Tiptap v2** | Extensible por nodos custom, basado en ProseMirror, schema fuertemente tipado |
| Renderizado matemático | **KaTeX** | Renderizado síncrono y rápido; output HTML/SVG limpio |
| Editor visual de fórmulas | **MathLive** | Custom element `<math-field>`, teclado virtual integrado, output LaTeX nativo |
| Estilos | **CSS custom properties + módulos CSS** | Sin frameworks de UI; control total sobre tokens de diseño |
| Fuentes | Google Fonts: `Source Serif 4` (doc), `Inter` (UI), `JetBrains Mono` (código) | |

### 1.2 Librerías de soporte

```
katex              → renderizado de fórmulas (output final, nunca como parse target)
mathlive           → edición visual de fórmulas + source del AST de entrada
@tiptap/core       → motor de editor de documento
@tiptap/starter-kit → nodos base (párrafo, heading, listas, etc.)
```

> **Nota sobre el AST matemático:** MathLive expone `mf.getAtoms()` y `mf.getValue('math-json')`, que produce un AST en formato MathJSON (estándar abierto de CortexJS). Este es el punto de entrada natural para el normalizador. No se necesita una librería externa de parseo de LaTeX para la Fase 1-2.

### 1.3 Restricciones técnicas importantes

- **No React, No Vue.** Arquitectura de Web Components nativos + Tiptap. Esto mantiene el bundle pequeño y evita capas de abstracción innecesarias sobre el DOM de ProseMirror.
- **`<math-field>` nunca vive dentro del DOM de ProseMirror.** El shadow DOM de MathLive entra en conflicto con el manejo de eventos de ProseMirror. Todo editor de fórmulas vive **fuera** del editor, ya sea en el toolbar superior o en un panel lateral.
- **KaTeX, no MathJax.** MathJax es asíncrono y pesado. KaTeX renderiza síncronamente y es suficiente para el 99% del uso universitario.
- **TypeScript estricto.** `strict: true` en `tsconfig.json`. No se permiten `any` sin comentario justificado.

---

## 2. Arquitectura de la Aplicación

### 2.1 Estructura de directorios

```
src/
├── core/
│   ├── editor/           # Configuración de Tiptap y extensiones
│   │   ├── extensions/   # MathInline, MathDisplay, TheoremEnv, CrossRef, etc.
│   │   └── EditorStore.ts # Estado reactivo del editor (nodo activo, selección)
│   ├── math/             # ★ NUEVO: capa matemática central
│   │   ├── MathAST.ts    # Tipos del AST (MathJSON + extensiones propias)
│   │   ├── ASTParser.ts  # MathLive getValue('math-json') → MathAST interno
│   │   ├── ASTSerializer.ts # MathAST → LaTeX canónico
│   │   └── normalizer/   # Motor de normalización tipográfica
│   │       ├── Normalizer.ts          # Orquestador; aplica reglas en orden
│   │       ├── NormalizerRule.ts      # Interfaz base de una regla
│   │       ├── NormalizerResult.ts    # Resultado: cambios + justificaciones
│   │       └── rules/
│   │           ├── AutoDelimiters.ts  # (\frac{}{}) → \left(\right)
│   │           ├── DxSpacing.ts       # integral → \,dx
│   │           ├── TextInMath.ts      # texto plano → \text{}
│   │           ├── MacroExpansion.ts  # \mathbb{R} → \R (usa manifest macros)
│   │           └── AlignedSteps.ts    # múltiples = → align*
│   ├── manifests/        # Sistema de manifiestos
│   │   ├── ManifestEngine.ts
│   │   └── manifests/    # article-base.json, report-base.json, etc.
│   └── serializer/       # Doc JSON Tiptap → .tex completo
│       └── TexSerializer.ts
│
├── features/
│   ├── formula-editor/   # Panel de edición de fórmulas (textarea + palette)
│   │   ├── FormulaPanel.ts
│   │   ├── SymbolPalette.ts
│   │   └── FormulaStore.ts
│   ├── coach/            # ★ NUEVO: panel de guía/feedback tipográfico
│   │   ├── CoachPanel.ts
│   │   └── CoachStore.ts
│   ├── templates/        # Selector y carga de plantillas
│   │   ├── TemplateSelector.ts
│   │   └── templates/    # tp.json, articulo.json, apuntes.json, etc.
│   ├── documents/        # Gestión de múltiples documentos
│   │   ├── DocumentManager.ts
│   │   └── storage/
│   │       ├── IStorageAdapter.ts
│   │       ├── LocalStorageAdapter.ts
│   │       └── IndexedDBAdapter.ts
│   └── export/
│       ├── TexExporter.ts
│       └── PdfService.ts  # Stub preparado, implementación futura
│
├── ui/
│   ├── toolbar/          # Toolbar superior (rows + formula input)
│   ├── sidebar/          # Outline, panel de propiedades, coach
│   └── components/       # Botones, chips, badges de sugerencia reutilizables
│
├── design/
│   ├── tokens.css
│   └── themes/
│
└── main.ts
```

### 2.2 Flujo de datos (AST como autoridad)

```
Usuario edita (MathLive / textarea)
       ↓
  entrada LaTeX o MathJSON (desde mf.getValue())
       ↓
  ASTParser → MathAST (representación semántica interna)
       ↓
  Normalizer.apply(ast, manifest, mode)
       ↓  produces: { ast: MathAST, changes: NormalizerChange[] }
  ASTSerializer → LaTeX canónico
       ↓
  EditorStore.setActiveFormula(canonicalLatex, changes)
       ↓
  Tiptap transaction → setNodeMarkup({ latex: canonicalLatex })
       ↓  NodeView update()
  KaTeX re-renderiza in-situ en el documento
       ↓
  FormulaPanel ← sincronizado con canonicalLatex
  CoachPanel   ← muestra `changes` como sugerencias/correcciones
```

**Regla crítica:** el estado fluye siempre hacia adelante. El LaTeX que el usuario ve en el textarea es el LaTeX canónico resultante del normalizador, no el que escribió originalmente. Los NodeViews son proyecciones de solo lectura del estado del documento.

**Sobre la bidireccionalidad MathLive ↔ textarea:** ambos inputs son válidos como punto de entrada, pero ambos pasan por el mismo pipeline `ASTParser → Normalizer → ASTSerializer` antes de guardarse. Esto garantiza que el LaTeX almacenado en el nodo Tiptap siempre sea canónico, sin importar por dónde entró el usuario.

---

## 3. UX de Edición de Fórmulas (El Corazón del Producto)

Esta es la sección más importante. La imagen de referencia muestra la visión exacta.

### 3.1 El Panel de Fórmula (siempre presente)

En la parte superior de la interfaz existe un **panel de control de fórmulas** compuesto por:

```
┌─────────────────────────────────────────────────────────────────┐
│  ✎ Edición de Fórmula                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ \int_a^b \frac{ \cdot }{ 1+e^{\cdot} } \,dx              │  │
│  └───────────────────────────────────────────────────────────┘  │
├────────────────┬────────────────────────────────────────────────┤
│  [Palette]     │  [Documento con fórmula renderizada in-situ]   │
│  Operadores    │                                                 │
│  Griegas       │   Sea f : ℝ → ℝ continua.                     │
│  Estructuras   │                                                 │
│  Símbolos      │   ┌─────────────────────────────┐              │
│                │   │  ∫ᵇₐ  [□] / (1 + e^[□]) dx  │  ← in-situ │
│                │   └─────────────────────────────┘              │
└────────────────┴────────────────────────────────────────────────┘
```

**Comportamiento del textarea:**
- **Estado inactivo:** Visible pero con placeholder "Seleccioná una fórmula para editar…". No toma foco automáticamente.
- **Estado activo:** Al hacer clic sobre cualquier fórmula del documento, el textarea se activa, muestra el código LaTeX de esa fórmula y le da foco.
- **Actualización reactiva:** Cada keystroke en el textarea dispara un re-render KaTeX *in-situ* en el documento con un debounce de 80ms.
- **Confirmación:** `Enter` o pérdida de foco confirma. `Escape` revierte al estado anterior.

### 3.2 La Fórmula In-Situ (NodeView)

La fórmula en el documento tiene tres estados visuales:

| Estado | Apariencia |
|---|---|
| **Idle** | Renderizada con KaTeX, chip con fondo sutil (`--math-bg`), borde fino |
| **Hover** | Borde más pronunciado, cursor `pointer`, hint "clic para editar" |
| **Editing** | Borde accent con glow, chip resaltado; el textarea del toolbar está sincronizado. Si el modo global es **Visual**, se muestra `<math-field>` MathLive *in-situ* en lugar del render KaTeX estático |

### 3.3 El Modo Global de Edición

El modo se selecciona **una vez a nivel global** (no por fórmula). Vive en el toolbar como un toggle persistente en `localStorage`.

| Modo | Comportamiento del panel superior | Comportamiento in-situ |
|---|---|---|
| **Codex (LaTeX)** | Textarea de código puro con syntax highlight ligero | Fórmula re-renderiza con KaTeX en tiempo real al editar el textarea |
| **Visual (MathLive)** | Textarea también visible (lectura del LaTeX resultante) | Aparece `<math-field>` MathLive directamente en la posición de la fórmula en el documento |

**Principio de unificación:** En ambos modos, la paleta de símbolos funciona igual. El botón de "fracción" siempre inyecta `\frac{|}{|}` en el textarea activo (con el cursor posicionado en `|`). En modo Visual, además actualiza el `<math-field>` MathLive. No hay lógica de bifurcación compleja.

### 3.4 La Paleta de Símbolos

Panel lateral izquierdo (colapsable). Organizado en categorías tabs:

```
Griegas    → α β γ δ ε λ μ π φ ψ ω Γ Δ Σ Ω …
Operadores → ± × ÷ · ≤ ≥ ≠ ≈ ∈ ∉ ⊂ ∪ ∩ ∀ ∃ →  …
Estructuras → \frac \sqrt \sum \prod \int \lim \vec \hat \begin{cases} …
Símbolos   → ∞ ∂ ∇ ℝ ℤ ℕ ℂ … ⋯ ⋮ ⋱ □ ∅ ⊗ ⊕ …
```

Cada botón:
- Muestra la representación KaTeX del símbolo (no el código)
- Al clic: inserta el snippet en el textarea activo con el cursor en la posición `|`
- `mousedown` previene blur del textarea (patrón crítico para no perder foco)

---

## 4. Motor de Normalización Tipográfica ★ NUEVO

El normalizador es el módulo más diferenciador del producto. Actúa como un **formatter matemático inteligente** — análogo a Prettier para JavaScript o Black para Python — que convierte LaTeX correcto-pero-subóptimo en LaTeX canónico y tipográficamente impecable, siguiendo las reglas del manifiesto activo.

### 4.1 Principios del normalizador

- **Opera sobre el AST, no sobre el texto.** Nunca hace búsqueda/reemplazo de strings. Analiza la estructura semántica y actúa con conocimiento del contexto matemático.
- **Toda corrección es visible.** Ningún cambio ocurre en silencio. Cada transformación produce un objeto `NormalizerChange` con la descripción del problema y la justificación de la corrección.
- **Toda corrección es reversible.** El usuario puede revertir cualquier normalización individual desde el panel coach.
- **Configuración global de agresividad:** tres modos seleccionables por el usuario.

### 4.2 Modos de comportamiento

| Modo | Comportamiento |
|---|---|
| **Estricto** | Aplica automáticamente todas las correcciones inequívocas del manifiesto. El textarea muestra el LaTeX ya normalizado. |
| **Sugerencia** | No modifica el texto, pero el panel coach muestra advertencias con la corrección propuesta. El usuario acepta o descarta cada una. |
| **Mixto** *(default)* | Corrige automáticamente lo que el manifiesto marca como obligatorio; sugiere lo que es preferencia de estilo. Equilibra aprendizaje y control. |

### 4.3 Catálogo de reglas (Fase 1-2)

Cada regla implementa `NormalizerRule` y puede activarse/desactivarse por manifiesto.

#### `AutoDelimiters` — La regla más importante
```
Entrada:  (\frac{a}{b})^2
Problema: paréntesis estáticos no escalan frente a una fracción
Corrección: \left(\frac{a}{b}\right)^2
Trigger:  cualquier delimitador ( [ | que contenga \frac, \sum, \prod, \int
```

#### `DxSpacing`
```
Entrada:  \int_a^b f(x) dx
Corrección: \int_a^b f(x)\,dx
Regla: thin space (\,) antes de todo diferencial
```

#### `TextInMath`
```
Entrada:  f(c) = 0 \quad para algún c \in (a,b)
Corrección: f(c) = 0 \quad \text{para algún } c \in (a,b)
Regla: secuencias de letras sin comando matemático → \text{}
```

#### `MacroExpansion`
```
Entrada:  x \in \mathbb{R}
Corrección: x \in \R  (usando macro del manifiesto)
Regla: los \newcommand del manifiesto deben usarse en el body
```

#### `AlignedSteps`
```
Entrada:  múltiples líneas con = en display math (\[...\])
Corrección: sugiere migrar a align* con punto de alineación en &=
Trigger:  dos o más = sucesivos en math display mode
```

#### `DisplayThreshold`
```
Entrada:  fracción, sumatoria o integral en modo inline ($...$)
Corrección: sugiere convertir a display (\[...\])
Regla: si la expresión contiene \frac con límites o \sum/\int con límites → display
```

### 4.4 Interfaz TypeScript

```typescript
interface NormalizerRule {
  readonly id: string
  readonly description: string
  readonly severity: 'required' | 'preferred' | 'opinionated'
  applies(ast: MathAST, manifest: ResolvedManifest): boolean
  transform(ast: MathAST, manifest: ResolvedManifest): NormalizerResult
}

interface NormalizerResult {
  ast: MathAST
  changes: NormalizerChange[]
}

interface NormalizerChange {
  ruleId: string
  description: string           // "Paréntesis ajustados al tamaño de la fracción"
  justification: string         // "Los paréntesis sin \left/\right no escalan visualmente"
  before: string                // LaTeX antes
  after: string                 // LaTeX después
  reversible: boolean
}

interface INormalizer {
  apply(ast: MathAST, manifest: ResolvedManifest, mode: NormalizerMode): NormalizerResult
  applyRule(ast: MathAST, ruleId: string, manifest: ResolvedManifest): NormalizerResult
  revert(ast: MathAST, change: NormalizerChange): MathAST
}

type NormalizerMode = 'strict' | 'suggestion' | 'mixed'
```

---

## 5. Panel Coach / Guía ★ NUEVO

El panel coach es la interfaz de usuario del normalizador. Es el componente que convierte la corrección técnica en aprendizaje activo.

### 5.1 Posición y comportamiento

- **Sidebar derecho**, colapsable, ~240px de ancho.
- **Estado vacío:** cuando no hay fórmula activa, muestra una guía contextual sobre el tipo de entorno actual (ej: "Estás en un entorno `proof`. Usá `align*` para pasos alineados.")
- **Estado activo:** cuando se edita una fórmula y el normalizador detecta cambios, muestra las tarjetas de corrección.
- **Aparece suavemente** (CSS transition) sin interrumpir el flujo.

### 5.2 Tarjetas de corrección

Cada `NormalizerChange` se renderiza como una tarjeta:

```
┌─────────────────────────────────────────────────┐
│ ⚠ Delimitadores                         [AUTO]  │
│ Los paréntesis no escalan con la fracción.       │
│                                                  │
│  Antes: (\frac{a}{b})^2                         │
│  Ahora: \left(\frac{a}{b}\right)^2              │
│                                                  │
│  [Ver regla]  [Revertir]  [No sugerir más]       │
└─────────────────────────────────────────────────┘
```

Tipos de badge:
- `[AUTO]` — ya fue aplicado (modo estricto o mixto)
- `[SUGERENCIA]` — propuesto, pendiente de aceptar/rechazar
- `[INFO]` — nota educativa sin acción requerida

### 5.3 Guía contextual de entornos

Cuando el cursor del documento está dentro de un `TheoremEnv`, el coach muestra sugerencias para ese tipo:

```
theorem / lemma   → "¿Necesitás referenciar esta ecuación?  
                     Usá Numerada + \label para usar \eqref después."
proof             → "Para pasos alineados: align*, con & antes del =."
exercise          → "Separás la solución con \subsection*{Solución}."
```

---

## 6. Sistema de Manifiestos y Templates

### 6.1 El Manifiesto como Contrato

Un manifiesto es un archivo `.json` que define: paquetes, macros, entornos, geometría, y — nuevamente — **las reglas del normalizador que aplican** y con qué modo de comportamiento. Esto hace que cada template pueda tener una política tipográfica diferente.

```jsonc
// manifests/article-base.json
{
  "id": "article-base",
  "documentClass": "article",
  "classoptions": ["12pt", "a4paper"],
  "packages": {
    "mandatory": ["inputenc", "fontenc", "lmodern", "babel", "amsmath",
                  "amssymb", "amsthm", "mathtools", "geometry",
                  "microtype", "hyperref"],
    "optional": ["fancyhdr", "enumitem", "booktabs", "xcolor", "graphicx", "tikz"]
  },
  "macros": {
    "\\R": "\\mathbb{R}",
    "\\N": "\\mathbb{N}",
    "\\Z": "\\mathbb{Z}",
    "\\Q": "\\mathbb{Q}",
    "\\C": "\\mathbb{C}",
    "\\K": "\\mathbb{K}",
    "\\abs": "\\left\\lvert #1 \\right\\rvert",
    "\\norm": "\\left\\lVert #1 \\right\\rVert",
    "\\inner": "\\left\\langle #1, #2 \\right\\rangle"
  },
  "environments": {
    "theorem":    { "style": "plain",      "shared_counter": "definition" },
    "lemma":      { "style": "plain",      "shared_counter": "definition" },
    "definition": { "style": "definition", "counter": "section" },
    "proof":      { "style": "remark",     "qed": true },
    "exercise":   { "style": "definition", "counter": "section" },
    "remark":     { "style": "remark",     "shared_counter": "definition" },
    "example":    { "style": "remark",     "shared_counter": "definition" }
  },
  "mathRules": {
    "displaySyntax": "\\[...\\]",
    "inlineSyntax": "$...$",
    "alignedSteps": "align*",
    "numberingEnv": "equation",
    "requireThinSpaceBeforeDx": true,
    "requireTextInMathMode": true,
    "requireAdjustedDelimiters": true
  },
  "normalizerRules": {
    // Qué reglas aplican y con qué severidad para este manifiesto
    "AutoDelimiters":  { "enabled": true,  "severity": "required"   },
    "DxSpacing":       { "enabled": true,  "severity": "required"   },
    "TextInMath":      { "enabled": true,  "severity": "preferred"  },
    "MacroExpansion":  { "enabled": true,  "severity": "required"   },
    "AlignedSteps":    { "enabled": true,  "severity": "preferred"  },
    "DisplayThreshold":{ "enabled": true,  "severity": "opinionated"}
  },
  "geometry": {
    "left": "2.5cm", "right": "2.5cm", "top": "2.5cm", "bottom": "2.5cm"
  }
}
```

### 4.2 Jerarquía de Manifiestos

```
manifests/
├── base.json                    # Reglas universales (math rules, encoding)
├── article-base.json            # Extiende base; clase article
├── report-base.json             # Extiende base; clase report (chapters)
├── beamer-base.json             # Extiende base; presentaciones
└── templates/
    ├── trabajo-practico.json    # Extiende article-base; agrega exercise env
    ├── articulo-investigacion.json  # Extiende article-base; bibliography, abstract
    ├── apuntes-clase.json       # Extiende article-base; definiciones y ejemplos
    └── tesis.json               # Extiende report-base; chapters, bibliography
```

La clase `ManifestEngine` resuelve la cadena de herencia y devuelve un manifiesto plano y resuelto al serializer, al normalizador y al template loader.

### 6.3 Templates como estructuras semánticas

Los templates no son solo layouts. Cada template encapsula una **intención matemática** específica: ya sabe qué tipo de escritura se va a hacer, qué entornos son naturales, qué reglas del normalizador aplican con qué agresividad, y qué guías del coach son relevantes.

```jsonc
// templates/trabajo-practico.json
{
  "id": "trabajo-practico",
  "name": "Trabajo Práctico",
  "description": "Ejercicios con enunciado, desarrollo y solución",
  "icon": "📝",
  "tags": ["matemática", "ejercicios", "universidad"],
  "manifest": "article-base",
  "normalizerMode": "strict",    // este template aplica correcciones sin preguntar
  "coachHints": {                // guías contextuales específicas de este template
    "exercise": "Cada ejercicio tiene su propio entorno exercise. La solución va en \\subsection*{Solución}.",
    "proof":    "Si la solución es una prueba formal, usá el entorno proof (agrega ∎ automáticamente)."
  },
  "initialDoc": {
    "type": "doc",
    "content": [
      { "type": "heading", "attrs": { "level": 1 },
        "content": [{ "type": "text", "text": "Ejercicio 1" }] },
      { "type": "theoremEnv", "attrs": { "envType": "exercise" },
        "content": [{ "type": "paragraph" }] },
      { "type": "heading", "attrs": { "level": 2 },
        "content": [{ "type": "text", "text": "Solución" }] },
      { "type": "paragraph" }
    ]
  },
  "metaDefaults": {
    "subject": "Análisis Matemático",
    "date": "\\today"
  }
}
```

**Catálogo de templates (Fase 2):**

| ID | Nombre | Intención matemática | Modo normalizador |
|---|---|---|---|
| `trabajo-practico` | Trabajo Práctico | Ejercicios + soluciones | strict |
| `apuntes-clase` | Apuntes de Clase | Definiciones + teoremas + ejemplos | mixed |
| `articulo-investigacion` | Artículo de Investigación | Pruebas formales + bibliografía | mixed |
| `derivacion-paso-a-paso` | Derivación Paso a Paso | `align*` con justificaciones | strict |
| `tesis` | Tesis / Trabajo Final | Documento largo con capítulos | suggestion |

---

## 7. Nodos Tiptap: Extensiones Custom

### 9.1 Nodos matemáticos

#### `MathInline`
```typescript
// Nodo atómico inline. Renderizado: KaTeX inline.
// El latex almacenado es SIEMPRE el LaTeX canónico post-normalizador.
attrs: { latex: string }
group: 'inline'
atom: true
```

#### `MathDisplay`
```typescript
// Nodo atómico block. Renderizado: KaTeX display.
attrs: {
  latex: string
  numbered: boolean  // → \begin{equation}
  aligned: boolean   // → align* | align
  label: string      // → \label{eq:...}
}
group: 'block'
atom: true
```

#### `TheoremEnv`
```typescript
attrs: {
  envType: 'theorem' | 'definition' | 'lemma' | 'proposition' |
           'corollary' | 'proof' | 'exercise' | 'remark' | 'example'
  envTitle: string
}
group: 'block'
content: 'block+'
```

#### `CrossRef`
```typescript
attrs: { refId: string }
group: 'inline'
atom: true
// Renderizado: chip "[eq:X]" → LaTeX: \eqref{eq:X}
```

### 9.2 Input Rules (shortcuts de teclado)

| Patrón tipado | Resultado |
|---|---|
| `$$` + espacio | Inserta `MathDisplay` vacío |
| `$` + texto + `$` | Inserta `MathInline` con ese texto |
| `/thm` | Inserta `TheoremEnv` tipo theorem |
| `/def` | Inserta `TheoremEnv` tipo definition |
| `/proof` | Inserta `TheoremEnv` tipo proof |
| `/ex` | Inserta `TheoremEnv` tipo exercise |

---

## 8. Serializer LaTeX (`.tex` Exporter)

El `TexSerializer` recibe el JSON del documento Tiptap y el manifiesto resuelto, y produce un string `.tex` idiomático. El LaTeX almacenado en cada nodo ya es canónico (fue normalizado al ingresar), por lo que el serializer no necesita normalizar — solo mapear nodos a comandos LaTeX.

### 15.1 Contrato de la función

```typescript
interface SerializerOptions {
  manifest: ResolvedManifest
  meta: DocumentMeta
  includeToc: boolean
}

function serializeToTex(doc: TiptapJSON, options: SerializerOptions): string
```

### 15.2 Reglas de serialización

```
paragraph       → texto plano con inlines serializados
heading (h1)    → \section{}, heading (h2) → \subsection{}, etc.
mathInline      → $latex$
mathDisplay     → \[latex\] | \begin{equation}\label{eq:X}...\end{equation}
                  | \begin{align*}...\end{align*}
theoremEnv      → \begin{theorem}[title]...\end{theorem}
crossRef        → \eqref{eq:X}
bulletList      → \begin{itemize}...\end{itemize}
orderedList     → \begin{enumerate}...\end{enumerate}
bold            → \textbf{...}
italic          → \textit{...}
code            → \texttt{...}
```

### 10.3 Garantías del serializer (simplificadas por el normalizador)

Dado que el normalizador ya procesó el LaTeX al ingresar, el serializer puede confiar en estas invariantes:
- No hay `\mathbb{R}` — ya fue reemplazado por `\R`
- No hay `(\frac...)` — ya tiene `\left(\right)`
- No hay texto sin `\text{}` en math mode
- Toda integral tiene `\,dx`

La única transformación que sí hace el serializer sobre el LaTeX del nodo es el escape de caracteres especiales en texto plano.

### 8.4 Preamble generado

```latex
\documentclass[12pt, a4paper]{article}
% --- packages del manifiesto ---
% --- macros del manifiesto ---
% --- theorem environments del manifiesto ---
% --- geometry ---
% --- hypersetup ---
% --- header/footer ---
\title{...}\author{...}\date{...}
```

---

## 9. Importación de `.tex` (Round-Trip)

El parser inverso lee un `.tex` previamente exportado por el serializador y reconstruye el JSON del documento.

### 9.1 Estrategia

1. **Parsear el preamble** para identificar el manifiesto (por documentclass + packages).
2. **Tokenizar el body** en bloques: `\section`, `\begin{...}`, `\[`, `$`, texto plano.
3. **Mapear tokens → nodos Tiptap** según el manifiesto activo.
4. **Fallback "raw block":** Todo lo que no se pueda mapear limpiamente (ej. `\tikz`, código custom) se encapsula en un nodo `RawLatex` no editable, visible como bloque de código en el editor.

### 9.2 Nodo `RawLatex`
```typescript
// Para contenido LaTeX válido pero fuera del manifiesto.
attrs: { content: string }
// Renderizado: bloque de código con syntax highlight, no editable
// Exportado: volcado tal cual al .tex
```

---

## 10. Gestión de Documentos y Persistencia

### 15.1 Interfaz de almacenamiento (adapter pattern)

```typescript
interface IStorageAdapter {
  listDocuments(): Promise<DocumentMeta[]>
  loadDocument(id: string): Promise<DocumentState>
  saveDocument(doc: DocumentState): Promise<void>
  deleteDocument(id: string): Promise<void>
  exportDocument(id: string): Promise<Blob>   // el .tex
}
```

**Implementaciones:**
- `LocalStorageAdapter` — Fase 1, sincrónico sobre `localStorage`
- `IndexedDBAdapter` — Fase 2, para documentos grandes
- `GoogleDriveAdapter` — Fase 3 (Roadmap)

### 15.2 DocumentState

```typescript
interface DocumentState {
  id: string
  meta: DocumentMeta           // título, autor, materia, fecha
  manifestId: string           // qué manifiesto/template usa
  editorJson: TiptapJSON       // el doc completo
  createdAt: number
  updatedAt: number
  editorModePreference: 'codex' | 'visual'
}
```

### 10.3 Panel de documentos

Sidebar izquierdo o drawer: lista de documentos con nombre, fecha, template. Permite crear nuevo (→ selector de template), duplicar, renombrar, eliminar. Auto-save cada 30 segundos y en cada pérdida de foco del documento activo.

---

## 11. Sistema de Temas (Visual Themes)

Los temas afectan la apariencia del **canvas del editor**, no de la UI de la aplicación.

| Tema | Descripción |
|---|---|
| **Moderno** | Entornos con colores por tipo, fórmulas con chip violeta, layout vibrante |
| **Sobrio** | Entornos sin colores, estilo LaTeX clásico, tipografía prominente |
| **Minimalista** | Sin fondos de color, bordes sutiles, máxima concentración |

Los temas se implementan con un atributo `data-editor-theme` en `#editor-wrap` y reglas CSS correspondientes. No requieren JavaScript más allá del toggle.

---

## 12. Compilación a PDF (Roadmap)

### 15.1 Interfaz del servicio (stub desde Fase 1)

```typescript
interface IPdfService {
  compile(texSource: string): Promise<PdfResult>
}

interface PdfResult {
  success: boolean
  pdfBlob?: Blob
  errors?: LatexError[]
  warnings?: string[]
}
```

### 15.2 Estrategias futuras (Fase 3+)

**Opción A — Backend:** API REST que recibe el `.tex`, ejecuta `pdflatex`/`lualatex` en un contenedor, devuelve el PDF.

**Opción B — WebAssembly:** Integración con SwiftLaTeX o TeXLive.wasm para compilar en el navegador. Sin servidor, privacidad total. Desventaja: bundle ~50MB.

La interfaz `IPdfService` permite swappear sin tocar el resto de la aplicación.

---

## 13. Fases de Desarrollo

### Fase 1 — Core, UI Base y Pipeline Matemático
**Objetivo:** Editor funcional con fórmulas básicas y el pipeline AST operativo desde el inicio.

- [ ] Setup Vite + TypeScript + estructura de directorios (incluye `core/math/`)
- [ ] Design tokens CSS (colores, tipografía, espaciado, radios)
- [ ] Toolbar doble fila (formato + estructura/math + toggle modo)
- [ ] FormulaPanel: textarea siempre visible en toolbar, paleta lateral
- [ ] Nodos Tiptap: `MathInline`, `MathDisplay`, `TheoremEnv`
- [ ] NodeViews: renderizado KaTeX + activación al clic → sync con FormulaPanel
- [ ] Modo Codex (default): textarea → KaTeX in-situ reactivo
- [ ] **`ASTParser` básico**: `mf.getValue('math-json')` → `MathAST`
- [ ] **`ASTSerializer`**: `MathAST` → LaTeX canónico
- [ ] **`Normalizer` con 3 reglas**: `AutoDelimiters`, `DxSpacing`, `MacroExpansion`
- [ ] **`CoachPanel` mínimo**: muestra `NormalizerChange[]` como tarjetas read-only
- [ ] Input rules: `$$` → MathDisplay, `/thm` → theorem, etc.
- [ ] Serializer `.tex` (article-base manifest)
- [ ] Export modal: preview del .tex + copy + download
- [ ] LocalStorage adapter: auto-save + carga al iniciar
- [ ] Sidebar outline (headings)

### Fase 2 — Modo Visual, Normalización Completa y Templates
**Objetivo:** MathLive como entrada primaria, normalizador completo y sistema de templates.

- [ ] Modo Visual global: toggle en toolbar, sincronización MathLive ↔ textarea ↔ Tiptap
- [ ] **Normalizer completo**: `TextInMath`, `AlignedSteps`, `DisplayThreshold`
- [ ] **Tres modos del normalizador**: strict / suggestion / mixed (global + por template)
- [ ] **CoachPanel completo**: tarjetas con Accept/Revert, guías contextuales por entorno
- [ ] Template selector (pantalla de bienvenida)
- [ ] Templates semánticos: Trabajo Práctico, Apuntes, Artículo, Derivación, Tesis
- [ ] ManifestEngine: herencia y resolución + campo `normalizerRules`
- [ ] Nodo `CrossRef` + ecuaciones numeradas + `\eqref{}`
- [ ] Panel de metadatos del documento (colapsable)
- [ ] Gestión de múltiples documentos (sidebar + LocalStorageAdapter)
- [ ] Temas visuales del editor

### Fase 3 — Round-Trip, Robustez y Tests
**Objetivo:** Importación de `.tex`, escala y confiabilidad.

- [ ] Parser `.tex` → JSON Tiptap (round-trip) + nodo `RawLatex`
- [ ] IndexedDB adapter para documentos grandes
- [ ] Validación de sintaxis LaTeX en textarea (parser ligero)
- [ ] Autocompletado de comandos en textarea
- [ ] Accesibilidad (a11y): navegación por teclado, ARIA
- [ ] Tests unitarios: `Normalizer` (cada regla), `ASTSerializer`, `ManifestEngine`, serializer `.tex`

### Fase 4 — Colaboración y PDF (Roadmap)
**Objetivo:** Salida a producción.

- [ ] `IPdfService` con backend Docker + pdfLaTeX
- [ ] Vista previa PDF inline (PDF.js)
- [ ] `GoogleDriveAdapter`
- [ ] Autenticación básica (OAuth Google)
- [ ] Compartir documentos (URL única de lectura)

---

## 14. Riesgos y Mitigaciones ★ NUEVO

| Riesgo | Descripción | Mitigación |
|---|---|---|
| **Normalización agresiva** | El sistema corrige algo que el usuario quería así | Modo `suggestion` por default; siempre hay revert individual |
| **Pérdida de control** | El usuario siente que el sistema "le roba el código" | Toda corrección es visible en el CoachPanel con before/after |
| **Inconsistencias entre reglas** | Dos reglas se contradicen (ej. AutoDelimiters + DisplayThreshold) | Las reglas se ordenan por prioridad en el manifest; se añaden tests de composición |
| **Parseo ambiguo** | `mf.getValue('math-json')` no siempre refleja fielmente la intención | El normalizador opera con `applies()` conservador; si no está seguro, no actúa |
| **Rigidez de la UX** | Si el sistema corrige demasiado, el usuario experto se frustra | Modo `strict` es opt-in; el default es `mixed` |
| **Drift de cursor en sync bidireccional** | El cursor salta al sincronizar MathLive ↔ textarea | `syncSrc` con tres estados y `requestAnimationFrame` (implementado en `formula_demo.html`) |

---

## 15. Estándares de Código

### 15.1 Convenciones de nomenclatura

```
PascalCase  → clases, interfaces, componentes, tipos
camelCase   → variables, funciones, métodos
UPPER_SNAKE → constantes de módulo
kebab-case  → archivos, ids CSS, atributos HTML
```

### 15.2 Reglas de módulo

- Cada archivo exporta **una responsabilidad primaria**.
- Archivos > 300 líneas → dividir.
- No `any` sin comentario `// justificación: ...`.
- Toda función pública tiene JSDoc con `@param` y `@returns`.
- Interfaces > Tipos para objetos con métodos.
- `readonly` por defecto en propiedades de interfaces de estado.

### 15.3 CSS

- Todo color, espaciado y radio vía CSS custom properties de `tokens.css`.
- No hardcoding de `#hexcode` fuera de `tokens.css`.
- Clases semánticas, no utility-first. No Tailwind.
- Prefijo de componente en clases: `.formula-panel__textarea`, `.theorem-env__label`.

### 15.4 Commits

```
feat(formula-panel): add debounced live render to textarea input
fix(math-inline): prevent ProseMirror event conflict on nodeView click
refactor(serializer): extract preamble generation to PreambleBuilder
docs(manifest): document article-base.json schema
```

---

## 16. Referencias y Recursos

| Recurso | URL |
|---|---|
| Tiptap v2 docs | https://tiptap.dev/docs |
| Tiptap NodeView API | https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views |
| KaTeX API | https://katex.org/docs/api |
| MathLive docs | https://cortexjs.io/mathlive |
| MathLive: Virtual Keyboard | https://cortexjs.io/mathlive/guides/virtual-keyboards |
| MathLive: MathJSON format | https://cortexjs.io/math-json |
| MathLive: Compute Engine + `getValue('math-json')` | https://cortexjs.io/mathlive/guides/compute-engine |
| ProseMirror guide | https://prosemirror.net/docs/guide |
| Vite config | https://vitejs.dev/config |
| Manifiesto base del proyecto | `src/core/manifests/article-base.json` |
| Demo bidireccional MathLive ↔ textarea | `formula_demo.html` (en este repositorio) |

---

*Este documento debe mantenerse actualizado a medida que avanza el desarrollo. Si una decisión de implementación contradice lo aquí especificado, se debe actualizar el spec antes de continuar — no el código.*

*v2.0 — Cambios respecto a v1.0: incorpora AST matemático como fuente de verdad (§2.2), motor de normalización tipográfica (§4), panel coach/guía (§5), templates como estructuras semánticas (§6.3), tabla de riesgos (§14), referencias a MathJSON y formula_demo.html.*

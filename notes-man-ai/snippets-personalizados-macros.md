# Snippets personalizados y macros de usuario

## Parte 1 — Snippets personalizados

### Concepto

El usuario puede crear sus propios snippets con el mismo comportamiento que los built-in: aparecen en el sidebar, pueden marcarse como favoritos, tienen atajos, se insertan en el floating editor.

### Estructura de datos

```typescript
interface UserSnippet {
  id: string          // uuid generado al crear
  icon: string        // texto corto o emoji, ej: "x²" o "★"
  label: string       // nombre legible, ej: "Mi fórmula"
  t: string           // LaTeX con placeholders MathLive (#@, #?)
  cat: 'custom'       // categoría fija
}
```

Persistencia: `localStorage: formalia:user-snippets → JSON array de UserSnippet`

### UI de creación

Botón "+" al pie del sidebar expandido abre un mini-form inline o modal:
```
┌─────────────────────────────────┐
│ Ícono  [x²    ]                 │
│ Nombre [Mi fórmula             ]│
│ LaTeX  [\frac{#@}{#?}          ]│
│        [ preview en tiempo real ]│
│              [Cancelar] [Guardar]│
└─────────────────────────────────┘
```

- El campo LaTeX tiene preview KaTeX en tiempo real (igual que el floating editor)
- Validación: no guardar si el LaTeX tiene error de KaTeX
- Edición y eliminación desde el sidebar (ícono lápiz/papelera al hover)

### Integración con favoritos y atajos

Los snippets personalizados son ciudadanos de primera clase: pueden ocupar slots 0–9 con atajo Ctrl+Shift+N igual que los built-in.

### Categoría en el sidebar

Aparecen en una categoría "Mis snippets" al inicio de la lista, antes de las categorías built-in. El tab "Todos" los incluye.

---

## Parte 2 — Macros de usuario

### Concepto

El usuario define macros LaTeX con argumentos que se expanden en tres lugares:
1. **KaTeX render** (nodeviews) — via la opción `macros` de KaTeX
2. **Floating editor** — el textarea/MathLive ve la macro expandida o la macro cruda según el modo
3. **Export LaTeX** — se emiten como `\newcommand` en el preámbulo del documento

### Sintaxis

Sintaxis TeX nativa con argumentos posicionales `#1`, `#2`, `#3`:

```
nombre:   \solcuadr
args:     3
cuerpo:   \frac{-#2 \pm \sqrt{#2^2 - 4 #1 #3}}{2 #1}
```

Uso en el documento: `\solcuadr{a}{b}{c}` → expande a la fórmula completa.

Se elige sintaxis TeX nativa porque:
- KaTeX la soporta directamente sin procesamiento intermedio
- Los usuarios target conocen LaTeX y el modelo mental es el correcto
- El export a `\newcommand` es trivial

### Estructura de datos

```typescript
interface UserMacro {
  id: string
  name: string        // ej: "\\solcuadr"
  args: number        // cantidad de argumentos (0–9)
  body: string        // cuerpo con #1..#9
  description: string // para mostrar en la UI
}
```

Persistencia: `localStorage: formalia:user-macros → JSON array de UserMacro`

### Integración con KaTeX

En `renderableLatex()` o directamente en la llamada a `katex.render()`, se pasa el mapa de macros:

```typescript
function buildKatexMacros(macros: UserMacro[]): Record<string, string> {
  return Object.fromEntries(macros.map(m => [m.name, m.body]))
}

katex.render(latex, el, {
  macros: buildKatexMacros(getUserMacros()),
  ...
})
```

Esto funciona para macros sin argumentos y con argumentos posicionales — KaTeX lo soporta nativamente.

### Export LaTeX

Al exportar el documento, las macros del usuario se emiten en el preámbulo:

```latex
\newcommand{\solcuadr}[3]{\frac{-#2 \pm \sqrt{#2^2 - 4 #1 #3}}{2 #1}}
```

Esto hace que el documento exportado sea completamente autónomo.

### UI de creación

Modal dedicado (más complejo que snippets, merece su propio espacio):

```
┌──────────────────────────────────────────────┐
│ Nueva macro                                   │
│                                               │
│ Comando   [\solcuadr                        ] │
│ Argumentos [3]                                │
│ Descripción[Fórmula cuadrática             ] │
│                                               │
│ Cuerpo:                                       │
│ ┌──────────────────────────────────────────┐  │
│ │ \frac{-#2 \pm \sqrt{#2^2-4#1#3}}{2#1}  │  │
│ └──────────────────────────────────────────┘  │
│                                               │
│ Preview con valores de ejemplo:               │
│  #1=a  #2=b  #3=c                            │
│ ┌──────────────────────────────────────────┐  │
│ │   (-b ± √(b²-4ac)) / 2a   (KaTeX live) │  │
│ └──────────────────────────────────────────┘  │
│                                               │
│                    [Cancelar] [Guardar macro] │
└──────────────────────────────────────────────┘
```

- Preview con valores de ejemplo sustituidos en `#1`, `#2`, etc.
- Validación: nombre debe empezar con `\`, no puede colisionar con comandos KaTeX built-in
- Las macros definidas se listan en una sección "Mis macros" accesible desde el sidebar o settings

### Acceso desde el sidebar

Las macros sin argumentos (`args: 0`) pueden agregarse como snippets favoritos directamente. Las que tienen argumentos aparecen en la categoría "Mis macros" del sidebar y al insertarlas abren el floating editor con la macro + placeholders para cada argumento.

### Lo que queda fuera de scope inicial

- Macros que llaman a otras macros (dependencias entre macros)
- Macros con argumentos opcionales con default (`\newcommand{\cmd}[2][default]`)
- Sincronización entre dispositivos
- Importar/exportar el set de macros como archivo

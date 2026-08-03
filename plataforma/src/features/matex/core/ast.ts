/**
 * AST de Matex — el **modelo semántico** de un documento, fuente de verdad del
 * editor visual. Es LaTeX-agnóstico y **puro** (tipos de datos, sin DOM ni
 * frameworks): se serializa a JSON (persistencia) y se compila a LaTeX (salida).
 *
 * Diseño para **escalar aditivamente** (ver `spec-editor-visual.md`): sumar un
 * feature = agregar un nodo nuevo al union, con su serializador y sus requisitos de
 * preámbulo, **sin tocar** los existentes. `rawLatex` es la válvula de escape para
 * lo que el schema todavía no modela.
 *
 * Versión inicial (piloto): el subconjunto mínimo. Nodos futuros previstos:
 * `figure`, `table`, `theorem`/`proof`, `include`, `ref`/`cite`, `plot`…
 */

/** Marcas de texto en línea (se combinan). */
export type Mark = 'strong' | 'emph' | 'code'

/** Texto plano con marcas opcionales (el texto se escapa al compilar). */
export interface TextNode {
  type: 'text'
  text: string
  // `| undefined` explícito por `exactOptionalPropertyTypes` (los datos vienen de
  // zod al deserializar, cuyo `.optional()` infiere `… | undefined`).
  marks?: Mark[] | undefined
}

/** Matemática en línea; `tex` es LaTeX de math **crudo** (no se escapa). */
export interface MathInlineNode {
  type: 'mathInline'
  tex: string
}

/**
 * Referencia cruzada a un objeto referenciable (sección/teorema/ecuación/tabla) **por
 * su identidad** (`target` = el `id` del objeto, no una clave a mano). El compilador
 * resuelve `id → \label` y emite `\cref`. Por compatibilidad también resuelve un
 * `target` que sea una `label` custom directa.
 */
export interface RefNode {
  type: 'ref'
  target: string
}

/**
 * **Cita bibliográfica** a una o más claves BibTeX (`keys`). `style` captura el uso
 * **semántico** que biblatex distingue (best practice sobre el `\cite` pelado):
 * `parenthetical` → `\parencite` («(Autor, año)» / «[1]»), `textual` → `\textcite`
 * («Autor (año)», la cita es parte de la oración). Default `parenthetical`. Requiere un
 * [[BibliographyNode]] con una entrada de esa clave.
 */
export interface CiteNode {
  type: 'cite'
  keys: string[]
  style?: 'parenthetical' | 'textual' | undefined
}

/**
 * **Nota al pie**: marcador en línea cuyo contenido (`text`, texto plano que se escapa) va al
 * pie de página. El número lo asigna LaTeX (`\footnote{…}`); Matex solo modela la intención y la
 * posición. Para HTML sería una nota lateral/al final.
 */
export interface FootnoteNode {
  type: 'footnote'
  text: string
}

export type InlineNode = TextNode | MathInlineNode | RefNode | CiteNode | FootnoteNode

export interface HeadingNode {
  type: 'heading'
  level: 1 | 2 | 3
  content: InlineNode[]
  /** Identidad estable para referenciarlo (la genera Matex; ver [[RefNode]]). */
  id?: string | undefined
  /** Etiqueta LaTeX **custom** opcional (clave legible en el `.tex`; si no, se usa `id`). */
  label?: string | undefined
}

/**
 * **Parte** (`\part`): la división **más alta** de un documento largo, por encima del capítulo
 * (ME-46). Agrupa capítulos/secciones que vienen después. Válida en cualquier clase (LaTeX
 * permite `\part` en article/report/book); se numera en **romanos** (I, II, …), su propio
 * contador. No cambia la jerarquía de `heading` (que sigue en 1–3): una parte se *inserta*
 * arriba, no remapea los niveles existentes.
 */
export interface PartNode {
  type: 'part'
  content: InlineNode[]
  /** Identidad estable para referenciarla (como headings/teoremas). */
  id?: string | undefined
  /** Etiqueta LaTeX custom opcional. */
  label?: string | undefined
}

export interface ParagraphNode {
  type: 'paragraph'
  content: InlineNode[]
}

/** Ítem de lista: contiene bloques (normalmente un párrafo; puede anidar listas). */
export interface ListItemNode {
  type: 'listItem'
  content: BlockNode[]
}

export interface BulletListNode {
  type: 'bulletList'
  items: ListItemNode[]
}

export interface OrderedListNode {
  type: 'orderedList'
  items: ListItemNode[]
}

/**
 * Una **fila** de una fórmula en bloque: la unidad numerada/referenciable. `tex` es
 * LaTeX de math **crudo/opaco** (con `&` para alinear, si aplica). `id` es la identidad
 * estable (se pega a la fila-objeto, no a un índice) → referencia por línea robusta.
 */
export interface EquationRow {
  tex: string
  /** Esta fila lleva número. */
  numbered?: boolean | undefined
  /** Identidad estable para referenciar esta fila. */
  id?: string | undefined
  /** Clave LaTeX custom opcional. */
  label?: string | undefined
}

/**
 * Matemática en bloque = **lista de filas** (mismo patrón que `table`→rows). El modelo
 * captura la **intención** (¿alinear en `&` o centrar?); el entorno LaTeX concreto lo
 * **deriva el compilador**: 1 fila → `equation`/`\[…\]`; ≥2 filas → `align`/`gather`
 * (según `aligned`) y su variante `*` si ninguna fila está numerada. La numeración,
 * label e id son **por fila**.
 *
 * `aligned` **default true** (alineadas en `&`); ausente = alineado. `aligned:false` =
 * centradas. Con una sola fila es indiferente (no hay nada que alinear).
 */
export interface MathDisplayNode {
  type: 'mathDisplay'
  /** Alinear las filas en `&` (default true); `false` = centradas. */
  aligned?: boolean | undefined
  rows: EquationRow[]
}

/**
 * Un **paso** de una derivación: la matemática (`tex`) + una **justificación** opcional (por qué
 * este paso, a la derecha) + `boxed` para recuadrar (típico del resultado). El `tex` puede llevar
 * `&` para alinear en el `=` con los demás pasos (como `align`).
 */
export interface DerivationStep {
  tex: string
  note?: string | undefined
  boxed?: boolean | undefined
}

/**
 * **Derivación compacta**: una secuencia de **pasos** (matemática `tex` + justificación de texto),
 * alineados en `=` como `align`. Para cadenas de ecuaciones algebraicas. Para razonamientos con
 * contenido rico en ambas columnas, ver `ReasoningNode`. Ejemplo bandera de la tesis (LE-02/03).
 */
export interface DerivationNode {
  type: 'derivation'
  title?: string | undefined
  steps: DerivationStep[]
  id?: string | undefined
  label?: string | undefined
}

/**
 * Una **fila** de un razonamiento en dos columnas: `left` y `right` son **contenido de bloque
 * completo** (párrafos con texto/fórmulas, math en bloque, tablas, figuras, incluso otro
 * razonamiento) → recursivo. `boxed` recuadra la fila (destacar un resultado).
 */
export interface ReasoningRow {
  left: BlockNode[]
  right: BlockNode[]
  boxed?: boolean | undefined
}

/**
 * **Razonamiento en dos columnas**: filas de pasos, cada una con una celda **izquierda** y una
 * **derecha**, ambas de contenido rico arbitrario (texto+fórmulas, tablas, imágenes, gráficos…).
 * Es un **layout semántico** (no una tabla con bordes): cada backend lo renderiza distinto (PDF con
 * dos minipages por fila; HTML con un grid de 2 columnas). Para cadenas de ecuaciones simples y
 * alineadas conviene `DerivationNode`.
 */
export interface ReasoningNode {
  type: 'reasoning'
  title?: string | undefined
  rows: ReasoningRow[]
  id?: string | undefined
  label?: string | undefined
}

/** Variantes de entornos tipo teorema (amsthm). `proof` no se numera. */
export type TheoremVariant =
  | 'theorem'
  | 'lemma'
  | 'proposition'
  | 'corollary'
  | 'definition'
  | 'example'
  | 'remark'
  | 'proof'

/**
 * Entorno tipo teorema (teorema/lema/definición/…/demostración). Contiene bloques
 * (párrafos, math, listas). `title` es el texto opcional entre corchetes.
 */
export interface TheoremNode {
  type: 'theorem'
  variant: TheoremVariant
  title?: string | undefined
  /** Identidad estable para referenciarlo. */
  id?: string | undefined
  /** Etiqueta LaTeX custom opcional. */
  label?: string | undefined
  /**
   * Solo para `proof` diferido: etiqueta del teorema que demuestra. Genera el
   * encabezado `Demostración del \cref{<proves>}` (número automático + link).
   */
  proves?: string | undefined
  content: BlockNode[]
}

/** Alineación de una columna de tabla (capa 2: intención de presentación). */
export type TableAlign = 'left' | 'center' | 'right'

/** Celda de tabla: contenido en línea (texto, matemática, referencia). */
export interface TableCellNode {
  type: 'tableCell'
  content: InlineNode[]
}

export interface TableRowNode {
  type: 'tableRow'
  cells: TableCellNode[]
}

/**
 * Tabla. La estructura (filas/celdas) es semántica (capa 1); `align`/`header` son
 * **intención de presentación** (capa 2), enums con default = canon (booktabs).
 * **No hay líneas verticales**: son un anti-patrón del canon → una grilla con
 * verticales se hace con `rawLatex`, no acá.
 */
export interface TableNode {
  type: 'table'
  rows: TableRowNode[]
  /** Alineación por columna; si falta o es corta, `left` por defecto. */
  align?: TableAlign[] | undefined
  /** La primera fila es encabezado (negrita + `\midrule` debajo). */
  header?: boolean | undefined
  /** Reglas horizontales (booktabs, default) o ninguna. Nunca verticales. */
  rules?: 'none' | 'horizontal' | undefined
  caption?: string | undefined
  /** Identidad estable para referenciarla. */
  id?: string | undefined
  /** Etiqueta LaTeX custom opcional. */
  label?: string | undefined
}

/**
 * Figura: **flotante** con imagen + epígrafe. Semánticamente es "imagen con caption
 * referenciable", **no** un sistema de layout — la ubicación la decide LaTeX (float).
 * `src` es el nombre del archivo de imagen dentro del proyecto (base64 en `files`).
 * `width` es la fracción del **ancho disponible** del contenedor (0–1, capa 2 de
 * presentación); si falta, ancho completo. La numeración/`\cref` la maneja el `\caption` (por eso referenciable ⇒ caption).
 */
/** Estilo de trazo de una curva (capa 2 de presentación). */
export type PlotLineStyle = 'solid' | 'dashed' | 'dotted'

/** Grosor de trazo de una curva (semántico; cada backend lo traduce). Pisa el grosor del rol. */
export type PlotLineWidth = 'xthin' | 'thin' | 'normal' | 'thick' | 'xthick'

/**
 * **Rol semántico** de una curva (ME-38): declara *qué representa* (no cómo se ve). Un **tema**
 * (`plotTheme.ts`) lo resuelve a color/grosor/guion por backend. El `color`/`style` explícito
 * SIEMPRE gana (override de control fino), así que el rol nunca rompe lo existente.
 */
export type PlotRole = 'primary' | 'secondary' | 'derivative' | 'auxiliary' | 'highlight' | 'region'

/**
 * **Curva paramétrica** `(x(t), y(t))` con `t ∈ [tmin, tmax]`. Las expresiones están en la
 * variable `t` (ver `plotExpr.ts`, `parseExpr(..., 't')`). Se dibuja en el mismo eje cartesiano.
 */
export interface PlotParametric {
  x: string
  y: string
  tmin: number
  tmax: number
  legend?: string | undefined
  color?: string | undefined
  style?: PlotLineStyle | undefined
  width?: PlotLineWidth | undefined
  /** Ocultar sin borrar (no se dibuja ni entra en la leyenda). */
  disabled?: boolean | undefined
}

/**
 * **Curva polar** `r(θ)` con el ángulo `θ ∈ [tmin, tmax]` (radianes). Se compila y previsualiza
 * como la paramétrica `(r·cos θ, r·sin θ)` sobre el eje cartesiano (rosas, cardioides, espirales).
 * La expresión `r` está en la variable `t` (el ángulo).
 */
export interface PlotPolar {
  r: string
  tmin: number
  tmax: number
  legend?: string | undefined
  color?: string | undefined
  style?: PlotLineStyle | undefined
  width?: PlotLineWidth | undefined
  /** Ocultar sin borrar (no se dibuja ni entra en la leyenda). */
  disabled?: boolean | undefined
}

/**
 * **Curva implícita** `F(x,y)=0`: `equation` es "LHS = RHS" (o solo `F`, con `=0` implícito) en
 * las variables `x, y`. No hay forma explícita → se computa la curva (marching squares, ver
 * `core/graphics/implicit.ts`) y se emite como polilíneas (pgfplots + SVG). Círculos, cónicas
 * rotadas, curvas trascendentes (`sin(x)+sin(y)=1`), etc.
 */
export interface PlotImplicit {
  equation: string
  legend?: string | undefined
  color?: string | undefined
  style?: PlotLineStyle | undefined
  width?: PlotLineWidth | undefined
  disabled?: boolean | undefined
}

/**
 * Referencia a una curva del gráfico por familia + índice (para intersecciones). `xaxis`/`yaxis`
 * son **pseudo-curvas** (los ejes `y=0` / `x=0`): intersecar con ellas da raíces / ordenada al
 * origen. Para los ejes `i` se ignora.
 */
export type CurveKind = 'function' | 'implicit' | 'parametric' | 'polar' | 'xaxis' | 'yaxis'
export interface CurveRef {
  kind: CurveKind
  i: number
}

/**
 * **Intersección de dos curvas** `a ∩ b`: se **computan en JS** los puntos donde se cruzan
 * (cada curva → polilíneas; intersección de segmentos) y se marcan como puntos. Sirve para
 * cónicas/geometría (recta ∩ circunferencia, dos parábolas…) y análisis (dónde `f = g`).
 * No hay forma cerrada general → mismo enfoque que las implícitas: calcular y emitir coordenadas.
 */
export interface PlotIntersection {
  a: CurveRef
  b: CurveRef
  label?: string | undefined
  color?: string | undefined
  /** Anotar cada punto con sus coordenadas `(x, y)` (info extra opcional). */
  showCoords?: boolean | undefined
  disabled?: boolean | undefined
}

/**
 * Una **rama** de una función partida: `expr` válida en el intervalo `[from, to]`. Las
 * ramas se toman semiabiertas `[from, to)` (la siguiente "posee" el empalme), salvo la
 * última que es cerrada — así el marcado de continuidad ●/○ es consistente.
 */
export interface PlotPiece {
  expr: string
  from: number
  to: number
}

/** Una función a graficar: expresión normalizada `y=f(x)` (ver `plotExpr.ts`) + leyenda. */
export interface PlotFunction {
  expr: string
  /**
   * **Función definida por datos** (ME-45 nivel 2): en vez de `expr`, la función es la **interpolación**
   * (spline/monótona/Lagrange/regresión — sólo métodos que son función) de una serie de datos. Así una
   * "tabla de valores" se vuelve una `f(x)` de primera clase: acepta tangente/área/raíces/hover. Cuando
   * está presente, `expr` se ignora. Los métodos de *trayectoria* (polyline/smooth) no aplican (no son función).
   */
  fromData?: { series: number; method: PlotInterpMethod; degree?: number | undefined } | undefined
  legend?: string | undefined
  /** Ocultar sin borrar: no se dibuja ni entra en la leyenda (pero conserva su color). */
  disabled?: boolean | undefined
  /** Restringe esta curva a `[a, b]` (para funciones a trozos por composición). */
  domain?: [number, number] | undefined
  /** **Rol semántico** (ME-38): el tema resuelve el estilo. `color`/`style` explícito lo pisa. */
  role?: PlotRole | undefined
  /** Color elegido (nombre de la paleta, ver `plotColors.ts`); si falta, lo resuelve el rol/índice. */
  color?: string | undefined
  /** Estilo de trazo; `solid` (o ausente) = continuo. Pisa el guion del rol. */
  style?: PlotLineStyle | undefined
  /** **Grosor** de la línea; pisa el grosor del rol/default. */
  width?: PlotLineWidth | undefined
  /**
   * Si tiene ≥1 rama, la función es **partida**: se dibuja cada rama en su intervalo y la
   * leyenda es un `\begin{cases}`. Cuando está presente, `expr` se ignora.
   */
  pieces?: PlotPiece[] | undefined
  /** Marcar la continuidad en los empalmes: ● (incluido) y ○ (excluido) donde hay salto. */
  markJumps?: boolean | undefined
  /** **Auto-marcar raíces** (cruces con el eje x), calculadas numéricamente (ME-39). */
  markRoots?: boolean | undefined
  /** **Auto-marcar extremos** (máx/mín por f′=0), calculados numéricamente (ME-39). */
  markExtrema?: boolean | undefined
  /** **Auto-marcar inflexiones** (f″=0), calculadas numéricamente (ME-39). */
  markInflections?: boolean | undefined
  /** **Auto-marcar asíntotas** (verticales por polos, horizontales/oblicuas por límites) (ME-39). */
  markAsymptotes?: boolean | undefined
  /** **Auto-marcar la ordenada al origen** `(0, f(0))` si `0` está en el dominio (ME-39). */
  markYIntercept?: boolean | undefined
  /** Mostrar las **coordenadas / ecuación** de los rasgos auto-detectados (raíces, extremos, asíntotas). */
  featureCoords?: boolean | undefined
  /** Dibujar también la **función inversa** (reflejo del gráfico sobre `y = x`) (ME-40). */
  inverse?: boolean | undefined
  /** **Etiqueta flotante** con la fórmula al final del trazo (estilo Desmos), sin leyenda aparte (ME-40). */
  endLabel?: boolean | undefined
  /** Sombrear el **semiplano** respecto de la curva: `above` = `y > f(x)`, `below` = `y < f(x)` (ME-41). */
  shade?: 'above' | 'below' | undefined
}

/**
 * **Área sombreada** sobre `[from, to]`. Por defecto, bajo la función `fn` (integral
 * definida, cerrada al eje). Si se da `toFn`, es el **área entre** las curvas `fn` y `toFn`.
 * Los índices refieren a `functions`.
 */
/**
 * **Textura** de relleno de un área (para distinguir varias que se superponen). `solid` (default)
 * = color translúcido; el resto son tramas. Cada backend la traduce (pgfplots `patterns` / SVG
 * `<pattern>`). Nombres semánticos, no de un backend concreto.
 */
export type AreaPattern = 'solid' | 'lines' | 'lines-alt' | 'crosshatch' | 'dots' | 'grid' | 'horizontal' | 'vertical'

export interface PlotArea {
  fn: number
  from: number
  to: number
  /** Curva superior para "área entre curvas"; si falta, el área es bajo `fn` (al eje). */
  toFn?: number | undefined
  /** Textura del relleno (default `solid`). */
  pattern?: AreaPattern | undefined
  /** Anotar el **valor calculado** (integral definida `∫`, o `∫(f−g)` si es entre curvas). */
  showValue?: boolean | undefined
  /** Límites como **expresión** (pueden usar parámetros, p. ej. `to = a`): el resolver los evalúa
   *  → `from`/`to`. Con un slider, el área crece/decrece en vivo (ME-36). Ver [[parameters]]. */
  fromExpr?: string | undefined
  toExpr?: string | undefined
  /** Mostrar la **suma de Riemann** (rectángulos por izquierda/derecha/medio) o **trapecios** como
   *  recurso didáctico de "construir la integral"; `n` = cantidad de subintervalos (ME-40). */
  riemann?: 'left' | 'right' | 'mid' | 'trapezoid' | undefined
  riemannN?: number | undefined
  /** Dónde ubicar el rótulo del valor (`∫`/`Σ`): `auto` (centroide, default), `above` (arriba) o
   *  `below` (abajo) para despejarlo de la curva/otros rótulos (ME-34). */
  labelPos?: 'auto' | 'above' | 'below' | undefined
}

/**
 * **Cónica semántica** (ME-42): se declara por su *definición geométrica* (centro, radio, focos,
 * semiejes…) y el compilador genera la curva (muestreo paramétrico en JS → coordenadas a los
 * backends, como implícitas/interpolación). `angle` (grados) rota respecto del centro.
 */
export interface PlotConic {
  kind: 'circle' | 'ellipse' | 'parabola' | 'hyperbola'
  /** Centro (círculo/elipse/hipérbola) o **vértice** (parábola). */
  cx: number
  cy: number
  /** Radio (círculo). */
  r?: number | undefined
  /** Semiejes (elipse: a horizontal, b vertical; hipérbola: a real, b imaginario). */
  a?: number | undefined
  b?: number | undefined
  /** Parábola: distancia focal `p` (>0) y eje/apertura. */
  p?: number | undefined
  opens?: 'up' | 'down' | 'left' | 'right' | undefined
  /** Rotación en grados (círculo la ignora). */
  angle?: number | undefined
  legend?: string | undefined
  color?: string | undefined
  style?: PlotLineStyle | undefined
  width?: PlotLineWidth | undefined
  disabled?: boolean | undefined
}

/** Punto marcado `(x, y)` con etiqueta opcional (raíces, extremos, intersecciones). */
export interface PlotPoint {
  x: number
  y: number
  label?: string | undefined
  /** Punto **abierto** (círculo hueco) para indicar valor no incluido; default cerrado. */
  open?: boolean | undefined
  /**
   * **Anclado a la función `fn`** (índice, como `area.fn`/`tangent.fn`): el punto vive *sobre* la
   * curva → la `y` se **computa** `= f(x)` en cada backend (JS), ignorando la `y` almacenada. Sirve
   * para marcar un valor de la propia función (raíz, `f(a)`) sin recalcularlo a mano.
   */
  fn?: number | undefined
  /** `x` como **expresión** (puede usar parámetros): el resolver la evalúa → `x`. Anclado a `fn`,
   *  el punto **recorre la curva** al mover un slider (ME-36). */
  xExpr?: string | undefined
  /** `y` como **expresión** (puede usar parámetros): el resolver la evalúa → `y`. Ignorado si el
   *  punto está anclado a `fn` (ahí `y = f(x)`). */
  yExpr?: string | undefined
}

/** Línea vertical en `x = x` (asíntota, límite de integración, valor destacado). */
export interface PlotVLine {
  x: number
  label?: string | undefined
  /** `x` como expresión (puede usar parámetros): marcador vertical móvil con un slider (ME-36). */
  xExpr?: string | undefined
}

/** Línea horizontal en `y = y` (asíntota horizontal, valor destacado). */
export interface PlotHLine {
  y: number
  label?: string | undefined
  /** `y` como expresión (puede usar parámetros): marcador horizontal móvil con un slider (ME-36). */
  yExpr?: string | undefined
}

/** Texto libre anotado en una posición `(x, y)` del gráfico. */
export interface PlotText {
  x: number
  y: number
  text: string
}

/**
 * **Recta tangente** a la función `fn` en `x = at` (visualiza la derivada). La pendiente se
 * calcula numéricamente `f'(at)` y se dibuja `y = f(at) + f'(at)(x − at)` con un punto en el
 * punto de tangencia.
 */
export interface PlotTangent {
  fn: number
  at: number
  label?: string | undefined
  /** Anotar la **pendiente calculada** `f'(x₀)` (la derivada, valor numérico). */
  showValue?: boolean | undefined
  /** `at` como **expresión** (puede usar parámetros, p. ej. `at = a`): el resolver la evalúa → `at`.
   *  Con un slider, la **tangente se desliza** por la curva = la derivada en vivo (ME-36). */
  atExpr?: string | undefined
  /** Dónde ubicar el rótulo `f'`: `auto` (junto al punto, default), `above` o `below` (ME-34). */
  labelPos?: 'auto' | 'above' | 'below' | undefined
}

/**
 * **Serie de datos** (scatter): una lista de puntos `(x, y)` que se dibujan con marcas y,
 * opcionalmente, se unen con una línea. Para graficar datos experimentales/tabla, junto a
 * las funciones en el mismo eje cartesiano.
 */
/**
 * **Método de interpolación / ajuste / trazado** de una serie de datos (ME-45). Tres categorías
 * semánticas: **función y=f(x)** que pasa por los puntos (ordena por x) — `linear`/`step`/`spline`/
 * `monotone` (PCHIP)/`polynomial`; **ajuste** por mínimos cuadrados que NO pasa por los puntos —
 * `regression` (polinómica) / `reg-exp` / `reg-log` / `reg-power`; y **curva/trayectoria por orden**
 * (paramétrica, puede ser cerrada, NO tiene por qué ser función) — `polyline` / `smooth` (Catmull-Rom).
 * Todo se computa en JS → coordenadas a los backends.
 */
export type PlotInterpMethod =
  | 'linear'
  | 'step'
  | 'spline'
  | 'monotone'
  | 'polynomial'
  | 'regression'
  | 'reg-exp'
  | 'reg-log'
  | 'reg-power'
  | 'polyline'
  | 'smooth'

export interface PlotDataSeries {
  points: [number, number][]
  legend?: string | undefined
  /** Color elegido (nombre de la paleta); si falta, sigue el ciclo después de las funciones. */
  color?: string | undefined
  /** Unir los puntos con una línea (además de las marcas). */
  line?: boolean | undefined
  /** Estilo de la línea (si `line`); `solid` (o ausente) = continua. */
  style?: PlotLineStyle | undefined
  /** **Grosor** de la línea/curva interpolada. */
  width?: PlotLineWidth | undefined
  /** **Interpolar / ajustar / trazar** los puntos con este método (traza la curva además de las marcas). */
  interpolate?: PlotInterpMethod | undefined
  /** Grado del polinomio de **regresión** (default 1 = recta); ignorado en los otros métodos. */
  interpDegree?: number | undefined
  /** **Cerrar** la curva (une el último punto con el primero); solo para trayectorias (`polyline`/`smooth`). */
  closed?: boolean | undefined
  /** Marca hueca (○) en vez de llena (●). */
  open?: boolean | undefined
  /** Ocultar sin borrar (no se dibuja ni entra en la leyenda). */
  disabled?: boolean | undefined
}

/**
 * Posición de la leyenda, **semántica** (backend-agnóstica): cada backend la traduce (pgfplots
 * `legend pos`, CSS, etc.). No usar vocabulario de un backend concreto en el modelo.
 */
export type PlotLegendPos = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'outside-right'

/**
 * Especificación de un **gráfico de funciones** (se compila a pgfplots; se previsualiza
 * con un evaluador JS). Cartesiano `y=f(x)`, una variable `x`. Ver
 * `matex/03-modelo-semantico/graficos-funciones.md`.
 */
export interface PlotSpec {
  functions: PlotFunction[]
  /** Dominio `[xmin, xmax]`. */
  domain: [number, number]
  /** Rango `[ymin, ymax]` (automático si falta). */
  range?: [number, number] | undefined
  xlabel?: string | undefined
  ylabel?: string | undefined
  grid?: boolean | undefined
  legend?: boolean | undefined
  /** **Leyenda de rasgos** (ME-43): panel que lista raíces/extremos/asíntotas detectados con sus coords. */
  featureLegend?: boolean | undefined
  /** Título del gráfico (sobre el eje; distinto del epígrafe de la figura). */
  title?: string | undefined
  /** Densidad de muestreo de las curvas (default 100); más = más suave, más pesado. */
  samples?: number | undefined
  /** Marcas del eje x en múltiplos de π/2 (para funciones trigonométricas). */
  piTicks?: boolean | undefined
  /** Ocultar los números/marcas de los ejes (default: se muestran, como pgfplots). */
  hideTicks?: boolean | undefined
  /** Posición de la leyenda; default `north west`. */
  legendPos?: PlotLegendPos | undefined
  /** Notación en que se escriben las funciones (para reabrir el editor en el modo justo). */
  syntax?: 'ascii' | 'latex' | undefined
  /** Aspecto 1:1 (una unidad en x = una en y) → círculos redondos, ángulos fieles. */
  equalAxes?: boolean | undefined
  /** Áreas sombreadas bajo una función (integrales definidas). */
  areas?: PlotArea[] | undefined
  /** Puntos marcados con etiqueta (raíces, extremos, intersecciones). */
  points?: PlotPoint[] | undefined
  /** Líneas verticales (asíntotas, valores destacados). */
  vlines?: PlotVLine[] | undefined
  /** Líneas horizontales (asíntotas horizontales, valores destacados). */
  hlines?: PlotHLine[] | undefined
  /** Rectas tangentes a una función en un punto (derivada). */
  tangents?: PlotTangent[] | undefined
  /** Series de datos (scatter) dibujadas junto a las funciones. */
  data?: PlotDataSeries[] | undefined
  /** Curvas paramétricas `(x(t), y(t))`. */
  parametrics?: PlotParametric[] | undefined
  /** Curvas polares `r(θ)` (se emiten como paramétricas sobre el eje cartesiano). */
  polars?: PlotPolar[] | undefined
  /** Curvas implícitas `F(x,y)=0` (se computan por marching squares → polilíneas). */
  implicits?: PlotImplicit[] | undefined
  /** **Cónicas semánticas** (círculo/elipse/parábola/hipérbola por su definición geométrica) (ME-42). */
  conics?: PlotConic[] | undefined
  /** Intersecciones entre dos curvas (puntos calculados en JS). */
  intersections?: PlotIntersection[] | undefined
  /** Textos libres anotados en posiciones `(x, y)`. */
  texts?: PlotText[] | undefined
  /**
   * **Parámetros** con nombre que se pueden usar en las expresiones (`y = a x^2 + b`). El backend
   * sustituye el `value` actual (materialización); `min`/`max`/`step` son hints para el **slider**
   * (interactividad de exploración: editor en vivo, HTML por frames). El papel/PDF recibe el valor
   * congelado. Realiza el patrón generativo↔materializado (como zoom/freeze). Ver ME-36.
   */
  parameters?: PlotParameter[] | undefined
}

/** Un **parámetro** con nombre de un gráfico (GeoGebra-like): valor actual + rango explorable. */
export interface PlotParameter {
  /** Nombre-identificador usado en las expresiones (p. ej. `a`, `k`, `omega`). */
  name: string
  /** Valor actual (lo que se materializa a LaTeX/PDF y el default del slider). */
  value: number
  /** Extremos del rango explorable por el slider (opcionales). */
  min?: number | undefined
  max?: number | undefined
  /** Paso del slider (opcional; default lo elige el adaptador). */
  step?: number | undefined
}

/**
 * **Forma** de un gráfico de datos categóricos (la *intención* elige la forma). Todas
 * comparten la misma materia prima (categorías + series de valores): `bar` (barras
 * agrupadas, A1 comparar), `stackedBar` (apiladas, A2 composición por barra), `hbar`
 * (horizontales), `line` (línea/tendencia sobre categorías), `pie` (torta, A2 repartir el
 * todo). Sumar una forma = un enum + un caso, **no** un módulo. Ver
 * `matex/03-modelo-semantico/graficos-cartografia-semantica.md`.
 */
export type ChartForm = 'bar' | 'stackedBar' | 'hbar' | 'line' | 'pie'

/** Una **serie** de un gráfico categórico: un valor por categoría (barras agrupadas = varias series). */
export interface ChartSeries {
  label?: string | undefined
  /** Un valor por categoría (misma longitud que `categories`). */
  values: number[]
  /** Color de la serie (nombre de la paleta); si falta, auto por índice. */
  color?: string | undefined
}

/**
 * **Gráfico de datos categóricos** (familia A1/A2). `categories` es el eje categórico;
 * `series` son las magnitudes (1 serie = barras/torta simples; ≥2 = barras agrupadas; la
 * torta usa la 1ª serie). Compila a pgfplots `ybar` (barras) o `pgf-pie` (torta); se
 * previsualiza en SVG. **No tiene ejes cartesianos** (a diferencia de `PlotSpec`).
 */
export interface ChartSpec {
  form: ChartForm
  categories: string[]
  series: ChartSeries[]
  title?: string | undefined
  /** Mostrar leyenda (barras: por serie; torta: por sector). */
  legend?: boolean | undefined
  /** Rótulo del eje de valores (solo barras). */
  ylabel?: string | undefined
}

/** Parte "imagen" de una figura (archivo del proyecto). */
export interface FigureImage {
  kind: 'image'
  /** Nombre del archivo de imagen en el proyecto (p. ej. `diagrama.png`). */
  src: string
  /** Fracción del **ancho disponible** (0–1). Si falta, ancho completo. */
  width?: number | undefined
  /** Subepígrafe (para subfiguras, ≥2 partes). */
  subcaption?: string | undefined
  id?: string | undefined
  label?: string | undefined
}

/** Parte "gráfico de funciones" de una figura (familia A4 — relación). */
export interface FigurePlot {
  kind: 'plot'
  spec: PlotSpec
  width?: number | undefined
  subcaption?: string | undefined
  id?: string | undefined
  label?: string | undefined
}

/** Parte "gráfico de datos categóricos" de una figura (familia A1/A2 — comparación/composición). */
export interface FigureChart {
  kind: 'chart'
  spec: ChartSpec
  width?: number | undefined
  subcaption?: string | undefined
  id?: string | undefined
  label?: string | undefined
}

/** Forma de un gráfico de **distribución** (familia A3): histograma o boxplot. */
export type DistForm = 'histogram' | 'boxplot'

/** Un **conjunto de muestras crudas** (una distribución). Varios = comparar distribuciones. */
export interface DistSeries {
  label?: string | undefined
  /** Datos crudos (no agregados): el histograma los binea, el boxplot calcula sus cuartiles. */
  samples: number[]
  color?: string | undefined
}

/**
 * **Gráfico de distribución** (familia A3 — ¿cómo se dispersan los datos?). A diferencia del
 * categórico (categorías × valores), la materia prima son **muestras crudas**: el histograma
 * las agrupa en `bins` y el boxplot calcula sus cuartiles. Se computa en JS (como implícitas/
 * intersecciones) → coordenadas a pgfplots + SVG. Ver `graficos-cartografia-semantica.md`.
 */
export interface DistSpec {
  form: DistForm
  data: DistSeries[]
  /** Cantidad de bins del histograma (default: automático). */
  bins?: number | undefined
  title?: string | undefined
  xlabel?: string | undefined
  ylabel?: string | undefined
  legend?: boolean | undefined
}

/** Parte "gráfico de distribución" de una figura (familia A3 — histograma/boxplot). */
export interface FigureDist {
  kind: 'distribution'
  spec: DistSpec
  width?: number | undefined
  subcaption?: string | undefined
  id?: string | undefined
  label?: string | undefined
}

/**
 * Punta de flecha de una arista: **qué tipo de morfismo es**, no cómo se dibuja (LE-02).
 * `arrow` = morfismo genérico · `mono` = inyectivo (flecha con gancho) · `epi` = sobreyectivo
 * (doble punta) · `mapsto` = asignación de elementos. Cada backend elige el trazo.
 */
export type DiagramTip = 'arrow' | 'mono' | 'epi' | 'mapsto'
/** Trazo de la arista. */
export type DiagramEdgeStyle = 'solid' | 'dashed' | 'dotted'

/** Un **nodo** de un diagrama (Dominio B): una etiqueta matemática ubicada en una grilla (fila×columna). */
export interface DiagramNode {
  /** Identidad estable (referida por las aristas). */
  id: string
  /** Etiqueta (matemática `tex`, p. ej. `A`, `X \times Y`). */
  label: string
  /** Posición en la grilla (0-based). */
  row: number
  col: number
}

/** Una **arista** (morfismo) entre dos nodos del diagrama, con etiqueta y estilo opcionales. */
export interface DiagramEdge {
  /** `id` del nodo origen. */
  from: string
  /** `id` del nodo destino. */
  to: string
  /** Etiqueta del morfismo (matemática `tex`, p. ej. `f`, `\varphi`). */
  label?: string | undefined
  tip?: DiagramTip | undefined
  style?: DiagramEdgeStyle | undefined
  /** Curvar la flecha (para morfismos paralelos): a izquierda/derecha. */
  bend?: 'left' | 'right' | undefined
}

/** Forma de un diagrama estructural (Dominio B). Por ahora solo **conmutativo** (`tikz-cd`). */
export type DiagramForm = 'commutative'

/**
 * **Diagrama estructural** (Dominio B — modelo *grafo*: nodos + aristas). A diferencia de los
 * gráficos cuantitativos (A1–A4, que parten de datos numéricos), acá la materia prima son
 * **objetos y morfismos**: un diagrama conmutativo. Los nodos se ubican en una **grilla**
 * (fila×columna) y las aristas los conectan con etiquetas. Compila a **`tikz-cd`**; se
 * previsualiza en SVG. Ver `graficos-cartografia-semantica.md` (B4).
 */
export interface DiagramSpec {
  form: DiagramForm
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  title?: string | undefined
}

/** Parte "diagrama estructural" de una figura (Dominio B — conmutativos). */
export interface FigureDiagram {
  kind: 'diagram'
  spec: DiagramSpec
  width?: number | undefined
  subcaption?: string | undefined
  id?: string | undefined
  label?: string | undefined
}

/** Un **nodo** de un árbol (Dominio B, B2): etiqueta + padre (la raíz no tiene padre). */
export interface TreeNode {
  /** Identidad estable (referida como `parent` por los hijos). */
  id: string
  /** Etiqueta del nodo (texto; puede llevar `$…$` para matemática). */
  label: string
  /** `id` del nodo padre; la **raíz** es el que no tiene `parent`. */
  parent?: string | undefined
}

/** Forma de un árbol (Dominio B). Por ahora solo jerárquico (`forest`). */
export type TreeForm = 'tree'

/**
 * **Árbol** (Dominio B, B2 — jerarquía padre→hijos): taxonomías, organigramas, árboles de
 * derivación/sintaxis. A diferencia del conmutativo (grilla + aristas), la materia prima es una
 * **jerarquía**: nodos con `parent`. Compila a **`forest`**; se previsualiza en SVG con un layout
 * simple (hojas equiespaciadas, internos centrados sobre sus hijos). Ver `…cartografia…` (B2).
 */
export interface TreeSpec {
  form: TreeForm
  /** Lista **plana** de nodos; el orden define el orden de los hermanos. */
  nodes: TreeNode[]
  title?: string | undefined
}

/** Parte "árbol" de una figura (Dominio B — jerarquía). */
export interface FigureTree {
  kind: 'tree'
  spec: TreeSpec
  width?: number | undefined
  subcaption?: string | undefined
  id?: string | undefined
  label?: string | undefined
}

/** Una **parte** de una figura: imagen, gráfico (A4/A1/A2/A3) o estructura (B: diagrama | árbol). */
export type FigureItem = FigureImage | FigurePlot | FigureChart | FigureDist | FigureDiagram | FigureTree

/**
 * Figura: **flotante** con una o varias **partes** (imagen | gráfico) + epígrafe. Es una
 * *lista de partes* (mismo patrón que ecuaciones/tablas): 1 parte = figura simple; ≥2 =
 * subfiguras (rotuladas/referenciables). La ubicación la decide LaTeX (float) — no es un
 * sistema de layout. Ver `matex/03-modelo-semantico/graficos-funciones.md`.
 */
export interface FigureNode {
  type: 'figure'
  caption?: string | undefined
  /** Identidad estable para referenciarla. */
  id?: string | undefined
  /** Etiqueta LaTeX custom opcional. */
  label?: string | undefined
  items: FigureItem[]
}

/**
 * Bloque de **código fuente** (se emite con `listings`; verbatim, no se escapa). `language`
 * es una pista para el resaltado (opcional; `listings` lo usa si lo reconoce).
 */
export interface CodeBlockNode {
  type: 'codeBlock'
  code: string
  language?: string | undefined
}

/**
 * Estilo de citas/bibliografía de **biblatex** (capa 2 de presentación): `numeric`
 * («[1]»), `authoryear` («(Autor, año)»), `alphabetic` («[Aut84]»). Default `numeric`.
 */
export type BibStyle = 'numeric' | 'authoryear' | 'alphabetic'

/**
 * Tipo de una entrada bibliográfica (subconjunto pragmático de biblatex): libro,
 * artículo, capítulo, ponencia, tesis, recurso web, otro. Determina qué campos muestra
 * el editor; se emite como `@book`/`@article`/… en el `.bib`.
 */
export type BibEntryType = 'book' | 'article' | 'incollection' | 'inproceedings' | 'thesis' | 'online' | 'misc'

/**
 * Una **entrada bibliográfica** como **registro estructurado** (no BibTeX crudo): la
 * representación Matex-nativa. `key` es la clave de cita (auto `apellido+año`, editable).
 * Los campos son opcionales y su relevancia depende del `type` (el editor muestra los que
 * corresponden). El compilador **emite el BibTeX** desde esta estructura; el usuario nunca
 * escribe sintaxis `.bib` (aunque puede **importarla**, que se parsea a esta forma).
 */
export interface BibEntry {
  key: string
  type: BibEntryType
  author?: string | undefined
  title?: string | undefined
  year?: string | undefined
  journal?: string | undefined
  booktitle?: string | undefined
  publisher?: string | undefined
  institution?: string | undefined
  volume?: string | undefined
  number?: string | undefined
  pages?: string | undefined
  edition?: string | undefined
  doi?: string | undefined
  url?: string | undefined
  note?: string | undefined
}

/**
 * **Inclusión de un archivo del proyecto** (`\input{target}`): la escotilla *file-based*
 * (hermana de `rawLatex`, pero el LaTeX vive en un archivo `.tex` del proyecto en vez de inline).
 * Para un TikZ complejo, un preámbulo compartido, etc. Ver `matex/03-modelo-semantico/proyecto-multiarchivo.md`.
 */
export interface IncludeNode {
  type: 'include'
  /** Ruta del archivo dentro del proyecto (p. ej. `figuras/tikz1.tex`). */
  target: string
}

/** Tipo de **caja / callout** (destacado): color e intención. Compila a `tcolorbox`. */
export type CalloutVariant = 'note' | 'tip' | 'warning' | 'important'

/**
 * **Caja / callout**: bloque destacado (tipo admonición) con `title` opcional y **contenido de
 * bloques** (párrafos, listas, math…). Para apuntes/ejercicios/notas. Compila a `tcolorbox`.
 */
export interface CalloutNode {
  type: 'callout'
  variant: CalloutVariant
  title?: string | undefined
  content: BlockNode[]
}

/** Válvula de escape: LaTeX crudo que se emite tal cual. */
export interface RawLatexNode {
  type: 'rawLatex'
  latex: string
}

/**
 * **Diapositiva** (ME-23, presentaciones). En un documento con `meta.presentation`, cada `slide` es
 * un **frame** de beamer: título opcional + contenido de bloques arbitrario (prosa, math, listas,
 * figuras/plots, teoremas…). Es el nodo estructural del modo presentación — la tesis semántica
 * llevada a las slides (declarás la diapositiva y su contenido; el backend materializa el frame).
 * Overlays/columnas/temas = fases siguientes (campos opcionales que se irán sumando).
 */
export interface SlideNode {
  type: 'slide'
  title?: string | undefined
  content: BlockNode[]
  /** **Revelado incremental** (overlay): las listas de la diapositiva aparecen ítem por ítem
   *  (`\begin{itemize}[<+->]`). Recurso didáctico clásico de beamer (ME-23, fase 2). */
  reveal?: boolean | undefined
}

/**
 * **Columnas** (ME-23, fase 2): contenido lado a lado dentro de una diapositiva (beamer `columns`).
 * Cada columna lleva su fracción del ancho (`ratio`, 0–1; sin definir = reparto equitativo) y su
 * propio contenido de bloques (texto, figuras, listas…). Fuera de una presentación no aplica.
 */
export interface ColumnsNode {
  type: 'columns'
  columns: { ratio?: number | undefined; content: BlockNode[] }[]
}

export type BlockNode =
  | PartNode
  | HeadingNode
  | ParagraphNode
  | BulletListNode
  | OrderedListNode
  | MathDisplayNode
  | DerivationNode
  | ReasoningNode
  | TheoremNode
  | TableNode
  | FigureNode
  | CodeBlockNode
  | CalloutNode
  | IncludeNode
  | RawLatexNode
  | SlideNode
  | ColumnsNode
  | ExamQuestionNode
  | CvEntryNode
  | PosterBlockNode

/**
 * Un **autor** con su información (para la grilla de autores de la portada): nombre +
 * afiliación/institución y correo opcionales. En LaTeX se arma el bloque `\author` (con
 * `\and` entre autores) a partir de esta estructura.
 */
export interface Author {
  name: string
  affiliation?: string | undefined
  email?: string | undefined
}

/**
 * **Bloque de póster** (ME-23): la unidad de un póster científico — un recuadro con título y
 * contenido arbitrario (texto, fórmulas, figuras, listas). El póster es una **grilla de bloques**;
 * la maquetación (columnas, colores, tamaño A0) la resuelve el backend.
 */
export interface PosterBlockNode {
  type: 'posterBlock'
  title?: string | undefined
  content: BlockNode[]
  /** En qué columna cae (1-based). Sin definir, se reparten en orden. */
  column?: number | undefined
}

/**
 * **Póster** (ME-23): pone el documento en *modo póster* (clase `tikzposter`). Los
 * [[PosterBlockNode]] son sus recuadros; `columns` fija cuántas columnas tiene la grilla.
 */
export interface PosterMeta {
  /** Cantidad de columnas de la grilla (default 2). */
  columns?: number | undefined
}

/**
 * **Entrada de currículum** (ME-23): una línea de la trayectoria — cuándo, qué rol, en qué
 * organización, dónde y un detalle. Es la unidad semántica del CV (`\cventry` en moderncv);
 * el orden y la tipografía los pone el backend.
 */
export interface CvEntryNode {
  type: 'cvEntry'
  /** Período («2020–2024»). */
  period?: string | undefined
  /** Cargo, título o rol. */
  role?: string | undefined
  /** Institución/empresa. */
  org?: string | undefined
  /** Ciudad/lugar. */
  place?: string | undefined
  /** Descripción breve. */
  detail?: string | undefined
}

/**
 * **Currículum** (ME-23): pone el documento en *modo CV* (clase `moderncv`). Los datos de contacto
 * viven acá; las secciones son encabezados y cada ítem de trayectoria es un [[CvEntryNode]].
 */
export interface CvMeta {
  email?: string | undefined
  /** Dirección/ciudad (una línea). */
  address?: string | undefined
  /** Subtítulo bajo el nombre («Lic. en Matemática»). */
  subtitle?: string | undefined
}

/**
 * **Pregunta de examen** (ME-23): el enunciado (bloques), su **puntaje** y —opcional— la
 * **solución**, que se muestra o se oculta según `meta.exam.showSolutions`. Modela la intención
 * («esto vale 20 puntos y así se resuelve»), no la maquetación: el backend elige `exam`/`enumerate`.
 */
export interface ExamQuestionNode {
  type: 'examQuestion'
  /** Puntaje de la pregunta. */
  points?: number | undefined
  /** Enunciado. */
  content: BlockNode[]
  /** Resolución de referencia (se imprime solo en la versión con soluciones). */
  solution?: BlockNode[] | undefined
}

/**
 * **Examen** (ME-23): pone el documento en *modo examen* (clase `exam`). Una sola bandera decide
 * si se imprime la versión **del alumno** o la **con soluciones** — el mismo AST da las dos.
 */
export interface ExamMeta {
  /** Consigna general que va arriba de las preguntas. */
  instructions?: string | undefined
}
// Nota (LE-02/AR-09): la elección **versión del alumno vs. del docente** NO vive en el AST: es
// una **ocasión de emisión** (el mismo examen da las dos). Se pasa por `opts.showSolutions` al
// compilar. Ver `reglas-del-modelo.md` §2 (lugar ③).

/**
 * **Carta** (ME-23): los campos propios de una carta formal. Su presencia pone el documento en
 * *modo carta* (clase `letter`): el contenido pasa a ser el **cuerpo** entre el saludo (`opening`)
 * y la despedida (`closing`), con remitente/destinatario y firma. Es una **familia de documento**,
 * no un bloque — como la presentación, se declara en `meta`.
 */
export interface LetterMeta {
  /** Destinatario (nombre y, opcionalmente, su dirección en líneas siguientes). */
  to?: string | undefined
  toAddress?: string | undefined
  /** Remitente: quién firma y desde dónde. */
  from?: string | undefined
  fromAddress?: string | undefined
  /** Saludo inicial («Estimada colega:»). Default: «Estimado/a:». */
  opening?: string | undefined
  /** Despedida («Saludos cordiales,»). Default: «Saludos cordiales,». */
  closing?: string | undefined
  /** Firma al pie (si falta, se usa `from`). */
  signature?: string | undefined
  /** Adjuntos (`\encl`) y copias (`\cc`). */
  encl?: string | undefined
  cc?: string | undefined
}

/**
 * **Familia del documento** (AR-09): unión **discriminada** por `kind`. Las familias son
 * mutuamente excluyentes por naturaleza (una carta no es un póster), y modelarlas así hace
 * **irrepresentables** los estados ilegales que los flags sueltos permitían (`{letter,
 * presentation}`). Sin `family` (o `undefined`), el documento es un texto normal (article/
 * report/book según `docKind`). Cada `kind` lleva su metadata propia. Ver `reglas-del-modelo.md`.
 */
export type DocumentFamily =
  | { kind: 'presentation' }
  | { kind: 'letter'; letter: LetterMeta }
  | { kind: 'exam'; exam: ExamMeta }
  | { kind: 'cv'; cv: CvMeta }
  | { kind: 'poster'; poster: PosterMeta }

/**
 * **Estructura** del documento: qué divisiones admite. Es la única distinción con consecuencia
 * semántica entre las clases clásicas — el resto (márgenes, cuerpo, filetes) es diseño.
 */
export type DocKind = 'article' | 'report' | 'book'

/**
 * **Familia de diseño** del documento, backend-agnóstica (LE-02). Vocabulario cerrado y chico:
 * `standard` (el look clásico, sobrio), `classic` (más ornamentado, filetes y contrastes) y
 * `modern` (limpio, sans, mínimo). Cada backend la resuelve con lo que tenga: el de LaTeX elige
 * clase y tema (KOMA, tema de beamer, estilo de CV, tema de póster), el de HTML elige su CSS.
 * **No** se guardan nombres de temas de paquetes: eso era el leak que cerró LE-02.
 */
export type DocStyle = 'standard' | 'classic' | 'modern'

/** Color de acento, semántico (nombres de color, no de paquete). */
export type AccentColor = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'grey' | 'black'

/** Tamaño de página del documento. */
export type PaperSize = 'a4' | 'letter'

/** Cuerpo tipográfico base, en puntos. */
export type BaseFontSize = 10 | 11 | 12

/**
 * **Columnas de página**: en cuántas columnas fluye el texto del documento (estilo diario/paper).
 * Es un layout de **salida** (LaTeX `twocolumn`, CSS `column-count`), no de edición: el editor se
 * escribe en una columna y la doble columna aparece en el PDF/HTML. Distinto de `ColumnsNode`
 * (bloque lado-a-lado puntual) y de `PosterMeta.columns` (grilla del póster). Default 1.
 */
export type PageColumns = 1 | 2

/** Metadatos del documento (portada + diseño). `| undefined` por zod/exactOptional. */
export interface DocMeta {
  title?: string | undefined
  /** Autor único (forma simple/compat). Si hay `authors`, se usa esa lista. */
  author?: string | undefined
  /** Varios autores con info (grilla nombre/afiliación/correo). Precede a `author`. */
  authors?: Author[] | undefined
  /** Institución/afiliación general del documento (si no es por-autor). */
  institution?: string | undefined
  /** Resumen del documento → `\begin{abstract}…\end{abstract}`. */
  abstract?: string | undefined
  /** Fecha literal, o dejar sin definir para omitirla. */
  date?: string | undefined
  /** Portada en página propia (`titlepage`): `\maketitle` ocupa una página. */
  titlePage?: boolean | undefined
  /** Índice general (`\tableofcontents`) después de la portada. */
  toc?: boolean | undefined
  /**
   * **Estructura** del documento (LE-02): qué divisiones tiene. `article` = secciones ·
   * `report`/`book` = capítulos (nivel 1). Es una taxonomía de documentos, no de clases LaTeX:
   * el backend HTML la usa igual (jerarquía de encabezados). Default `article`.
   *
   * **Límite actual (ver ME-46):** el modelo tiene **3 niveles de encabezado** y **no** modela
   * `\part` ni front/main/backmatter, así que un `book` hoy llega hasta subsección, sin partes.
   */
  docKind?: DocKind | undefined
  /** **Familia de diseño** (LE-02): el "look" del documento. Cada backend la traduce. */
  style?: DocStyle | undefined
  /** **Color de acento** semántico (LE-02): títulos, filetes, resaltados. Cada backend lo traduce. */
  accent?: AccentColor | undefined
  /** Tamaño de página. Default `a4`. */
  paperSize?: PaperSize | undefined
  /** Cuerpo tipográfico base, en puntos. Default 11. */
  baseFontSize?: BaseFontSize | undefined
  /** **Columnas de página** (1 o 2): el texto fluye en dos columnas estilo paper. Default 1. */
  columns?: PageColumns | undefined
  /** Margen del documento (`geometry`), p. ej. `2.5cm`. Sin definir = sin `geometry` (márgenes de la clase). */
  margin?: string | undefined
  /** Estilo biblatex de las citas/bibliografía (document-level). Default `numeric`. */
  bibStyle?: BibStyle | undefined
  /** Título de la lista de referencias (reemplaza «Referencias»). */
  bibTitle?: string | undefined
  /**
   * **Familia del documento** (AR-09): presentación · carta · examen · CV · póster. Unión
   * discriminada por `kind` → un documento pertenece **a una sola**. Sin `family`, es un texto
   * normal. Reemplaza a los cinco flags sueltos de ME-23 (que permitían estados imposibles).
   */
  family?: DocumentFamily | undefined
}

/** Documento Matex: la raíz del AST. `version` habilita migraciones futuras. */
export interface MatexDoc {
  type: 'doc'
  /**
   * v2: `mathDisplay` pasó de `tex` de bloque a `rows`.
   * v3 (LE-02): se fue la línea cruda `documentclass` y los nombres de temas de paquete;
   * los reemplazan campos semánticos (`docKind`/`style`/`accent`/`paperSize`/`baseFontSize`).
   * v4 (AR-09): los cinco flags de familia (`presentation`/`letter`/`exam`/`cv`/`poster`) se
   * unificaron en `meta.family` (unión discriminada); `exam.showSolutions` pasó a `opts`.
   * Ver `parse` para las migraciones.
   */
  version: 1 | 2 | 3 | 4
  meta?: DocMeta | undefined
  content: BlockNode[]
  /**
   * **Biblioteca de referencias** (nivel documento, no prosa; se preserva fuera de TipTap
   * como `meta`). Se edita en el modal de Bibliografía; las [[CiteNode]] referencian por
   * `key`. `\printbibliography` se emite al final (estilo/título en `meta.bibStyle/bibTitle`).
   * Autocontenida en el `.mtex`. Ver ME-12 para promoverla a recurso compartido (multi-doc).
   */
  references?: BibEntry[] | undefined
}

/** Versión actual del formato del AST (para persistencia/migración). */
export const MATEX_AST_VERSION = 4

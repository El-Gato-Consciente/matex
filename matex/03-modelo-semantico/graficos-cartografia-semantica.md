# Gráficos en Matex — cartografía semántica, modularización y capacidad

> **Estado:** análisis de diseño (2026-07). Define **cómo modelar, modularizar y exponer**
> la visualización en Matex más allá del gráfico cartesiano, y en qué **orden**. No es
> implementación: es el mapa para las próximas fases. Insumos: `../07-informes/informe_graficos_latex_v2.pdf`
> (taxonomía por paquete) + `../07-informes/cartografia_semantica_graficos_latex.md` (taxonomía por intención).
> Continúa a [[graficos-funciones.md]].

## 0. Los dos informes y por qué importa el segundo

- **"Más allá de los ejes cartesianos"** clasifica por **qué paquete dibuja** (pgfplots, tikz-cd,
  circuitikz…). Útil como referencia de carpintería.
- **"Cartografía semántica"** reordena por **la pregunta que el gráfico responde**. Esto **es la
  tesis Matex**: modelamos la **intención** (el qué), el backend deriva el **cómo** (pgfplots/SVG).
  Adoptamos esta taxonomía como columna vertebral del modelo.

**Regla rectora (del informe 2, §4):** *la forma no determina la intención; la intención
determina la forma.* Una barra apilada es "comparación" o "composición" según qué quiera que lea
el lector. → El editor debe ayudar a elegir por **pregunta**, no por catálogo de formas.

## 1. Las diez familias semánticas y dónde está Matex

| Familia | Pregunta | Formas | Backend | **Matex hoy** |
|---|---|---|---|---|
| **A1 Comparación** | ¿cuál es mayor? | barras, columnas | pgfplots `ybar` | ❌ |
| **A2 Composición** | ¿cómo se reparte el todo? | torta, apiladas | pgf-pie / `ybar stacked` | ❌ |
| **A3 Distribución** | ¿cómo se dispersan? | histograma, boxplot | pgfplots `hist`/`boxplot` | ❌ |
| **A4 Relación** | ¿cómo covarían? / ¿qué curva? | **curvas `y=f(x)`**, scatter, paramétricas, polares | pgfplots `\addplot` | ✅ **completo** |
| **B1 Secuencia** | ¿qué pasa después? | flujo, bloques | TikZ `shapes.geometric` | ❌ (rawLatex) |
| **B2 Jerarquía** | ¿quién contiene a quién? | árboles, organigramas | `forest`/`tikz-qtree` | ❌ (rawLatex) |
| **B3 Red** | ¿quién se conecta con quién? | grafos, redes neuronales | TikZ `graphdrawing` | ❌ (rawLatex) |
| **B4 Equivalencia** | ¿qué caminos conmutan? | **conmutativos**, quiver | `tikz-cd` | ❌ (rawLatex) |
| **B5 Temporalidad** | ¿cuándo y con qué deps? | Gantt, timeline | `pgfgantt` | ❌ (rawLatex) |
| **C1 Isomorfismo** | ¿cómo notar un sistema real? | circuitos, moléculas, Feynman | circuitikz/chemfig/tikz-feynman | ❌ (rawLatex) |

**Hallazgo 1 — cubrimos una familia, muy hondo.** Todo el módulo de gráficos actual es **A4**
(relación): curvas continuas + scatter + paramétricas + polares, con áreas/tangentes/π/etc. Que
`PlotSpec` mezcle "funciones" y "datos/scatter" **está bien**: ambos son A4 (relación continua vs
discreta). El backlog de gráficos (ME-17/18/19) **sigue profundizando A4**.

**Hallazgo 2 — el gap es de ancho, no de hondura.** Lo más usado en informes/papers/apuntes es
**A1/A2/A3 (cuantitativo)** y **no existe** en Matex. Es la prioridad de capacidad. B y C son
otro mundo (estructura/notación fija) y mayormente `rawLatex` — salvo **B4 conmutativos** y **B2
árboles**, relevantes para una plataforma de matemática, como candidatos futuros con modelo propio.

## 2. Diagnóstico de la arquitectura actual

- ✅ **Costura correcta:** `FigureNode { items: FigureItem[] }`, `FigureItem` discriminado por
  `kind`. Sumar una familia = un `kind` nuevo. Subfiguras salen gratis.
- ⚠️ **`PlotSpec` es un god-object en su techo:** es el spec de **A4**. Coherente adentro, pero
  **no hay que meterle barras/torta** (A1/A2 son categorías+valores, no `expr(x)` sobre ejes).
- ⚠️ **`plotToLatex` (~200 líneas) vive dentro de `compile.ts` (808).** Cada familia nueva lo
  engorda. Y **`plotSvg.ts` (447) es el backend web del mismo spec**, pero en un archivo lejano →
  agregar algo toca dos lugares distantes.
- ⚠️ **"Datos" está fragmentado** en tres cosas que no comparten nada: `TableNode` (tabla),
  `PlotDataSeries` (scatter), y (faltante) barras. Son la **misma materia prima** (labels+valores)
  con distinta intención. Oportunidad futura de unificar (una tabla de datos "vista como gráfico").

## 3. Modelo objetivo: familia semántica como discriminador

Reencuadrar `FigureItem` para que el `kind` **sea la familia semántica** (o su dominio), con un
spec por familia:

```ts
type FigureItem =
  | { kind: 'image'; src; … }                 // escape: imagen externa
  | { kind: 'relation';   spec: PlotSpec }    // A4  (hoy 'plot' → renombrar)
  | { kind: 'comparison'; spec: BarSpec }     // A1  (nuevo)
  | { kind: 'composition';spec: PieSpec }     // A2  (nuevo)
  | { kind: 'distribution';spec: DistSpec }   // A3  (nuevo, más adelante)
  // Dominio B (modelo grafo nodos+aristas) = esfuerzo grande, futuro:
  // | { kind: 'commutative'; spec: DiagramSpec }  // B4 tikz-cd
```

- **A1/A2 comparten materia prima** (categorías + una o más series de valores) → probablemente un
  `CategoricalData` común, con la **intención** eligiendo la forma (barras vs torta vs apiladas).
  Esto realiza en el modelo el "la intención determina la forma".
- **`figure` queda agnóstico del tipo:** layout, caption, subfiguras. Solo delega cada parte a su
  familia.

## 4. Modularización objetivo (AR-04, concretado)

El gatillo de AR-04 **no era "un 2º backend"** sino **"un 2º tipo de gráfico"**. Estructura:

```
core/graphics/
  figure.ts            → figureToLatex (layout/subfiguras, agnóstico de familia)
  relation/            → A4: compile (pgfplots) + preview (svg) + spec helpers  [mover lo actual]
  comparison/          → A1: compile + preview                                  [nuevo]
  composition/         → A2: compile + preview                                  [nuevo]
  …
```

- **Cada familia co-localiza sus dos emisores** (LaTeX + SVG) → sumar una familia toca **una
  carpeta**, no `compile.ts` + `plotSvg.ts` + editor dispersos.
- `compile.ts` adelgaza: delega `figureItemToLatex(item)` al módulo de la familia.
- Respeta la pureza: `ast.ts`/`parse.ts` siguen sin depender de los backends.

## 5. Reencuadre de UX

**Problema actual:** Insertar ofrece **"Figura (imagen)"** y **"Gráfico de funciones"** como ítems
hermanos e inconexos, cuando **ambos crean un `figure`**. El usuario no ve el concepto contenedor,
y las **subfiguras quedan escondidas**.

**Objetivo:**
1. **"Figura" = único concepto contenedor.** Insertar → **Figura** (una entrada). Adentro se
   **agregan partes tipadas**.
2. **Elegir la parte por intención** (no por forma/paquete): *"¿qué querés mostrar?"* →
   *Comparar categorías (barras) · Repartir un todo (torta) · Una función/relación (cartesiano) ·
   Dispersión (histograma) · Una imagen*. Pedagógicamente enseña a elegir bien la visualización.
3. **El inspector** (panel derecho, ya creado) es el hogar: (a) **nivel figura** (epígrafe + lista
   de partes con agregar/reordenar/subcaption) y (b) **editor de la parte activa** (props de imagen
   / editor A4 / editor de barras…).
4. **"Ejes cartesianos" = propiedad de la familia A4**, no algo universal (una barra tiene eje
   categórico; una torta no tiene ejes).

## 6. Alcance y secuencia recomendada

- **Fase 0 — orden (elegida como primer paso):** *sin capacidades nuevas.* (a) refactor
  `core/graphics/` por familia (sacar A4 de `compile.ts`, co-localizar SVG); (b) reencuadre UX
  "Figura = contenedor de partes tipadas por intención" en el inspector; (c) **rediseñar el panel
  del inspector A4** — hoy quedó **angosto** (no entra toda la info del editor de gráficos): darle
  más ancho y evaluar hacerlo **redimensionable**, y reorganizar los controles para un panel
  vertical (venía de una barra horizontal). Deja la base para crecer limpio y **paga sola** aunque
  no se sumen tipos (compile.ts flaco, UX coherente).
- **Fase 1 — ancho cuantitativo (80/20):** **A1 Comparación (barras)** + **A2 Composición (torta)**
  → `CategoricalData` + pgfplots `ybar`/pgf-pie + preview SVG + editor.
- **Fase 2 — cuantitativo restante:** **A3 Distribución** (histograma/boxplot).
- **Futuro grande (Dominio B):** modelo **grafo** (nodos+aristas) para **B4 conmutativos (tikz-cd)**
  y **B2 árboles** — relevantes para matemática; su propio spec/editor. Conecta con LE-03/ME-20.
- **Fuera de alcance (Dominio C):** circuitos/química/Feynman = notación estándar fija → `rawLatex`.

## 7. Ideas de segundo orden (anotar, no hacer aún)

- **Unificar "datos":** un modelo de datos compartido entre `TableNode`, scatter (A4) y barras
  (A1/A2) → una **tabla de datos** que se puede **"ver como" tabla o gráfico**. Muy potente,
  requiere las familias ya separadas primero.
- **Selector por pregunta:** un mini-asistente "quiero que quien lo mire entienda…" que sugiere la
  familia. Alto valor didáctico, coherente con la plataforma de enseñanza.

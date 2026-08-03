# El cómputo y las capas — dónde vive el "cómo"

> **Complemento de [reglas-del-modelo.md](reglas-del-modelo.md).** Las 4 reglas dicen *dónde
> cae cada decisión*. Este doc nombra la pieza que faltaba explicitar: **las capas del sistema**
> y, dentro de ellas, **dónde vive la computación** (encontrar raíces, integrar, numerar). Nace
> de una confusión real (2026-07-22): el módulo de gráficos acumuló un motor de cálculo sofisticado
> —raíces, tangentes, integrales, intersecciones— *por acreción, no por diseño*, y no estaba claro
> si eso viola la filosofía del AST. La respuesta corta, tras verificar el código: **no la viola, y
> además ya está en la capa correcta** (módulos puros compartidos por los backends). Lo que faltaba
> no era mover código, sino **nombrar el principio** para no volver a confundirse. Este doc lo nombra
> — y de paso corrige varias conclusiones intermedias que resultaron falsas al mirar (marcadas
> "Corrección" en el texto).
>
> **Rol (ver [`README.md`](README.md)): constitucional (Ⓒ) — las capas + el ciclo de vida + el
> principio "AST=intención, lo derivado se computa".** Es upstream: el spec de nodos ejecutables
> *deriva* de acá (sus invariantes I3/I5/I6 son este principio aplicado). Para el *qué* normativo de
> ese frente futuro, ver [`spec-nodos-ejecutables-matex-borrador.md`](spec-nodos-ejecutables-matex-borrador.md);
> para dónde vive cada decisión, [`reglas-del-modelo.md`](reglas-del-modelo.md).

---

## 1 · Matex son cuatro capas, no una

"Matex" no es *una* cosa que compite con "el AST". El AST es **una** de sus capas. El sistema es
un pipeline:

```
① AST            (matex-core/ast.ts)        datos puros de INTENCIÓN
                                             "estas funciones · marcá sus raíces · tangente en x₀"
      ↓
② Resolución     (core/policy/, core/…)     el "CÓMO" COMPARTIDO — lo computa el sistema,
                                             una sola vez, para todos los backends
      ↓
③ Backends       compile.ts→LaTeX           RENDER: cada medio pinta el resultado ya resuelto
                 html.ts→HTML
                 graphics/*Svg.ts→SVG
      ↓/↑
④ Editor         editor/ (TipTap)           AST ↔ vista editable (un backend más, ver Regla 3)
```

Cuando alguien dice *"el motor que transforma a LaTeX/HTML"*, se refiere a **③**. Pero el
cómputo pesado **no vive en ③** — y ese es todo el punto de este documento.

---

## 2 · El principio: el AST guarda intención; los hechos derivados se computan

> **① guarda lo que el autor *quiso decir*. Los hechos *derivados* de esa intención —los números,
> las coordenadas de las raíces, el valor de una integral— NO se guardan: los produce ② cuando
> hacen falta.**

La prueba está en el AST actual. Para marcar las raíces de una función, el AST guarda:

```ts
function { markRoots: true }
```

**Nada más.** Las coordenadas de las raíces **no están** en el AST — se computan al resolver.
Igual que `theorem { numbered: true }` guarda la intención, no el string `"1.1"`. Un solo origen
de verdad; nada derivado que se pueda pudrir.

**Esto ya lo resolviste una vez, con la numeración.** El cómputo del plot es el mismo molde:

| Capa | Numeración (hecho, FIX-18) | Cómputo del plot (ya compartido, §3) |
|------|----------------------------|------------------------------|
| **① AST** | `theorem { numbered }` | `function { markRoots }` |
| **② Resolución** | `core/policy/numbering.ts` asigna "1.1" | `core/graphics/features.ts` encuentra las raíces |
| **③ Backends** | LaTeX usa contadores TeX · HTML escribe "1.1" · editor muestra "1.1" | SVG dibuja puntos · pgfplots recibe coords · **prosa** muestra el número |

**La excepción — materializar y congelar.** Cuando el medio **no puede recomputar** (el PDF es
estático), el valor derivado se *congela* dentro del documento, con procedencia. Ese es el otro
extremo del espectro generativo↔materializado (el del slider, ME-36): el SVG/HTML/editor
recomputan en vivo (no guardan nada); el PDF recibe el valor congelado. La regla general se
mantiene: **no se guarda lo derivado, salvo cuando el destino no puede regenerarlo.**

> **El principio generaliza al futuro namespace de entidades.** Si algún día las funciones/curvas se
> vuelven entidades del documento (ver [entorno-de-entidades-estudio.md](entorno-de-entidades-estudio.md)),
> **el AST guarda la *definición* `f = x²` (intención), y ② produce el *namespace resuelto* (nombre →
> valor)** — que no se persiste, exactamente como la tabla de numeración. El namespace es a las
> entidades lo que los contadores a `numbered:true`. El AST no engorda: crece por definiciones (finas),
> no por resultados (grandes).

---

## 3 · La capa ② tiene dos tipos de inquilinos

La Regla 3 define ② por una pregunta: *si dos backends lo resuelven distinto, ¿es bug o feature?*
Bug ⇒ es ②. Bajo ese test caen **dos clases de cosas**, y conviene verlas juntas:

| Tipo de inquilino | Qué es | Ejemplos | Costo |
|-------------------|--------|----------|-------|
| **Decisión compartida** | una *regla* que todos deben honrar igual | numeración por sección, tablas sin verticales, qué es referenciable | barato (lógica) |
| **Cómputo compartido** | un *cálculo* que todos deben obtener igual | raíces, extremos, asíntotas, derivada (tangente), integral (área), intersecciones, regresión | pesado (numérico) |

Los dos son política compartida por la **misma razón**: si el SVG y pgfplots encontraran raíces
distintas, sería un **bug**, no una diferencia de medio. Por eso el root-finding **tiene** que
estar en ②, arriba de los backends, en un solo lugar — exactamente donde ya vive la numeración.

**Dónde está hoy (verificado 2026-07-22):** ya está bien. El cómputo **no** está enredado con el
render — vive en **módulos puros separados** (`core/graphics/features.ts` raíces/extremos/asíntotas,
`intersect.ts`, `interpolate.ts`, `funcEval.ts`), y **los dos backends lo comparten**: tanto
`relationSvg.ts` (SVG) como `relation.ts` (pgfplots/LaTeX) importan y llaman a los mismos
`detectFeatures`/`intersectionPoints`. O sea: **la capa ② ya existe de hecho**, solo que archivada
bajo `graphics/`. Más aún, la matemática pura **ya está desacoplada del PlotSpec**:
`detectFeatures(ev, dom, …)` toma una **función `ev: (x)=>number` + dominio**, no un `PlotSpec` — la
forma "plain" que un consumidor no-plot (la prosa) reusaría directo. Lo único acoplado al plot es lo
que *debe* estarlo (`funcEvaluator(spec, f)` resuelve referencias `f1` *dentro* de un plot).

> **Corrección de un error propio.** Una versión anterior de este doc decía que el cómputo estaba
> "enredado en el backend SVG y había que moverlo a ②". Es **falso**: al mirar el código, ya estaba
> extraído y compartido. Lo único pendiente sería **cosmético** —renombrar `graphics/` → `compute/`
> para que el nombre no sugiera "render"—, y es **puro churn sin consumidor que lo pida: no vale la
> pena ahora.** La separación ③↔② del cómputo **ya está hecha, sin haberla llamado así.**

> **Por qué Matex es "profundo" donde LaTeX es "chato".** pgfplots elige *no* tener este motor:
> no encuentra raíces ni deriva; **vos** calculás la tangente y le pasás la recta. Empuja la
> matemática al autor. Matex hizo la apuesta opuesta —absorber la computación para que el autor
> se quede declarativo—, y por eso su módulo es profundo. **Esa profundidad es el precio de la
> promesa central** ("declarás la intención, el sistema hace el cómo"), no una impureza. La
> apuesta fue, hasta ahora, inconsciente (se dio así); este documento la vuelve **deliberada**.

---

## 4 · Declarativo (②) vs imperativo (escotilla): no confundirlos

El cómputo de ② es **declarativo y del sistema**: el autor dice `markRoots`, el motor resuelve.
Es lo opuesto a los **nodos ejecutables** (Python, LE-05), que son **imperativos y del autor**:
el autor *escribe* el algoritmo y corre en un runtime (Pyodide/sandbox).

| | Cómputo de ② (raíces, ∫) | Nodo ejecutable (Python) |
|---|---|---|
| ¿Quién escribe el cálculo? | el **sistema** | el **autor** |
| Naturaleza | **declarativa** (intención → el sistema resuelve) | **imperativa** (código arbitrario) |
| Rol en el modelo | política compartida (②) | **escotilla de cómputo** (como `rawLatex`/`include` lo son de markup) |

**El plot NO se apoya en los nodos de Python** y no debería. Levantar un runtime para encontrar
una raíz sería absurdo: ② lo hace en JS puro, en el hot-path. Los nodos ejecutables son otra capa,
para lo que ② *no* puede cubrir (algoritmo arbitrario, simulación, `sympy` simbólico). Matex
prefiere lo declarativo (②) y admite lo imperativo como **escotilla** — el mismo criterio con que
admite `rawLatex` como escotilla de markup.

---

## 5 · Entonces, ¿el AST del plot está bien con raíces/tangentes/áreas? — sí, y mejor de lo que parecía

> **Este análisis reemplaza una conclusión previa equivocada.** Primero afirmé que el plot era un
> "monolito aplastado" y que la **composición** (todo a una lista `operations`) era la "alternativa
> superadora", a hacer *junto con LE-06*. Al mirarlo campo por campo con el usuario, **se cae**: el
> modelo actual ya está razonablemente factorizado, y la composición total no es claramente mejor.

**¿Cada intención está bien en el AST?** Sí. `markRoots: true`, `tangent { at: x₀ }`, `area { from,
to }` son **intención fina**: el autor declara *qué* quiere mostrar y jamás computa una coordenada.
Pasan la Regla 4. No hay que sacarlas — sería amputar el valor y volver a pgfplots (el autor computa
a mano).

**¿Están bien organizadas?** Sorprendentemente, **sí** — y la clave es que el modelo actual usa
**dos formas distintas porque hay dos cosas distintas**:

| Grupo | Forma actual | Qué necesita | Naturaleza |
|-------|--------------|--------------|-----------|
| `areas`, `points`, `tangents`, `intersections`, `vlines`, `hlines`, `texts` | **lista de objetos** | **parámetros** (tangente en `x₀`, área de `a` a `b`, intersección de `f` **y** `g`) | **construcción parametrizada** |
| `markRoots`, `markExtrema`, `markInflections`, `markAsymptotes`, `markYIntercept` | **flag booleano en la función** | **nada** ("detectá *todas* las de esta curva") | **análisis sin parámetros** |

La separación **no es desorden: rastrea una distinción real.** Lo que necesita un item por instancia
(con parámetros) va en una lista; lo que es un sí/no sobre la curva va en un toggle. Cada forma calza
con su trabajo.

### Por qué la "composición total" NO es superadora

Pasar **todo** a una lista `operations: [{ op, of, params }]` tiene un delta **asimétrico**:

- Las **construcciones ya son operaciones en todo menos el nombre** — pasarlas solo colapsa 7 listas
  paralelas en 1 con un discriminante. Mejora **mínima y discutible** (un array tipado por tipo es más
  claro *por acceso* que una unión discriminada). Empate.
- Los **flags son el único cambio real** — y probablemente **empeora la usabilidad**: "marcá las
  raíces de f" pasaría de un **checkbox de un clic** a "agregá operación → elegí 'raíces' → elegí la
  curva". Para el caso común, peor.

O sea: la composición aplanaría una distinción que hoy es útil, a cambio de una uniformidad cuyo
beneficio grande (reuso por la prosa) resultó ser **blando y condicionado** (ver §6). **No es un win
claro; en varios ejes es peor.** El "peso" del plot es el **dominio rico**, no un modelo mal armado.

### Qué hacer con el AST del plot: **nada** (dejarlo como está)

- **No remodelar a composición** — ni ahora ni "con LE-06". No es superadora.
- **No extraer cómputo** — ya está extraído y compartido (§3).
- Si algún día molesta de verdad, lo único *quizás* razonable es un híbrido menor (colapsar las 7
  listas de construcción en una, dejando los análisis como toggles). Prolijidad opcional, no prioridad.

> **En una frase.** El módulo de plot está **más sano de lo que la auditoría (F-1) sugería**: grande
> porque el dominio es rico, con dos formas que rastrean dos naturalezas reales (construcción vs
> análisis), y con el cómputo ya en la capa correcta. El valor de esta discusión no fue un refactor
> —fue entender *por qué está bien* y evitar un churn que parecía mejora y no lo era.

---

## 6 · Cómputo declarativo, materialización, `verify` y Python: cuatro cosas, no una

El norte del proyecto (LE-06 y más allá) toca "computación en el documento". Cuatro cosas se
confunden fácil bajo ese paraguas; son **distintas en naturaleza** y conviene no mezclarlas (este
error ya se cometió: el backlog llegó a presentar `verify` como "punta de lanza").

| Cosa | Quién computa | Efecto en el doc | Dónde vive | Estado |
|------|---------------|------------------|-----------|--------|
| **① Cómputo declarativo de dominio** (raíces, tangente, ∫ del plot) | el **sistema** (de una intención) | render (marca/valor) | **② política compartida** | **ya existe** (§3) |
| **② Materializar por intención** (mostrar un valor computado en la prosa) | el **sistema** | **escribe** contenido derivado | modelo (nodo computado) + resolver de ① | futuro (LE-06), **el paso real** |
| **③ `verify`** (chequear una afirmación del autor) | — (la máquina **critica** lo que el humano escribió) | **ninguno** (diagnóstico al lado) | **tooling / ocasión de emisión**, no del AST | futuro, **secundario** |
| **④ Nodos ejecutables** (Python, `.py`, contexto de valores) | el **autor** (escribe el algoritmo) | escribe/materializa | **escotilla imperativa** (LE-05) | futuro, otra bestia |

Cuatro aclaraciones que se derivan, y que reemplazan framings previos equivocados:

- **`verify` NO es el paso de lanza — es la idea débil.** El nodo computado (②) lo vuelve casi
  redundante (si la máquina *calcula* el valor, no hay nada que verificar); se calla cuando no puede
  evaluar (la mayoría de la mate no lo es); y el autor de un libro suele saber la respuesta. Es
  **linting matemático opcional**, no un pilar. El paso real es **materializar (②)**.
- **F-3 (la doble representación: `tex` opaco en prosa vs `ExprNode` evaluable en gráficos) NO es
  precondición dura** de ② ni de ③: ambos corren sobre `tex` + `parseExpr` **bajo demanda**,
  degradando si no parsea. F-3 se fuerza recién con cómputo *pervasivo y confiable*, ambición muy
  posterior.
- **La "reutilización por la prosa" del cómputo del plot es blanda y condicionada** (no la razón para
  tocar el plot). Lo que se comparte de verdad es el **resolver ②** (las funciones de `features.ts`),
  y eso **ya está compartido** sin depender de la forma del AST. La composición solo agregaría un
  *vocabulario* común para *pedir* un cómputo — beneficio menor, y que además **exige antes** que las
  funciones sean **referenciables fuera de su plot** (hoy `f1`/`f2` son índices locales de un
  PlotSpec). Doble condición ⇒ no es palanca para nada ahora.
- **Declarativo (①/②) ≠ imperativo (④).** El plot no se apoya en Python y no debería (§4). Python es
  la escotilla para lo que el motor declarativo *no* cubre (algoritmo arbitrario, simulación, `sympy`).

> **Consecuencia para el backlog.** LE-06 debe reencuadrarse: su núcleo es **materializar por
> intención (②)** reusando el resolver que **ya existe**; `verify` baja a extra opcional; F-3 sale de
> las precondiciones. (Ya corregido en `06-backlog/backlog.md`.)

> **Hacia dónde converge todo esto.** Materializar (②), los nodos ejecutables (④) y "las funciones
> como entidades del documento" son, en el límite, **una sola arquitectura**: un *namespace* de
> entidades nombradas, con dos productores (declarativo nativo e imperativo Python) y muchos
> consumidores (plot, prosa, tabla). Es una **apuesta de identidad de producto**, no un refactor —
> ver el estudio [entorno-de-entidades-estudio.md](entorno-de-entidades-estudio.md).

---

## 7 · El eje del tiempo — qué corre en cada momento

Las secciones anteriores describen el **espacio** (las capas). Falta el **tiempo**: cuándo corre
cada una. La intuición rectora: **el AST es un guion inerte — por sí solo no hace nada. "Matex" es el
acto de interpretarlo** (resolver → emitir). Es un compilador: el AST es el código fuente (pasivo);
la cadena `② → ③` es lo que lo ejecuta.

Las capas son **sustantivos**; los momentos son **verbos**:

| Capa | Es un… | ¿Hace algo sola? |
|------|--------|------------------|
| ① AST | **sustantivo** (datos) | **No.** Declaración inerte. |
| ② Resolución | **verbo** (`AST → intención resuelta`) | Sí, cuando se la corre |
| ③ Backends | **verbos** (`resuelto → string del medio`) | Sí, cuando se los corre |
| ④ Editor | consumidor que corre ②+③ **en continuo** y edita ① de vuelta | Sí |

### Los tres momentos

```
  MOMENTO 1 — Autoría (mientras se tipea)
     tecla ──▶ ① AST cambia ──▶ ② resuelve ──▶ ③ editor renderiza ──▶ en pantalla
                                (numeración,      (KaTeX, SVG del plot,
                                 raíces, refs)     "1.1" al lado)
     * EN CONTINUO. El autor nunca ve el AST crudo: ve su proyección ya resuelta.

  MOMENTO 2 — Guardar (.mtex)
     ① AST ──▶ disco (JSON).  Se persiste SOLO la intención.
     * NO el "1.1", NO las coordenadas de las raíces, NO el SVG. (Excepción: freeze.)

  MOMENTO 3 — Compilar (a PDF/HTML)
     ① AST ──▶ ② resuelve ──▶ ③ emite ──▶ salida  (PDF: LaTeX ─▶ latexmk/TeX Live)
```

Todo se reduce a **`① → ② → ③`**, corrido en distintos momentos: en el editor cada tecla, al
compilar una vez.

### Las sutilezas que se derivan

1. **El editor no es "la UI" — es un tercer backend** que resuelve y renderiza en vivo. Por eso su
   "1.1" *debe* coincidir con el del PDF (Regla 3). Lo que se ve tecleando **ya es** un resolve+emit
   completo, solo que a la pantalla.
2. **Nada derivado se guarda.** El "1.1" no existe en el archivo; se **recomputa** cada momento (al
   tipear y al compilar). Se abre mañana → se recalcula de cero. Por eso **nunca hay datos derivados
   viejos**: no hay dónde envejezcan.
3. **② es una función pura y determinista** (salvo Python). Dado el AST, resolver siempre da lo mismo.
   *Por eso* el modelo es reproducible, y *por eso* freeze+procedencia solo hace falta para la
   escotilla no-determinista (Python).
4. **Un AST → muchas salidas.** PDF, HTML y editor son tres emisiones del mismo AST. Divergencia
   legítima (dos columnas: PDF pagina, HTML scrollea) = *feature*; ilegítima (numeración) = *bug* →
   política compartida (FIX-18, FIX-21).
5. **El freeze es el único lugar donde un dato derivado entra al AST** — y solo porque el destino
   (PDF) no puede recomputar. Excepción deliberada, con procedencia.

### El futuro reactivo es la misma forma, corrida más seguido

Toda la visión grande (entidades, namespace, Python, reactividad — ver
[entorno-de-entidades-estudio.md](entorno-de-entidades-estudio.md)) **no es una arquitectura nueva**:
es el **mismo pipeline con un ② más rico**. Hoy ② hace numeración/raíces/refs; mañana además
construiría el namespace, correría el DAG de dependencias y ejecutaría las celdas Python.
*"Cambio una variable → el plot se refresca"* = **editar el AST → volver a correr ② → re-emitir.** La
reactividad **es ② corriendo otra vez** sobre un AST cambiado. Por eso "objetos vivos con métodos"
rompe el modelo: mete estado **entre** corridas de ②. Mientras todo sea `① → ② → ③` recorrido cada
vez, el AST sigue siendo la única verdad y no hay estado que se pudra.

> **La estrategia de ejecución vive en ②, no en el AST.** El *orden* en que ② evalúa los nodos de
> cómputo (secuencial vs DAG), y cómo embebe Python, es una decisión de ② — el AST es **agnóstico del
> modelo de orden**. Por eso se puede empezar simple y evolucionar sin tocar el AST. El detalle
> —orden de ejecución, el borde opaco de Python, Python-como-función-pura, ciclos, y dónde viven las
> definiciones (scope global vs cuerpo)— está en el estudio §6-9.

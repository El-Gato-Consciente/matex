# Cómputo en el documento: nodos computados, `verify` y código ejecutable

> **Qué es este documento.** La propuesta de diseño para que un documento Matex **compute lo que afirma**.
> Consolida los dos informes previos (`../07-informes/matex_with_python.md` y `../07-informes/matex-nodos-ejecutables-informe.md`) pero
> **reencuadra la pregunta** y agrega un nivel que ninguno de los dos vio (el **cómputo declarativo nativo**
> con el nodo **`verify`**), y detalla el nivel de código arbitrario (**Python**). No es compromiso de
> implementación: fija el norte y la secuencia. Ver [[dynamism-spectrum]], [[matex-vision]], [[svg-backend-puro]].

> **⚠️ Dos actualizaciones posteriores (2026-07-22), leer junto con este doc:**
> 1. **`verify` está sobrevalorado acá.** Es la idea *débil* (el nodo computado lo vuelve redundante;
>    se calla cuando no puede evaluar; el autor suele saber la respuesta) → baja de "feature estrella"
>    a **extra opcional**; el paso real de LE-06 es **materializar por intención**. Ver
>    [computo-y-capas.md](computo-y-capas.md) §6.
> 2. **El contrato `emit_*` generaliza a un *namespace* de entidades.** Los nodos ejecutables y "las
>    funciones como entidades del documento" son **una sola arquitectura** (un namespace, dos
>    productores, muchos consumidores). Ver [entorno-de-entidades-estudio.md](entorno-de-entidades-estudio.md).

---

## 1. El reencuadre: la pregunta correcta

Los dos informes preguntan **"¿cómo corremos Python en Matex?"**. Eso ya es una respuesta disfrazada de
pregunta. La pregunta real es:

> **¿Cuál es la cosa más chica que hace que el documento *compute lo que afirma*?**

Y para Matex, la respuesta en su mayoría **no es Python**. Los informes razonan como si Matex no tuviera un
motor de cómputo, pero **ya lo tiene**: `evalExpr` (evaluación de expresiones con funciones y parámetros),
integración numérica (áreas), y todo `core/graphics/features.ts` (raíces por bisección, extremos por f′,
inflexiones por f″, asíntotas por límites, interpolación/regresión por spline/Lagrange/LSQ). Saltar a Python
es ignorar la herramienta que tenemos en la mano.

### La distinción rectora: intención declarativa vs. algoritmo imperativo

La línea que los dos informes borran —y que es **el core de Matex**— es **intención vs. algoritmo**:

- **Operación matemática declarativa** (derivar, integrar, hallar una raíz, tabular, verificar una
  identidad) → la resuelve **nuestro motor**. Es intención, no código. `mark roots of f` (ME-39) *ya* es
  esto: se declara la intención y el compilador la computa. Sólo falta **generalizarlo para que emita a
  texto/tabla/fórmula**, no únicamente al gráfico.
- **Algoritmo imperativo arbitrario** (simulación estocástica, dataset externo, CAS simbólico completo,
  cualquier cosa con control de flujo genuino) → **ahí sí**, código ejecutable (Python) como escotilla.

Esta línea es limpia y principista: **cómputo declarativo = nativo; algoritmo arbitrario = Python**. Los
informes tratan todo como "code" y por eso arrastran infraestructura cara a casos que no la necesitan. El
riesgo de la capa declarativa creciendo sin fin (Greenspun) se contiene con esta misma línea: se mantiene a
**operaciones matemáticas cerradas y bien entendidas**; cuando aparece control de flujo real → esa es la
frontera con Python, no un caso más de la DSL.

---

## 2. El espectro completo (Nivel 0 → 2)

Toda feature que produce un valor no-estático es el patrón **generativo↔materializado** (algo vivo que
colapsa a un valor estático que compila a LaTeX). El espectro por "¿de dónde sale el número?":

| Nivel | Qué es | Ejemplo | Motor | Costo | ¿Reproducible sin infra? |
|---|---|---|---|---|---|
| **0** | literal estático | `x = 3` | — | nulo | sí (es el valor) |
| **1** | **parámetro/slider** (ME-36/37 ✅) | `y = a·x² + b`, `a` con slider | expresiones | bajo | **sí** (auto-descriptivo) |
| **1.5** | **cómputo declarativo nativo** (`verify`, valor computado) | `verify: (x+1)² = x²+2x+1`; `∫₀¹ x²` | motor propio (ME-39/integración) | **bajo** | **sí** (auto-descriptivo) |
| **2** | **código ejecutable** (Python) | sympy, Monte Carlo, dataset real | intérprete externo | **alto** | no (necesita procedencia) |

**La unificación clave (lo que ninguno de los informes vio):** los Niveles 0, 1 y 1.5 son **todos
trivialmente reproducibles** porque son **auto-descriptivos** — una expresión Matex (o una operación
declarada sobre ella) se explica sola, igual que el slider. Por eso **no necesitan hash de procedencia, ni
DAG, ni estados fresh/stale**. Todo ese aparato pesado es **exclusivo del Nivel 2** (código arbitrario,
potencialmente no-determinista). Esto **borra casi todo el costo** que los informes le colgaban a "la feature
de cómputo": el DAG y la procedencia sólo existen si y cuando llega Python.

**Estrategia (la misma que funcionó con slider-antes-que-Python, [[dynamism-spectrum]]):** hacer el Nivel 1.5
**antes** del 2. Captura el grueso del valor pedagógico con costo bajo, es puro/seguro/offline, y **estrena el
AST de "nodo computado" + la UX de freeze sobre un sustrato nativo y seguro** antes de exponerlos a la bestia
de Python.

---

## 3. Nivel 1.5 — cómputo declarativo nativo

### 3.1 La feature estrella: `verify` (y no lleva Python)

**Qué es.** Un nodo que **afirma una verdad matemática y la chequea**, marcando (o rompiendo) el build si es
falsa. Es *correctness-by-construction*: **el documento no puede mentir sobre su propia matemática**. Un error
de tipeo en "la derivada de x² es 2x" **no puede** colarse en un apunte, un examen o un libro.

**Por qué el chequeo NUMÉRICO en puntos aleatorios NO es un sustituto débil de lo simbólico.** Este es el
punto que casi nadie entiende bien. Verificar `A(x) = B(x)` evaluando en N puntos aleatorios es
**identity testing de Schwartz–Zippel**: un polinomio no nulo de grado d, evaluado en un punto aleatorio de un
conjunto S, se anula con probabilidad ≤ d/|S|. Es decir, si `A − B` da ~0 en varios puntos aleatorios de un
dominio continuo, entonces `A ≡ B` con probabilidad **abrumadora** (la de falso positivo es esencialmente
cero). Para identidades polinómicas, racionales y analíticas —que es lo que aparece en un documento
matemático— **es el método correcto, no un parche**. Sólo se le escapan patologías de medida nula (funciones
que coinciden salvo en un punto).

- **Falsos positivos** ("declara iguales cuando no lo son"): astronómicamente improbables → despreciable.
- **Falsos negativos** ("declara distintas cuando son iguales"): pueden venir de ruido de punto flotante cerca
  de singularidades, de muestrear fuera del dominio, o de coincidencia salvo medida nula. Se controlan con:
  **tolerancia** relativa, **remuestreo dentro del dominio**, y **exigir fallo en varios puntos** (no en uno).

**Tipos de `verify`:**

1. **Identidad** `A(x) = B(x)` (para todo x en un dominio) → muestreo Schwartz–Zippel. *(derivada, factoreo,
   identidad trigonométrica, simplificación).*
2. **Valor numérico** `expr ≈ v` (con tolerancia) → una evaluación. *("la raíz es ≈ 1.324").*
3. **Consistencia derivada/integral**: `F′ = f` (que la primitiva afirmada derive al integrando, numérico) o
   `∫[a,b] f = V` (integración numérica vs. el valor afirmado — reusa la integración de áreas).
4. **Propiedad** declarada: "f tiene una raíz en [a,b]" (cambio de signo), "f es creciente en [a,b]" (f′>0
   muestreado), "f es par/impar" (f(−x)=±f(x)). Todo numérico, reusando `features.ts`.

**Qué caza (ejemplos):**

| Afirmación | Resultado |
|---|---|
| `d/dx[x²] = 2x` | ✓ pasa |
| `d/dx[sin x] = −cos x` | ✗ **falla** (es `cos x`) |
| `(x+1)² = x² + 2x + 1` | ✓ |
| `(x+1)² = x² + 1` | ✗ **falla** |
| `sin²x + cos²x = 1` | ✓ |
| `∫₀¹ x² dx = 1/3` | ✓ (numérico) |

**Diseño en Matex:**
- Nodo `verify` con una **afirmación** (dos expresiones + relación, o expresión + valor/propiedad esperada),
  un **dominio** opcional y una **tolerancia**. Corre en el motor (`parseExpr`/`evalExpr`) en tiempo de
  preview/compile.
- **No emite nada al documento renderizado** por defecto (es *silencioso* — su valor es la *garantía*, no
  contenido visible); opcionalmente un ✓ discreto.
- **Editor:** badge ● (pasa) / ✗ (falla) sobre el nodo, y —si falla— el punto `x` donde se rompió (para
  diagnosticar). No bloquea el resto del documento.
- **Build:** opción de **romper la compilación** si un `verify` falla (como un test) o sólo advertir.
- **Reproducible sin nada**: la afirmación es una expresión Matex auto-descriptiva → sin procedencia/hash.

**Por qué es el mejor punto de entrada:** cero infra (reusa el motor), muy diferenciado (nadie —Quarto,
Jupyter, Colab— verifica la *matemática* del documento), y **ya tenemos la cultura**: el anti-bitrot de ME-23
(los ejemplos de la galería se compilan a LaTeX *y* HTML en la suite) es exactamente esto a nivel proyecto.
Es construible como **una feature chica**, no en 6-12 meses.

**Límite honesto:** `verify` **prueba fuerte, no demuestra**, y **no manipula símbolos** — te dice si tu
afirmación es correcta, no *cuál* es la derivada. Para "computá la derivada por mí" hacen falta la §3.2 (con
reglas simbólicas) o el Nivel 2 (sympy).

### 3.2 Valor computado por intención

Un nodo que **materializa una operación matemática declarada** dentro del texto, una tabla o una fórmula:

- `evaluar f en {x₁…xₙ}` → **tabla de valores** (reusa `plotValuesAt`).
- `∫ f de a a b` → **el número** (reusa la integración de áreas).
- `raíz de f en [a,b]`, `f′(a)`, `máx de f en [a,b]` → reusa `features.ts`.

Se declara la **intención**; el motor computa y **congela** el resultado en el texto. Es más Matex que embeber
`scipy.optimize.brentq(...)`, y —de nuevo— **reproducible sin procedencia** (auto-descriptivo). Una capa
simbólica **incremental** (reglas de derivación, factoreo de polinomios) podría sumarse acá si el apetito
aparece, sin cruzar a Python; el CAS *completo* sí es Nivel 2.

**Qué de Matex se reutiliza (no se construye de cero):** `features.ts` (ME-39) ya es medio motor de cómputo;
la integración numérica ya existe (áreas); `plotValuesAt` ya tabula. El Nivel 1.5 es en gran medida
**exponer hacia el texto lo que el motor ya computa hacia el gráfico**.

---

## 4. Nivel 2 — código ejecutable (Python), en detalle

El Nivel 2 tiene **dos caras** de valor muy distinto, y los dos informes —y mi primera versión— sólo vieron
la primera. Distinguirlas cambia el peso estratégico del nivel.

### 4.1 Cara A — código-HERRAMIENTA (computa un valor)

El código es **invisible/incidental**; lo que importa es el **resultado**, que se materializa como un nodo
matemático. Es la **cola irreducible** de lo que la capa declarativa nativa no puede expresar:

- **Álgebra simbólica (CAS)** — el caso más fuerte: `sympy` factoriza, resuelve simbólicamente con pasos,
  hace series de Taylor, integra simbólicamente. **Nuestro motor evalúa pero no manipula símbolos** → esto es
  genuinamente Python. `sympy.latex()` da salida LaTeX lista para inyectar.
- **Simulación estocástica** (Monte Carlo, bootstrap): resultados sin forma cerrada.
- **Datasets reales** (`.csv`/`.parquet`/API): limpieza con `pandas`, estadística descriptiva.

Lo que Python **NO** debe hacer (litmus): reescribir raíces/extremos/asíntotas/interpolación/implícitas, que
el motor ya hace **puras, rápidas y en el hot-path**. Si un `exec` reemplaza cómputo in-engine = **señal de
alerta** (ver §5). *(Esta cara es la que enfatizan los informes —reportes reproducibles, financieros— y es la
**menos** alineada con la enseñanza.)*

### 4.2 Cara B — código-CONTENIDO (el algoritmo ES la materia) — la cara que faltaba

Acá el código **no es invisible: es el objeto de estudio**. Enseñar Newton-Raphson no es "obtener la raíz",
es mostrar **el método** —su iteración, su convergencia, cuándo falla—. Esto abre un dominio entero que es, de
hecho, **central a la identidad de Matex** (plataforma de enseñanza de matemática, ver [[matex-vision]]):
**matemática computacional, métodos numéricos, algoritmos, pensamiento computacional, y la programación misma
como materia.** Por eso el Nivel 2 es **más relevante** de lo que sugería el encuadre "escotilla para la cola
arbitraria".

- **Es el caso de uso natural de enseñar matemática**, no una distracción: un apunte de métodos numéricos, un
  curso de algoritmos, "aprender a programar haciendo matemática".
- **El hueco de mercado es exacto.** Hoy para esto tenés (a) Jupyter —código vivo, tipografía y estructura
  pobres— o (b) un libro/PDF estático —tipografía hermosa, código muerto—. Matex cae **justo en el medio**:
  un documento bellamente compuesto donde los algoritmos están **vivos, editables, y su salida se renderiza
  nativa/semántica**. Diferencial más fuerte que "reportes reproducibles".
- **Sinergia con TODO lo construido** — el algoritmo **emite visualizaciones nativas** (vía el contrato §4.3):
  - Newton/bisección → **tabla de iteraciones** (`emit_table`) + **plot de las aproximaciones convergiendo**
    (`emit_series` sobre el gráfico existente).
  - recursión / sorting → **árbol** (¡`forest` de ME-28!) + secuencia de pasos.
  - complejidad → correr a tamaños *n*, **plot de pasos(*n*)** + **ajuste** (¡regresión de ME-45!) que muestra
    O(*n*²) vs O(*n* log *n*).
  El "código-contenido" **desemboca en la capa de visualización semántica que ya tenemos**; el contrato de
  salida es la costura.
- **La asimetría de interactividad aplicada al código** (regla de oro LE): *autor-ejecutable* (edit-time) y,
  sobre todo, **lector-ejecutable (runtime Pyodide): el LECTOR modifica el algoritmo y ve el resultado** →
  pedagogía computacional interactiva embebida en un documento tipográfico. Es la **killer feature gamificada**
  (el alumno toca el código, cambia el paso, ve romperse la convergencia): la interactividad-de-consumo del
  espectro, aplicada a la **lógica** en vez de a un slider.
- **Costo (clave):** enseñar algoritmos usa **Python puro** (loops, recursión, estructuras básicas) → corre
  **bárbaro en Pyodide, barato**, sin librerías nativas pesadas. Es decir, **el modo pedagógico de más valor
  es alcanzable en la fase Pyodide barata (Fase B), ANTES del backend caro**; la Cara A pesada (pandas/scipy)
  es la que empuja al backend y la menos alineada con la enseñanza.

**Síntesis del nivel:** `verify` (Nivel 1.5, matemática garantizada) + algoritmos vivos (Cara B) = **"el texto
de matemática computacional donde la matemática está garantizada y el código está vivo"** — un producto que
hoy no existe.

### 4.3 El contrato de salida tipado (el aporte valioso del 2º informe)

El código **no escribe LaTeX ni dibuja un PNG**: declara **qué nodo del AST produce**, y el compilador lo
renderiza como cualquier nodo nativo → **preserva "un AST, muchos backends" también para el contenido
generado**.

```python
import matex
matex.emit_expr(sympy.diff(f, x))     # → mathInline/mathDisplay (vía sympy.latex → nuestro canon → parser)
matex.emit_table(df)                  # → nodo tabla nativo (booktabs / HTML)
matex.emit_series(xs, ys, role="…")   # → PlotDataSeries (el tipo extendido en ME-45: hereda color/rol/interp)
matex.emit_value(42, label="…")       # → valor inline
```

Tres consecuencias al aterrizarlo en Matex:
1. **`emit_series` cae directo sobre lo construido**: una serie generada por código es un `PlotDataSeries` más
   → hereda color/rol (ME-38), interpolación/ajuste (ME-45), y los 3 backends. El "figure-from-code" **no
   rasteriza matplotlib** (lo cual rompería multi-target): emite **datos** que `plot2d` renderiza nativo.
2. **`emit_expr` reparsea**: sympy da LaTeX; el valor materializado debe ser **LaTeX normalizado por nuestro
   canon** (no un string opaco) para que el HTML (KaTeX/MathML) también lo renderice.
3. **Agnóstico al lenguaje** (`lang="python"` desde el día uno): R/Julia después = implementar el mismo
   protocolo, sin tocar AST ni compiladores. Barato de respetar aunque sólo se haga Python.

### 4.4 Taxonomía de nodos ejecutables

- **`exec` (silencioso):** corre código y define estado (variables/funciones) para nodos posteriores; no
  produce salida visible.
- **`eval` (inline):** evalúa una expresión y la sustituye dentro de una oración/fórmula (`` `r x` `` de R
  Markdown).
- **`code-block` visible:** muestra el código *y* su salida (material que enseña a programar con la
  matemática).
- **`figure-from-code`:** el código produce datos → `emit_series` → `plot2d` (no una imagen).
- **`table-from-code`:** el código produce una tabla (DataFrame) → tabla nativa.
- **`verify`-por-código:** un `verify` cuya comprobación necesita un CAS (identidad que el muestreo numérico no
  zanja, p. ej. una demostración simbólica). Es el puente entre el `verify` nativo (§3.1) y sympy.

### 4.5 Modelo de ejecución y "freeze"

Tres momentos, **la interactividad depende del consumidor** (regla de oro de [[dynamism-spectrum]]):

| Momento | Dónde | Para qué |
|---|---|---|
| **Build-time (congelado)** | fase previa al render | el código corre una vez, el resultado queda **frozen** en el AST; **LaTeX/PDF lee el valor congelado, NUNCA corre Python** |
| **Edit-time (Pyodide)** | editor del autor | feedback en vivo mientras se escribe el código (preview) |
| **Runtime (Pyodide)** | navegador del lector | recomputar si un slider del lector alimenta una variable del código (interactividad de consumo) |

**Freeze = materializar.** El resultado se guarda **dentro del `.mtex`** (`{ kind:'computed', output:<nodo>,
source:<código>, frozen:true, hash:<código+deps> }`). Al reabrir el documento **no se re-ejecuta** (se lee el
valor congelado) → leer un documento **no requiere** tener Python. Sólo se recomputa si el autor lo pide o si
el hash del código cambió (nodo marcado "desactualizado").

### 4.6 El aparato caro (SÓLO acá) — y por qué se difiere

Lo que los informes ponen en el centro y que en realidad es **exclusivo del Nivel 2**:
- **Hash de procedencia**: cada valor lleva el hash de `(código + versión de deps + inputs)` → reproducibilidad
  y trazabilidad (qué código/datos produjeron cada cifra). Valioso en contexto académico/auditoría.
- **Estados fresh/stale/running/error**: la UX de "esto está al día / cambió / corriendo / falló", como una
  hoja de cálculo. Sin esto, el sistema puede "mentir" mostrando un valor viejo como actual — grave si el
  destino es un PDF publicado.
- **Grafo de dependencias (DAG) reactivo** (tipo Marimo): derivar el orden de ejecución del **grafo de
  variables**, no del orden de aparición → elimina el "estado fantasma" de Jupyter y permite invalidación en
  cascada. Es lo **más caro** (parsear deps, detectar ciclos, invalidar) y lo que compite de frente con
  Marimo/Quarto.

**Se difieren enteros.** El MVP (§6) usa **orden de aparición + freeze**, sin DAG ni procedencia, hasta tener
demanda real.

### 4.7 Infraestructura y seguridad

- **Pyodide-first** (Python→WASM en el navegador): sandboxing **gratis** (corre en el sandbox del navegador,
  nunca toca un servidor), offline tras la carga, sin gestión de kernels. Cubre numpy/sympy/scipy livianos.
  Contra: carga inicial pesada, librerías nativas limitadas, cómputo pesado inviable.
- **Backend con kernel** (contenedor efímero, sin red, límites de CPU/mem/tiempo, sandbox serio tipo
  gVisor/Firecracker): sólo para librerías pesadas fuera de Pyodide. Es **infraestructura + superficie de
  seguridad permanente** → **último**, y sólo si un caso pago lo justifica.
- **Determinismo:** seeds forzados + freeze por defecto; marcar en la procedencia lo no-determinista.

---

## 5. Ponderación sobre Matex REAL (2026-07)

**El piso subió.** El motor en JS ya hace, en el hot-path, puro y sin infra: raíces/extremos/inflexiones
(ME-39), asíntotas (ME-39), interpolación/regresión (ME-45), implícitas (ME-18). Muchos "casos de uso para
Python" de los informes **ya están resueltos sin Python** → Python queda para la **cola arbitraria** (§4.1).

**El caso motivador del borrador (implícitas en Python) sigue REFUTADO.** El JS de `implicit.ts` no es "magia
negra a blanquear": es la arquitectura funcionando (computar una vez → pgfplots *y* SVG en vivo, sin
`shell-escape`, en el hot-path del zoom, ver [[svg-backend-puro]]). Moverlo a Pyodide metería un round-trip
WASM en el zoom → **regresión del core puro**. **`exec` es para lo que el motor NO puede, no para relocalizar
lo que ya hace rápido y puro.**

---

## 6. Recomendación y secuencia

**Próximo paso cuando toquemos este frente: NO es Python — es el `verify` numérico (§3.1)** como feature chica
y nativa. Es alto valor, muy diferenciado, cero infra, y **estrena el "nodo computado + freeze"** sobre un
sustrato seguro. Secuencia:

1. **`verify` numérico (Nivel 1.5)** — identidad (Schwartz–Zippel) + valor + consistencia derivada/integral.
   Nativo, reusa el motor. **Recomendado como entrada.**
2. **Valor computado por intención (Nivel 1.5)** — `∫`, raíz, tabla de valores → texto/tabla/fórmula. Nativo.
3. **(Sólo con demanda) Nivel 2, Fase A — contrato como formato:** aceptar `{kind:'computed', output, frozen}`
   con resultado pegado desde afuera (Jupyter/script). Cero ejecución propia, cero sandbox. Valida el contrato.
4. **(Sólo con demanda) Nivel 2, Fase B — `exec` Pyodide congelado + `verify`-por-código:** orden de
   aparición, **sin DAG**, sin backend. Cubre sympy/simulación livianas.
5. **(Sólo con señal real) Nivel 2, Fase C — procedencia/hash + fresh/stale**, y **quizás** el DAG. Lo caro.
6. **(Sólo con caso pago) Nivel 2, Fase D — backend + sandbox.** Último.

**Litmus tests (se mantienen):** (a) **ortogonalidad** — borrar la capa ejecutable no debe romper nada; el
compilador LaTeX no sabe de Python. (b) **no canibalizar** el cómputo in-engine. (c) **opt-in estricto** — el
camino feliz (escribir un documento) nunca requiere entender kernels ni grafos. (d) cada capacidad nueva:
*¿refuerza el diferencial o lo diluye hacia competir con Colab?*

---

## 7. Posicionamiento

**No competir con Colab/Jupyter en cómputo** (GPUs, ecosistema, escala — batalla perdida). El diferencial de
Matex es **inverso**: no es "un notebook con markdown", es un **sistema de autoría de documentos semánticos
con cómputo embebido como acompañamiento**. Ventajas estructurales que Colab no puede tener sin rediseñarse:
(1) artefacto final de **calidad publicable** (numeración, refs, biblio, tipografía); (2) contenido
**semántico** (un teorema *es* un teorema); (3) **reproducibilidad real** (freeze + procedencia, sin estado
fantasma); (4) `.mtex` **diff-friendly**; (5) el **puente exploración→artefacto fijo** (freeze, ya realizado
con zoom/pan y sliders). **Estrategia: ser excelente en la *frontera* "qué resultado entra al documento", y
ser complementario —no sustituto— del ciclo exploratorio pesado** (importar resultados limpios desde un
notebook externo, no replicar Jupyter).

**Dos diferenciales reales, esperando ser tomados:** (1) el **`verify` numérico** —verificar la *matemática*
del documento— que **ni Colab ni Quarto ni Marimo hacen**, barato y nativo; y (2) el **texto de matemática
computacional** (§4.2): documento tipográfico + algoritmos **vivos y editables por el lector**, que hoy nadie
cubre (Jupyter no tiene el documento; el libro no tiene el código vivo). El segundo está **directamente en la
misión** de Matex como plataforma de enseñanza, y es alcanzable **barato** (Python puro en Pyodide). No es "el
ciclo exploratorio pesado" (eso queda para Jupyter): es **la clase de matemática computacional**, que es otra
cosa y es nuestra.

---

## 8. Decisión

**Nada de esto está descartado; el Nivel 1.5 es acción cercana, y el Nivel 2 subió de peso** al reconocer su
**Cara B** (código-contenido, §4.2). El insight central sigue: Matex **no necesita Python primero — necesita
exponer su propio motor como capa de cómputo declarativa**, y el `verify` numérico es la punta de lanza (alto
valor, cero infra, muy Matex, y valida el AST de nodo computado + freeze).

**Corrección de rumbo respecto de los informes (y de mi 1ª versión):** el Nivel 2 **no es sólo la escotilla
para computar valores** (Cara A, que los informes enfatizan como "reportes reproducibles"). Su cara más
valiosa para Matex es el **código como contenido** —matemática computacional, algoritmos, métodos numéricos
vivos y editables por el lector— que está **en la misión de enseñanza**, sinergiza con todo lo construido
(emite tablas/plots/árboles/regresiones nativos) y es **barato** (Pyodide + Python puro, sin backend). El
orden no cambia (`verify`/nativo primero, luego `exec` Pyodide congelado), pero **cuando lleguemos al Nivel 2,
el objetivo es la clase de matemática computacional, no el reporte financiero**. El aparato caro
(DAG/procedencia/backend) sigue diferido hasta demanda real.

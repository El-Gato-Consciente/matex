# Matex frente al estado del arte — análisis comparativo

> **Relación con lo ya escrito.** `vision-y-alcance.md` §6 remite a un `02-estado-del-arte/` que
> no está entre los documentos disponibles acá — este informe no lo reemplaza, lo complementa
> desde el ángulo específico que venimos trabajando: **arquitectura de nodos ejecutables y
> entorno compartido**, no la evaluación general del proyecto.
>
> **⚠️ Procedencia y verificación (nota de auditoría, 2026-07-22).** Este informe se produjo **fuera
> de este ecosistema** y afirma haber verificado los datos "contra fuentes actuales (julio 2026)".
> Esa verificación **no fue reproducida por el proyecto**: las afirmaciones competitivas concretas
> —Quarto tiene `freeze`, Typst tiene `content`/`show` rules, Marimo hace DAG por análisis estático—
> son **plausibles y corroborables de memoria, pero NO están verificadas contra fuente ni por
> vigencia**. Trátense como **hipótesis a confirmar** antes de que cualquier decisión del proyecto
> se apoye en ellas. La **interpretación** ("esto debilita/sostiene el diferencial de Matex") es del
> autor del borrador y queda a juicio del proyecto, no se hereda. Ver
> [`08-auditoria/auditoria-spec-nodos-ejecutables.md`](../08-auditoria/auditoria-spec-nodos-ejecutables.md).

---

## 1 · Los ejes de comparación (derivados de lo ya especificado, no inventados para esto)

Comparar "quién es mejor" sin ejes es marketing. Los ejes que siguen salen directo de los
invariantes de `spec-nodos-ejecutables-matex-borrador.md` — son las preguntas que **ese**
documento tuvo que responder, así que son las preguntas justas para hacerle a cualquier rival:

| Eje | Pregunta | Por qué importa (no es arbitrario) |
|---|---|---|
| **Modelo de documento** | ¿hay un AST unificado, o el texto y el código son entidades separadas que se pegan? | de esto depende si el "molde" `emit_*` tiene siquiera sentido |
| **Dirección código↔documento** | ¿el código puede solo *imprimir* algo, o puede producir estructura tipada? | es la diferencia entre Nivel 1 (texto ciego) y Nivel 2 (`emit_*`) de `nodos-ejecutables-propuesta.md` |
| **Modelo de ejecución** | ¿caótico (Jupyter), reactivo (DAG), o secuencial (Matex)? | ver §16 del addendum: el costo de "solo lo previo" vs. el costo de un DAG en código opaco |
| **Reproducibilidad / freeze** | ¿el documento final necesita el runtime para volver a existir? | Invariante I9 |
| **Semántica de dominio matemático** | ¿tiene nodos de primer nivel para demostración/grafo/autómata, o todo es genérico? | el wedge real de `vision-y-alcance.md` §2 |
| **Multi-backend con política compartida** | ¿dos salidas del mismo documento pueden divergir en cosas que deberían coincidir? | Regla 3 de `reglas-del-modelo.md` |

---

## 2 · Matriz resumen

| | Jupyter / Colab | Org-mode + Babel | Quarto / RMarkdown | Notebooks reactivos (Marimo/Pluto/Observable) | Typst | **Matex (visión)** |
|---|---|---|---|---|---|---|
| AST unificado texto+código | ❌ (JSON de celdas, sin AST) | 🟡 (parser sintáctico, no semántico) | ✅ (AST de Pandoc) | 🟡 (grafo de celdas, no AST de documento) | ✅ (árbol de `content` tipado) | 🟡 visión — mismo nivel que Quarto/Typst |
| Código produce texto ciego / string | ✅ (stdout, imágenes en disco) | ✅ (Babel pega texto de vuelta) | ✅ por defecto (stdout/Markdown) | 🟡 (objetos Python, no nodos del documento) | ❌ — produce `content` tipado nativo | ❌ (ese es el punto central) |
| Código produce estructura tipada del propio documento | ❌ | ❌ | 🟡 parcial (`ojs`/widgets, no el AST de Pandoc en sí) | ❌ (UI widgets, no nodos de documento) | ✅ (ya lo hace, en su propio lenguaje) | ✅ (`emit_*`, visión) |
| Orden de ejecución | manual/caótico | secuencial (texto) | secuencial (build) | DAG reactivo | secuencial (compilación) | secuencial + namespace único |
| Freeze / reproducibilidad sin runtime | ❌ | ❌ | ✅ (**función `freeze` ya existe, con ese nombre**) | 🟡 (exportable a HTML estático, sin re-ejecutar) | ✅ (nativo, no hay "runtime" separado del compilador) | 🟡 visión, mismo objetivo que Quarto |
| Nodos de dominio matemático (demostración, grafo, autómata) | ❌ genérico | ❌ genérico | ❌ genérico (vía paquetes LaTeX/JS sueltos) | ❌ genérico | ❌ genérico (buena tipografía matemática, no semántica de prueba) | 🟡 visión — **acá está el diferencial real** |
| Lenguaje del código embebido | Python/R/Julia/... (cualquiera) | cualquiera (vía Babel) | Python/R/Julia/Observable-JS | Python (Marimo) / Julia (Pluto) / JS (Observable) | propio (scripting de Typst) | Python (Pyodide-first) |
| Multi-output real (PDF+HTML) con política compartida | ❌ (solo notebook/HTML) | 🟡 vía exportadores de Org | ✅ (vía Pandoc, sin tests de equivalencia explícitos) | 🟡 (mayormente un solo target: HTML/app) | 🟡 (PDF/HTML/PNG/SVG, mismo motor) | 🟡 visión, con Regla 3 explícita |

---

## 3 · Perfil de cada sistema (por qué la fila de la matriz dice lo que dice)

### 3.1 Jupyter / Google Colab — el modelo clásico

**Modelo de documento.** El `.ipynb` es JSON plano: una lista de celdas con un `type` (`code` |
`markdown`), sin relación estructural entre ellas. No hay AST del *documento* — solo hay AST del
*código Python* dentro de cada celda de código, invisible para el resto.

**Código → documento.** Una sola vía: la celda produce `stdout`/`stderr`/imágenes-como-bytes que
el frontend muestra debajo. El texto de Markdown nunca "sabe" nada del resultado — es, en el
lenguaje que ya usamos, el caso "texto ciego" de la charla con Gemini, sin ni siquiera el paso
intermedio de un contexto compartido explícito.

**Ejecución.** Manual, orden de clic — el "Problema del Estado Oculto" (ejecutar celda 2 dos
veces sin releer el documento de arriba a abajo). Es exactamente lo que el Invariante I2 de
Matex (*"solo lo previo, en orden de documento"*) prohíbe por diseño.

**Freeze.** No existe — reabrir un `.ipynb` sin volver a ejecutar muestra outputs potencialmente
viejos, sin ningún mecanismo de invalidación ni de aviso (viola lo que sería I7 e I9 si
existieran acá).

### 3.2 Emacs Org-mode + Babel — el modelo de texto plano extremo

**Modelo de documento.** Un parser puramente sintáctico (títulos, listas, bloques) — **no
semántico**. No hay noción de "esto es un teorema" o "esto es una tabla tipada"; todo es
estructura de texto genérica.

**Código → documento.** Vía **string interpolation literal**: Babel manda el texto del bloque a
un intérprete, recibe texto de vuelta, y lo pega en el archivo. Si el resultado es una tabla,
Org-mode la recibe como texto con separadores y la reparsea como texto plano — nunca como
estructura. Es el ejemplo más puro de lo que `emit_*` fue diseñado para evitar.

**Ejecución.** Secuencial por posición en el archivo — en esto Matex se parece bastante a
Org-mode, pero Org-mode nunca resuelve el problema de tipado que motiva casi toda la
especificación de nodos ejecutables.

### 3.3 Quarto / RMarkdown (vía knitr) — el rival más cercano, y con una corrección importante

**Modelo de documento.** Sí tiene AST unificado — hereda el de **Pandoc**, que ya construye un
árbol semántico real (headers, tablas, listas, bloques de código con `type` propio), y por eso
puede transpilarse a PDF, HTML, DOCX, EPUB, PPTX desde la misma fuente, con filtros Lua que
operan sobre ese AST. En esto Quarto está genuinamente más adelantado que la visión actual de
Matex, que todavía no tiene un AST implementado más allá de lo que hay en `referencia-v1.md`.

**Código → documento — la corrección importante.** La comparación anterior con Gemini afirmaba
que en Quarto "Python no puede hablarle al AST de Pandoc" y que todo pasa por *stdout*. Eso es
**cierto como default**, pero incompleto: Quarto sí tiene una vía de comunicación más rica que el
*stdout* puro — vía **Observable JS** (`ojs`) y celdas de widgets interactivos, el código puede
producir salida que el sistema integra de forma más estructurada que texto plano. Sigue siendo
verdad que **no hay un contrato tipado `emit_*` genérico contra el AST de Pandoc en sí** (no hay
un `emit_table` que devuelva un nodo Pandoc nativo desde Python) — así que la diferencia central
que motivó todo el diseño de Matex **sigue siendo real**, pero conviene decirlo con precisión:
Quarto resolvió *parte* del problema (multi-backend desde un AST real) y dejó *otra parte* sin
resolver (código con acceso tipado al AST) — no las dos cosas sin resolver, como parecía sugerir
la charla original.

**Freeze — Quarto ya tiene esto, con ese nombre exacto.** Este es el hallazgo más relevante de
verificar contra fuentes actuales: Quarto tiene una función llamada literalmente `freeze` (a
nivel de proyecto), que **persiste los resultados computados para que un re-render no necesite
re-ejecutar el código**. Es, conceptualmente, muy cercano al Invariante I9 + `frozen.output` de
la especificación de Matex. La diferencia real no está en *que exista el freeze* — ya existe en
un competidor directo — sino en **qué tan tipado es lo que se congela**: Quarto congela el
resultado de renderizar (texto/HTML ya producido), Matex aspira a congelar un **nodo AST
tipado**, reutilizable estructuralmente (se puede re-renderizar a otro backend sin volver a
correr Python), no solo "el texto ya hecho".

**Semántica de dominio.** Cero — ni Quarto ni Pandoc tienen noción de "demostración" o
"autómata" como tipo de nodo. Acá no hay corrección que hacer: sigue siendo terreno vacío, y
sigue siendo el argumento más fuerte del wedge de Matex.

### 3.4 Notebooks reactivos (Marimo, Pluto.jl, Observable) — el modelo DAG

**Modelo de ejecución — verificado y confirmado con más precisión que antes.** Marimo construye
un grafo acíclico dirigido real por **análisis estático** de qué variables lee y define cada
celda (no en tiempo de ejecución) — cuando una celda cambia, el sistema **solo** recomputa las
celdas descendientes en el DAG, dejando el resto intacto. Esto es, técnicamente, más fino que la
descripción genérica de "modelo reactivo" que dimos en la charla anterior con Gemini — vale la
pena precisarlo porque es exactamente el trade-off que la especificación de Matex evalúa y
descarta para v1 (§6.4, "V3 diferido"): Marimo ya pagó el costo de construir ese análisis estático
sobre código Python arbitrario, con limitaciones documentadas (`exec()`, `eval()`, y
metaprogramación rompen el análisis de dependencias). Esa limitación reafirma, con evidencia
real y no solo argumento teórico, por qué Matex prioriza "orden de documento + freeze" antes que
un DAG: el DAG reactivo sobre código Python opaco **tiene un costo de ingeniería no trivial y un
techo de qué patrones puede seguir**, no es gratis ni completo incluso para quien ya lo construyó.

**Modelo de documento.** Ni Marimo ni Pluto ni Observable tienen AST de *documento* con
semántica de prosa/teoremas — son grafos de **celdas de código**, con markdown como una celda
más entre otras. El texto sigue sin ser un "ciudadano de primera clase" estructural, aunque la
experiencia de lectura sea mejor que Jupyter.

**Reproducibilidad.** Fuerte en un sentido distinto al de Matex: Marimo guarda el notebook como
`.py` puro (compatible con Git, ejecutable como script), y fuerza que no haya estado oculto — pero
esto es garantía de **determinismo de ejecución**, no de "releer sin ejecutar" (I9). Sigue
necesitando un runtime Python para materializarse, incluso exportado a HTML/WASM.

### 3.5 Typst — el caso que más se parece a la visión de Matex, y hay que decirlo con honestidad

**Este es el punto más importante de todo el informe, y una corrección real respecto de cómo
se lo trató en las charlas anteriores.** La comparación con Gemini mencionaba a Typst solo de
pasada ("aunque usa su propio lenguaje de scripting"), como si fuera una nota al margen. Verificado
contra la arquitectura real de Typst, **no es una nota al margen — es el sistema que más cerca
está, hoy, de lo que `emit_*` aspira a ser**:

- Typst tiene un tipo de valor **`content`** de primera clase: el resultado de evaluar código
  *es* contenido del documento, estructurado y tipado — no texto, no un string que se reparsea.
  Un bloque de código puede construir, componer y devolver `content` directamente
  (`[hello] + [ world]` es concatenación de contenido tipado, no de strings).
- Tiene **`show` rules**: reglas que interceptan un tipo de elemento del árbol y lo transforman —
  conceptualmente muy cercano a lo que sería un `emit_*` interpretado del lado del motor, aplicado
  automáticamente en vez de invocado explícitamente.
- El árbol interno (`Content`) es, según su propia documentación, *"bien estructurado e
  independiente del orden, mucho más apto para procesamiento posterior que el markup crudo"* —
  es, en el vocabulario de Matex, casi literalmente el AST resuelto post-compute-pass.

**La diferencia real, entonces, no es "Typst no tiene esto" — es dónde vive el poder de
cómputo.** Typst resuelve el problema con **su propio lenguaje de scripting**, diseñado desde
cero *para* producir `content`. Matex apuesta a **Python**, un lenguaje general con todo su
ecosistema (`pandas`, `networkx`, `sympy`, `scipy`) — lo que gana en potencia y en curva de
aprendizaje para quien ya sabe Python, lo paga en que Python **no fue diseñado** para producir
`content` tipado, así que necesita todo el aparato de adaptadores (`emit_table`, clases
isomorfas del addendum) que Typst no necesita porque su lenguaje ya nació con esa forma.

**Semántica de dominio — acá sigue sin haber competencia real.** Typst tiene tipografía
matemática excelente (mejor que la de LaTeX en varios aspectos, según reportes independientes) y
un sistema de paquetes creciente, pero **tampoco** tiene nodos de primer nivel para
"demostración estructurada" o "autómata declarado por transiciones" — sigue siendo, como LaTeX,
un sistema de *tipografía y cómputo genérico*, no de *semántica matemática de dominio*. El wedge
de `vision-y-alcance.md` sigue intacto frente a Typst — pero el argumento de "Python con acceso
tipado al AST es un diferencial arquitectónico" se debilita bastante frente a Typst, porque Typst
ya lo tiene, con su propio lenguaje.

### 3.6 MyST / Jupyter Book (mención breve, por ser candidato de sintaxis-huésped en `modelo-semantico.md`)

Comparten AST (basado en el mismo linaje que Pandoc/CommonMark extendido) y el mismo patrón de
Quarto en cuanto a ejecución (vía Jupyter, texto/objetos, no `emit_*` tipado hacia el AST de
MyST). Se menciona porque `vision-y-alcance.md` los cita como candidatos de sintaxis de
superficie — la comparación de fondo con MyST, en el eje que importa acá (código↔AST tipado), es
la misma que con Quarto: AST real, pero sin contrato de tipos entre código y árbol.

---

## 4 · Correcciones a lo asumido en las charlas previas (transparencia)

Vale la pena dejar explícitas dos correcciones, porque las charlas con Gemini que motivaron el
diseño de Matex subestimaron a la competencia en puntos verificables:

1. **Quarto ya tiene `freeze`**, con ese nombre y ese propósito — persistir cómputo para no
   re-ejecutar en cada render. No es una idea exclusiva de Matex; la novedad real de Matex, si se
   sostiene, es que lo que se congela es un **nodo AST tipado y reutilizable entre backends**, no
   el resultado de render ya aplanado.
2. **Typst ya resuelve, con su propio lenguaje, el problema central que motivó todo el diseño de
   `emit_*`** — código que produce contenido tipado del árbol, no texto ciego. La apuesta
   diferencial de Matex no es "tener esto" (Typst lo tiene), es **tenerlo con Python** (potencia
   de ecosistema, curva de aprendizaje más baja para quien no quiere aprender un lenguaje nuevo) y
   combinarlo con **semántica de dominio matemático que ni Typst ni nadie más modela hoy**.

---

## 5 · Dónde queda, honestamente, el diferencial de Matex

Sacando lo que ya existe en otro lado (AST real: Quarto/Typst/MyST; freeze: Quarto; contenido
tipado desde código: Typst), lo que sobrevive como genuinamente no cubierto por nadie, según esta
comparación, es la **intersección** de tres cosas que hoy nadie tiene las tres a la vez:

| Capacidad | ¿Alguien la tiene ya? |
|---|---|
| AST semántico real, multi-backend | sí — Quarto/Pandoc, Typst, MyST |
| Código produce contenido tipado del árbol (no texto ciego) | sí — Typst (con su propio lenguaje) |
| Con **Python** específicamente (no un lenguaje nuevo) | no, ni Quarto (stdout/ojs) ni Typst (lenguaje propio) lo resuelven así |
| Nodos de dominio matemático de primer nivel (demostración estructurada, grafo, autómata) | **no, nadie** |
| Namespace único con dos productores (declarativo transparente + Python opaco) explícitamente distinguidos | **no, nadie** — es una idea propia de este diseño, no vista en ningún competidor relevado |

Las dos últimas filas son, con la evidencia reunida acá, el argumento real. Las primeras tres —
aunque cada una por separado ya exista en algún lado — **no están combinadas en ningún producto
existente**, y esa combinación es la apuesta arquitectónica de fondo, no cualquiera de las piezas
sueltas por sí sola.

---

## 6 · Nota para `02-estado-del-arte/`

Si ese documento (no disponible acá) todavía no incorpora el hallazgo de §3.5 sobre Typst con el
peso que amerita, vale la pena revisarlo — es, de los seis sistemas relevados, el que más de
cerca pone en cuestión la premisa de "nadie tiene código con acceso tipado al AST". La defensa
que sostiene, aun así, la tesis del proyecto (`vision-y-alcance.md` §7) no cambia: el vertical
slice sigue siendo la prueba real, y ningún competidor —ni Typst— resuelve hoy la semántica de
demostración estructurada que es, según Regla 1 de `reglas-del-modelo.md`, el corazón declarado
del proyecto.

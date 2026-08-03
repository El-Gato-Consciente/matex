# Especificación de diseño (borrador) — Nodos ejecutables y entorno de entidades en Matex

> **Estado de este documento:** 🟡 **borrador normativo, pre-implementación**. Sigue el esqueleto
> de [`metadocumento-especificacion-diseno.md`](metadocumento-especificacion-diseno.md). No es
> Visión (eso vive en `nodos-ejecutables-propuesta.md` y `entorno-de-entidades-estudio.md`, que
> siguen siendo la fuente de la motivación) ni Referencia (nada de lo que sigue compila hoy —
> `referencia-v1.md` no tiene ninguno de estos nodos todavía). Es el punto medio: **lo que
> debería cumplir cualquier implementación**, aunque la implementación no exista.
>
> Cada pieza lleva su estado: `✅` ya implementado y real · `🟡` **propuesto en este borrador, NO
> ratificado por el proyecto** (candidato, no verdad) · `⬜` abierto, sin decidir · `❌` descartado.
>
> **Procedencia y auditoría.** Este documento se produjo **fuera de este ecosistema** (conversaciones
> con Gemini) y fue **auditado el 2026-07-22** contra el código real, las 4 reglas y las conclusiones
> ya establecidas — ver [`08-auditoria/auditoria-spec-nodos-ejecutables.md`](../08-auditoria/auditoria-spec-nodos-ejecutables.md).
> Esta versión ya incorpora las correcciones de esa auditoría (I4 vs. valores de namespace resuelto;
> `emit_expr`/`emit_series` precisados; colisión de notación `②` → productores **D/I**; §11.3 marcado
> como dependiente de F-3). Lo marcado `🟡` sigue siendo **propuesta a vetear**, no decisión del
> proyecto; las afirmaciones competitivas del comparativo están **sin verificar contra fuente**.

---

## 0 · Alcance de esta especificación

Cubre exclusivamente la extensión del AST de Matex para soportar: (a) entidades declarativas
nombradas, (b) nodos de código ejecutable (Python), y (c) el entorno/namespace que los conecta a
ambos y a los nodos estáticos existentes. **No** re-especifica el AST estático ya existente
(`referencia-v1.md`) salvo donde esta extensión lo toca.

---

## 1 · Glosario

| Término | Definición | Se confunde con... y en qué difiere |
|---|---|---|
| **Nodo estático** | Nodo del AST que no computa nada — `table`, `heading`, `theorem`, etc. Hoy `✅` todo el AST es esto. | — |
| **Entidad** | Un valor nombrado, referenciable desde otros puntos del documento (`f`, `datos`). Toda entidad tiene un nodo que la declara, pero no todo nodo declara una entidad (un `paragraph` no lo es). | *Nodo* — la entidad es lo que el nodo **liga a un nombre**, no el nodo en sí. |
| **Namespace / entorno** | El espacio compartido nombre→valor, acumulado en orden de aparición. **Uno solo**, no uno por tipo de productor (Invariante I1). | *Contexto de una celda Python* — no es un contexto aparte; es una vista sobre el mismo namespace. |
| **Productor D** (declarativo) | Lo que liga entidades resolviendo expresiones nativas del motor (`f = x²`). Transparente, barato de re-resolver. | *Productor I* — ver siguiente fila. |
| **Productor I** (imperativo) | Lo que liga entidades corriendo código Python. Opaco, caro de re-ejecutar. | — |
| **Consumidor** | Cualquier nodo que lee una entidad del namespace por nombre, sin importar quién la produjo. | *Referencia cruzada* clásica (`\cref`) — es un caso particular de consumidor. |
| **Contrato `emit_*`** | El conjunto de funciones (`emit_table`, `emit_expr`, `emit_series`, `emit_value`) que un nodo Python usa para producir una entidad **tipada** (nodo AST) en su propia posición. Es la vía para **contenido estructurado**; los escalares crudos pueden además materializarse vía un `ref` (ver I4). | *Escritura directa de AST* — está prohibida (Invariante I4); `emit_*` es un constructor que corre en el compute pass, no acceso al árbol. |
| **Freeze / materializar** | Persistir dentro del documento fuente el resultado de una ejecución, con procedencia, para no depender de re-ejecutar código al releer. | *Cachear* — el freeze es visible y versionado, no es una optimización interna. |
| **Procedencia** | Metadato `hash(código + deps + inputs)` que acompaña a un valor congelado producido por código, para saber si sigue vigente. | — |
| **Nodo `exec`** | Nodo Python silencioso: liga entidades en el namespace, no produce salida visible en su propia posición. | *`table-from-code`* — ese sí tiene salida visible en su posición. |
| **Nodo `table-from-code` / `figure-from-code`** | Nodo Python cuyo contrato de salida está fijado por su propio tipo (produce, en su posición, un nodo del tipo declarado). | *`exec`* — ver fila anterior. |
| **Política compartida** (Regla 3 de `reglas-del-modelo.md`) | Decisión que **no** vive en el AST, la toma el sistema, y **debe** dar el mismo resultado en todos los backends. *(Los "①②③④" de `computo-y-capas.md` son las **capas**; los productores de este spec son **D/I** para no colisionar con esa notación.)* | — |
| **P (función pura FFI)** | Un nombre declarado con firma explícita y cuerpo Python, invocable desde expresiones declarativas como si fuera nativa (`P(x,y)`). | *Nodo `exec`/`table-from-code`* — P es una **entrada** al namespace declarativo, no un productor de salida visible. |

---

## 2 · Principios / invariantes no negociables

| # | Invariante | Se viola así (bug observable) |
|---|---|---|
| **I1** | Hay **un** namespace compartido, poblado por los dos productores. Nunca dos espacios separados. | Una entidad `f` declarativa que la prosa referencia bien, pero que una celda Python no puede leer (o viceversa). |
| **I2** | Cada nodo ve **solo lo acumulado hasta su posición** (orden de documento). No hay DAG global en v1. | Un nodo de arriba cambia su valor visible porque algo de más abajo se reevaluó. |
| **I3** | El AST guarda **intención**, no resultados derivados — salvo freeze explícito. | Coordenadas/valores computados persistidos "a mano" en el AST, que quedan viejos sin que nada lo marque. |
| **I4** | Ningún nodo de código **escribe el AST directamente**. Ligar un nombre en el namespace con cualquier valor Python es libre (no es "llegar al AST"); **volverse contenido visible** ocurre solo por dos vías mediadas por el sistema en el compute pass: `emit_*` (nodo tipado en la posición del código) o un `ref` que **materializa** un valor del namespace en su propia posición (escalar → inline; valor estructurado → debe haberse tipado antes con `emit_*`). | Un nodo Python que arma un `TableNode` a mano y lo inserta en el árbol, saltándose el constructor y el compute pass. |
| **I5** | Ningún backend ejecuta código en tiempo de render. Consume valores ya resueltos/congelados. | Un PDF que, para regenerarse, necesita tener Python disponible. |
| **I6** | Toda decisión agnóstica de backend (política compartida) da el mismo resultado en todos los backends. | Un LaTeX que numera distinto que el HTML para el mismo documento. |
| **I7** | Si un backend no puede representar algo fielmente, **avisa**; nunca finge coincidencia. | Un DataFrame con `MultiIndex` que se aplana en silencio, sin que el autor se entere de qué se perdió. |
| **I8** | El código corre aislado (sandbox); no tiene I/O libre ni acceso implícito a nada fuera de lo que se le pasa. | Una celda Python que lee un archivo del disco del servidor sin que el autor lo haya declarado como recurso. |
| **I9** | Un documento congelado se relee sin re-ejecutar Python. | Abrir un `.mtex` viejo y que tarde/falle porque intenta correr código desactualizado. |

---

## 3 · Modelo de datos — catálogo de nodos

### 3.1 Nodos estáticos (ya existentes, sin cambios)

`✅` Sin cambios respecto de `referencia-v1.md` — `table`, `heading`, `theorem`, etc. Se
mencionan acá solo porque son **consumidores potenciales** de entidades (ver §3.4).

### 3.2 Nodos de definición — entidad declarativa

`🟡` Nuevo.

| Atributo | Tipo | Notas |
|---|---|---|
| `nombre` | string | identificador único desde ese punto en adelante hacia abajo |
| `expresion` | expresión nativa del motor | evaluada por el productor D (declarativo) |
| `atributos?` | mapa opcional | p. ej. color/rol, ver ME-38 — capa 2 (presentación), no cambia la semántica |

**Contención:** hoja (no contiene otros nodos de bloque). **Referencias:** puede citar entidades
previas en su propia `expresion`. **Proyección:** no tiene salida visible propia — es infra para
quien la consuma (plot, prosa, tabla).

### 3.3 Nodos ejecutables (Python)

| Tipo | Salida visible en su posición | Liga entidades | Estado |
|---|---|---|---|
| `exec` | no | sí — `emit_*` liga una entidad **tipada**; una asignación simple (`y = …`) liga un **valor de namespace** (consumible por más código, o renderizable por un `ref` **solo si es escalar**; ver I4) | 🟡 |
| `eval` (inline) | sí, un valor inline | opcionalmente | 🟡 |
| `code-block` (visible) | sí, código + salida | opcionalmente | 🟡 |
| `table-from-code` | sí, un nodo `table` | implícitamente (su propio resultado) | 🟡 |
| `figure-from-code` | sí, datos de serie (`PlotDataSeries`) | implícitamente | 🟡 |

**Atributos comunes:** `source` (código), `lang` (`"python"` por defecto, agnóstico a futuro),
`frozen?` (`{ output, hash }`, ver §6.3). **Regla de contrato (Invariante I4):** un nodo de tipo
`table-from-code` **solo** admite que su código llame `emit_table`; llamar `emit_expr` ahí es un
error de contrato (ver §8.2), no una alternativa válida.

**Proyección y fallback:** ninguno de estos nodos llega vivo al backend — para cuando el backend
los recorre, ya fueron reemplazados por su `frozen.output` (ver §6). El backend **no necesita
saber que existieron como código** — litmus test heredado de `nodos-ejecutables-propuesta.md` §6:
*"borrar la capa ejecutable no debe romper nada; el compilador no sabe de Python"*.

### 3.4 Nodos de referencia / inyección

`🟡` Nuevo.

| Atributo | Tipo | Notas |
|---|---|---|
| `entidad` | string | nombre a resolver en el namespace en ese punto |
| `modo?` | enum | `inline` \| `bloque` — cómo se espera que se renderice lo referenciado |

**Contención:** hoja. **Resolución:** en tiempo de compute pass, no en render. **Fallback:**
si `entidad` no está definida en ese punto (viola I2 — está "más abajo" o no existe), **es un
error de compilación**, no un valor vacío silencioso (Invariante I7 aplicado acá también).

---

## 4 · Modelo de entorno / namespace

### 4.1 Un solo espacio, dos productores

```
D  entidad = expr nativa           ── transparente, barato, DAG-friendly
I  entidad = emit_*(código Python) ── opaco, caro, orden-secuencial

            ambos escriben al MISMO namespace (Invariante I1)
```

| | Productor D (declarativo) | Productor I (imperativo) |
|---|---|---|
| Quién computa | el sistema | el autor (runtime Pyodide/sandbox) |
| Transparencia | rica — el motor deriva/integra/busca raíces sobre la entidad | plana — dato opaco salvo que se tipe vía `emit_*` |
| Costo de recomputar | bajo | alto |
| Nivel (cómputo, `nodos-ejecutables-propuesta.md`) | 1 / 1.5 | 2 |

### 4.2 Regla de visibilidad — "solo lo previo"

Un nodo en la posición *N*, al resolverse, recibe el namespace acumulado por **todos** los
nodos con posición < *N*, en orden de documento. No ve nada de posición ≥ *N*. Esto es
automático por construcción (Invariante I2) — no hace falta filtrar explícitamente.

**Reasignación (`rebind`):** un nodo Python puede reasignar un nombre ya existente. El efecto es
**siempre hacia abajo** — los nodos ya evaluados arriba no cambian. Las entidades declarativas
(las declarativas, en cambio, deberían ser de asignación única — ver §12, no-objetivo de mutación declarativa).

### 4.3 `P` — la bisagra de función pura (FFI)

`🟡` Patrón admitido para llamar Python desde una expresión declarativa sin pagar el costo de
opacidad total:

```
P(x, y) = «python: def P(x, y): return …»    -- firma declarada, cuerpo opaco
f = P(x, 0) + x²                              -- el sistema VE  f → P  (P es hoja)
```

**Condición de admisión (obligatoria, no opcional):**
1. **Pureza** — sin efectos, determinista.
2. **Cerradura** — `P` corre en un **scope aislado que contiene solo sus argumentos**, sin
   acceso al namespace global. Si necesita una entidad `a`, debe recibirla como argumento
   explícito (`P(x,y,a)`).

Bajo estas dos condiciones, todo ciclo que involucre a `P` es **detectable** (vive en el grafo
transparente de llamadas, nunca escondido dentro del cuerpo opaco). Sin cerradura enforced, un
ciclo podría esconderse dentro de `P` y no ser detectable — por eso la cerradura no es una
optimización, es lo que mantiene el sistema *cycle-safe by construction*.

---

## 5 · El contrato de tipos `emit_*`

### 5.1 Tabla de conversión (ejemplo trabajado: `emit_table`)

| Campo de origen (`DataFrame`) | Campo de destino (nodo `table`) | Política si no calza |
|---|---|---|
| `df.columns` | `header` | — |
| `df.values` (fila) | `tableRow[]` | — |
| valor de celda (`float`/`str`/`np.number`) | contenido inline de `tableCell` | numérico → texto; si es expresión simbólica, **normalizar** como `mathInline` (`tex`, mismo canon que `emit_expr` — sin reparse a estructura) |
| `df.index` | *(no tiene destino directo hoy)* | ⬜ decidir: ¿columna extra opcional, o se descarta con aviso? |
| `MultiIndex` en columnas o filas | *(sin equivalente en el schema `table` actual)* | **degrada con aviso explícito** (Invariante I7) — nunca aplanar en silencio |
| formato condicional por celda | *(sin equivalente)* | igual que arriba — avisar, no fingir |

### 5.2 La prueba de admisión (reusada de `reglas-del-modelo.md`, Regla 4)

Antes de que una capacidad nueva de `emit_table` (o de cualquier `emit_*`) entre al contrato:

1. ¿Le ahorra carpintería real a quien escribe la celda de código, o es un ajuste fino?
2. ¿Lo pueden honrar **todos** los backends de salida?
3. Si un backend no puede, ¿el sistema avisa o miente?
4. ¿Es algo que dos personas podrían querer distinto para el mismo documento (→ `opts`, efímero)
   o define qué *es* la tabla (→ entra al contrato)?

### 5.3 Otras funciones del contrato (mismo patrón, sin tabla completa todavía)

| Función | Entrada | Salida AST | Estado |
|---|---|---|---|
| `emit_expr` | expresión sympy | `mathInline`/`mathDisplay`: `sympy.latex` → **normalizado** por el canon (macros) → string `tex`. **No hay reparse a AST estructurado** — la mate en prosa es `tex` crudo (F-3, sin resolver) | 🟡 diseñado, sin tabla de campos cerrada |
| `emit_series` | `xs, ys` (+ estilo opcional) | `PlotDataSeries` (color/estilo/grosor/interpolación de ME-38/45; **nota:** las series no tienen `role`, ese campo es de `PlotFunction`) | 🟡 |
| `emit_value` | escalar + label | valor inline | 🟡 |

---

## 6 · Modelo de ejecución

### 6.1 Pipeline

```
1. Parse        → AST "sucio" (estático + entidades + ejecutables + referencias), inmutable desde acá en adelante
2. Compute pass  → recorrido secuencial; puebla el namespace (productores D e I); resuelve referencias; produce frozen.output en cada nodo ejecutable
3. Render        → backend recorre el AST resuelto; NUNCA ejecuta código (Invariante I5); NUNCA consulta el namespace directamente — lee frozen.output ya adjunto al nodo
```

### 6.2 Los tres momentos

| Momento | Dónde | Ejecuta código | Se persiste |
|---|---|---|---|
| **Build-time** | compute pass, antes de render | sí, una vez | sí (`frozen`) |
| **Edit-time** | editor del autor (Pyodide) | sí, en vivo, para preview | no |
| **Runtime (consumo)** | navegador del lector (Pyodide) | solo si hay interactividad de lector (slider alimentando código) | no |

### 6.3 Freeze y procedencia

```
{ kind: 'computed', source: <código>, output: <nodo AST>, frozen: true, hash: <código+deps> }
```

- Al reabrir el documento, **no se re-ejecuta** — se lee `output`.
- Se recomputa solo si el autor lo pide, o si `hash` no coincide con el código actual (nodo
  marcado "desactualizado" — nunca se muestra un valor viejo como si fuera actual, por I7).
- Entidades **declarativas** (productor D) no necesitan procedencia — son auto-descriptivas y
  reproducibles sin hash (una expresión Matex se explica sola).

### 6.4 Progresión de costo (v1 → v3, no bloqueante)

| | Modelo | Qué da | Cuándo |
|---|---|---|---|
| **V1** | orden de documento, ejecución fresca por build | reproducible, simple, sin DAG | 🟡 objetivo de esta especificación |
| **V2** | + procedencia/caché, recomputa solo lo stale | más rápido | ⬜ diferido |
| **V3** | DAG reactivo, posición-independiente | reactividad total | ⬜ diferido — territorio Marimo/Observable, caro en el lado Python |

---

## 7 · Política compartida (extiende la tabla de `reglas-del-modelo.md` §Regla 3)

| Decisión | Política | Estado |
|---|---|---|
| Orden de evaluación del compute pass | orden de documento (V1), no DAG | 🟡 a verificar cuando exista implementación |
| Qué namespace ve un nodo | "solo lo previo", idéntico en todo backend/editor | 🟡 |
| Traducción `emit_table`→`table` | tabla de §5.1, idéntica sea cual sea el backend consumidor final | 🟡 |
| Qué pasa si `entidad` referenciada no existe | error de compilación, nunca valor vacío | 🟡 |
| Qué pasa si un backend no puede representar el resultado congelado | avisa (igual que `rawLatex`/`include` hoy) | ✅ patrón ya usado, se reusa acá |

---

## 8 · Errores y casos límite

### 8.1 Ciclos

- **Vía `P` (función pura, cerrada):** todo ciclo vive en el grafo transparente de llamadas →
  **detectable**, se rechaza con error tipo "referencia circular" (mismo lenguaje que una
  planilla de cálculo).
- **Recursión dentro de una celda Python (`def f(x): return f(x-1)`):** normal, contenida en la
  caja opaca, el sistema ni se entera — no es un ciclo del namespace.
- **Ciclo "a través del grafo" (`f = P(f)`):** rechazado.

### 8.2 Contrato de tipos violado

Un nodo `table-from-code` cuyo código llama `emit_expr` en vez de `emit_table`: **falla en el
compute pass**, con mensaje que señale el nodo y el tipo esperado — nunca falla silenciosamente
más tarde en el backend.

### 8.3 Tipo de origen no representable en el AST destino

Ver §5.1 (fila `MultiIndex`) — degrada con aviso explícito al autor, nunca en silencio.

### 8.4 No determinismo

Si el código de una celda no es determinista (p. ej. usa aleatoriedad sin seed fijo), el freeze
sigue siendo válido (es un valor congelado), pero la procedencia debe marcarlo como
**no-reproducible-sin-el-freeze** — releer el documento sigue funcionando (I9), pero recomputar
puede dar otro valor y el sistema no debe presentarlo como si fuera a dar lo mismo.

---

## 9 · Seguridad y aislamiento

- **Pyodide-first:** el código corre en el sandbox del navegador — nunca toca un servidor por
  defecto, offline tras la carga inicial.
- **`P` cerrada (§4.3):** sin acceso al namespace global salvo argumentos explícitos — además de
  DAG-friendly, es la primera línea de defensa contra dependencias ocultas.
- **Backend con kernel** (contenedor efímero, sin red) — `⬜` diferido, solo si un caso de librerías
  pesadas lo justifica; superficie de seguridad permanente, no es el camino por defecto.
- **Determinismo forzado:** seeds fijos por defecto; lo no-determinista se marca explícitamente
  en la procedencia (ver §8.4).

---

## 10 · Versionado y migración

- **Del lado del documento:** cualquier nodo nuevo de esta especificación pide bump de
  `MATEX_AST_VERSION` (mismo mecanismo que `reglas-del-modelo.md` ya define para ①).
- **Del lado de la API que usa el código embebido:** los constructores `emit_*` son el punto de
  absorción de compatibilidad — si el schema de `table` agrega un campo, `emit_table` debe poder
  seguir aceptando el código Python viejo y completar el campo nuevo con un default, en vez de
  romper scripts existentes. *(Insight incorporado de la conversación con Gemini, ver
  `gemini-vs-matex-cotejo.md` §1.2.)*

---

## 11 · Casos de uso trabajados

### 11.1 Caso trivial — sin nodos ejecutables

Documento sin entidades ni código. AST idéntico al de hoy (`referencia-v1.md`). Ningún backend
nota diferencia. *(Prueba de que la extensión no penaliza al caso simple.)*

### 11.2 Declarativo → Python (una dirección)

```
D  a = 5
D  f = a·x²
I  exec: "y = f(2) * 10"            -- lee f y a del namespace, liga y
R  ref: y                           -- consume y en prosa: "el resultado es {{y}}"
```

Namespace tras compute pass: `{a: 5, f: <entidad>, y: 50}`. `y` es un **valor de namespace**
(asignación simple, no `emit_*`). El nodo `ref` en posición 4 ve todo lo anterior (I2); como `y`
es **escalar**, el `ref` lo **materializa inline** (conversión trivial, equivalente a `emit_value`,
hecha por el sistema en el compute pass — no es Python escribiendo el árbol, ver I4). Si `y` fuera
un valor **estructurado** (un DataFrame), el `ref` daría error: habría que tiparlo antes con
`emit_table`. El backend, al llegar al `ref`, lee `frozen.output` — no ejecuta nada (I5).

### 11.3 Python → declarativo (dirección inversa, vía `emit_expr`)

```
I  exec: "P = matex.emit_expr(sympy.diff(f_expr, x))"   -- ver caveat abajo
D  g = 2·P                                               -- solo si P es una entidad evaluable
```

> **⚠️ Caveat (auditoría 2026-07-22) — este caso depende de F-3, sin resolver.** Hay **dos** cosas
> distintas que se confunden acá: (a) **mostrar** una expresión computada en la prosa → `emit_expr`
> produce un `mathInline` (`tex`), que **no es evaluable** (es un string); (b) **ligar una entidad
> matemática reutilizable y evaluable** (para que `g = 2·P` la derive/integre) → requiere una forma
> **estructurada** (un `ExprNode`, como los del subsistema de plots vía `parseExpr(latex)`), que en
> la prosa **no existe** hoy (es exactamente F-3: la mate en prosa es `tex` opaco). Así que (a) es
> factible ya; (b) **está bloqueado por F-3** o exige reusar el parser de expresiones de plots. Este
> caso de uso mezcla los dos — se deja como **🟡 dependiente de F-3**, no como algo que ya cierra.

### 11.4 Caso del usuario original — `exec` + referencia desacoplada

```
I  exec: "df = cargar_dataset(); datos = matex.emit_table(df)"  -- silencioso, liga 'datos' (tipada)
   ... (texto intermedio) ...
R  ref { entidad: "datos", modo: "bloque" }                     -- acá aparece la tabla
```

El nodo `exec` **no** tiene salida visible en su posición (§3.3). El nodo `ref`, varias
posiciones más abajo, es el placeholder estático que sí estaba en el AST desde el autorado
(§8.3 del intercambio previo) — resuelve `datos` contra el namespace y su `frozen.output` es el
nodo `table` completo producido por `emit_table`.

### 11.5 Caso de falla — degradación con aviso

```
I  exec: "df = pd.DataFrame(..., index=multiindex); t = matex.emit_table(df)"
```

`df.index` es `MultiIndex` → cae en la fila de §5.1 sin equivalente. El compute pass **no** falla
silenciosamente ni aplana sin decir nada: adjunta al `frozen.output` un aviso (visible en editor,
y como comentario/nota en el backend que lo consuma) de que la estructura de índice se perdió.

### 11.6 `P` como bisagra pura

```
I  P(x, y) = «python: def P(x,y): return métrica_costosa(x,y)»   -- función pura (FFI, §4.3)
D  costo = P(a, b) + overhead
```

`P` entra al DAG declarativo como hoja; si `a` o `b` cambian, `costo` queda stale y se recomputa
(re-ejecutando `P` una vez, ya que es pura).

---

## 12 · Límites y no-objetivos explícitos

- ❌ **No** hay DAG reactivo global en esta versión — es V3, diferido (§6.4).
- ❌ **No** hay mutación directa del AST desde código Python — todo pasa por `emit_*` (I4).
- ❌ **No** se implementa un CAS simbólico nativo — para eso existe el escape hatch de Python
  (`sympy`), no se reinventa dentro del motor declarativo.
- ❌ **No** hay reactividad entre celdas Python (rastrear dependencias dentro de código opaco) —
  eso es Nivel 2 Fase C de `nodos-ejecutables-propuesta.md`, diferido hasta demanda real.
- ❌ **No** hay backend con kernel persistente por defecto — Pyodide-first, kernel-con-red solo
  bajo demanda paga.
- ❌ **No** se admiten entidades declarativas mutables/reasignables (a diferencia de Python) —
  ver pregunta abierta si esto se revisa.

---

## 13 · Preguntas abiertas

| Pregunta | Condición de cierre |
|---|---|
| ¿Dónde viven las definiciones en el árbol — bloques en orden, sección `meta` global, o híbrido? | Cuando se implemente el primer vertical slice de `table-from-code` y se observe qué autores necesitan de verdad. |
| ¿`emit_table` debe soportar headers multinivel (`MultiIndex`)? | Cuando aparezca un caso de autor real que lo pida — no de escritorio. |
| ¿Vale la pena un *multipass* para referencias declarativas hacia adelante (índice, total)? | Cuando "solo lo previo" bloquee un caso de uso real documentado — y limitado al lado declarativo (ver `gemini-vs-matex-cotejo.md` §1.1). |
| ¿El índice de un `DataFrame` (`df.index`) merece un destino propio en `table`, o se descarta siempre? | Al cerrar la tabla completa de §5.1 contra un caso de uso real de tabla con índice significativo. |

---

## 14 · Bitácora de decisiones

- **2026-07.** Se descarta que el código Python mute el AST directamente (AST rewriting), a favor
  de hidratación de namespace + contrato tipado `emit_*`. Razón: seguridad, debug (un solo lugar
  para inspeccionar — el namespace resuelto), y portabilidad multi-backend (un backend nunca
  necesita saber que algo vino de código).
- **2026-07.** Se descarta un DAG reactivo general para v1. Razón: el costo real está solo del
  lado Python (rastrear dependencias en código opaco); el lado declarativo ya soporta el patrón
  del slider sin DAG completo. Se prioriza "orden de documento + freeze" (V1) sobre el DAG (V3).
- **2026-07.** `verify` (Nivel 1.5) baja de "feature estrella" a extra opcional; el foco pasa a
  "valor computado por intención" — ver `nodos-ejecutables-propuesta.md`, nota del 2026-07-22.

---

## 15 · Estrategia de verificación

- **Un test de equivalencia por fila de §7** (política compartida), corrido sobre todos los
  backends existentes más el editor visual como tercer backend (mismo criterio que QA-08 en
  `reglas-del-modelo.md`).
- **Un test por caso de uso de §11**, verificando el `frozen.output` esperado en cada nodo y la
  salida final en cada backend.
- **Un test por fila de la taxonomía de errores de §8**, verificando que el sistema avisa/falla
  exactamente como se especifica — nunca degrada en silencio.
- **Un test de reproducibilidad (I9):** releer un documento congelado sin runtime Python
  disponible debe producir salida idéntica a la de la primera compilación.

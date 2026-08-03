# Estudio de diseño — Matex como entorno de entidades (arquitectura futura posible)

> **Esto es un ESTUDIO, no un plan.** Captura una idea potente (usuario, 2026-07-22) para que no se
> pierda, con su análisis honesto: qué gana, qué cuesta, y —lo central— **cómo se unifica con los
> nodos ejecutables** ([nodos-ejecutables-propuesta.md](nodos-ejecutables-propuesta.md)). **No se
> recomienda emprenderlo ahora:** es un rediseño estratégico que toca la identidad del producto
> (Regla 1) y trae la complejidad que el backlog difirió a propósito. Se documenta como **norte
> posible** y se da el **camino incremental** para ganar sus beneficios sin la apuesta big-bang.
>
> **Rol (ver [`README.md`](README.md)): este doc es el *porqué* (racional de diseño), NO el *qué*
> normativo.** La versión normativa —invariantes, contrato `emit_*`, modelo de ejecución— vive en
> [`spec-nodos-ejecutables-matex-borrador.md`](spec-nodos-ejecutables-matex-borrador.md) (auditado).
> **Si este estudio y el spec parecen diferir, gana el spec.** Mapa de correspondencia:
>
> | Este estudio (racional) | Spec (normativo) |
> |---|---|
> | §2 un namespace, dos productores | I1 · §4.1 |
> | §5 relación con el AST (intención/derivado) | I3 |
> | §6 reactivo-declarativo, nunca objetos vivos | §12 (no-objetivos) · I3 |
> | §7 orden de ejecución (secuencial, "solo lo previo") | I2 · §4.2 · §6.4 |
> | §8 Python función-pura (FFI) + ciclos/aislamiento | §4.3 · §8.1 |
> | §9 dos regiones (scope global vs cuerpo) | §3.3 · §4.1-4.2 |

---

## 1 · La idea: traer el cómputo al frente

Hoy las funciones viven **dentro** de un plot (`f1`, `f2` son índices locales de un `PlotSpec`). La
propuesta **invierte la propiedad**:

1. Un **panel de definiciones** donde se declaran **entidades**: funciones `y=f(x)`, relaciones x-y,
   implícitas, cónicas, paramétricas, polares, datasets. Entidades **con nombre**, del documento.
2. Sobre esas entidades se hacen **cálculos** de todo tipo (raíces, derivada, ∫, intersección…),
   que también quedan como **valores nombrados**.
3. **Recién ahí** un plot de ejes es **una vista** que muestra *algunas* de esas entidades. Deja de
   ser el dueño; pasa a ser un consumidor.

El beneficio que persigue: esas entidades y cálculos **existen independientes** → reusables por la
prosa (materializar un valor en el texto), por tablas, por **otro** plot, o por **código Python**.

Es el modelo de **GeoGebra / Mathematica / Desmos / Observable**: una vista algebraica de objetos +
vistas que los consumen. Si diseñaras Matex de cero con "cómputo reusable en todos lados" como norte,
probablemente aterrizarías acá.

---

## 2 · La unificación con los nodos ejecutables (lo que pediste)

Este es el corazón. La propuesta de nodos ejecutables y la de entorno de entidades **no son dos ideas
que compiten — son la misma arquitectura vista desde dos lados.** El pegamento es un concepto que
ninguna de las dos, por separado, nombra:

> **UN espacio de nombres (namespace) del documento. DOS productores. MUCHOS consumidores.**

```
              PRODUCTORES                     NAMESPACE                  CONSUMIDORES
  ┌───────────────────────────────┐      ┌──────────────┐        ┌────────────────────────┐
  │ ① Declarativo (entidades)     │─────▶│  f = x²       │───────▶│ plot (vista de ejes)   │
  │   f=x², roots(f), ∫f          │      │  g = sin(x)   │        │ prosa ("∫f = [4.5]")   │
  │   motor nativo (② de capas)   │      │  data1 = …    │        │ tabla                  │
  ├───────────────────────────────┤      │  raices_f = … │        │ otro plot              │
  │ ② Imperativo (nodos Python)   │─────▶│  resultado_py │        │ otro nodo Python       │
  │   emit_expr/table/series/value│      └──────────────┘        └────────────────────────┘
  │   runtime (Pyodide/sandbox)   │
  └───────────────────────────────┘
```

- **Los dos ideas populan el MISMO namespace.** Una función declarativa `f=x²` y un valor que
  produce una celda Python son **ambos entidades nombradas** en el mismo espacio. La diferencia es
  **cómo se producen**, no dónde viven.
- **El contrato `emit_*` de los nodos ejecutables** (`emit_expr/table/series/value`, ver
  [nodos-ejecutables-propuesta.md](nodos-ejecutables-propuesta.md) §4.3) deja de ser "insertar un
  nodo acá" y pasa a ser **"ligar un valor a un nombre en el namespace"**. `f = matex.emit_expr(…)`
  mete `f` en el espacio; después un plot **o** la prosa lo referencian por nombre. Esa es la
  generalización: de *emisión inline de una sola vez* a *entidad referenciable y reutilizable*.
- **Los consumidores no distinguen el origen.** Un plot que dibuja `f` no sabe (ni le importa) si `f`
  vino de una definición declarativa o de una celda Python. La referenciabilidad es uniforme.

### La diferencia real entre los dos productores

No son intercambiables — cada uno tiene una naturaleza (es el eje declarativo↔imperativo de
[[dynamism-spectrum]] y de [computo-y-capas.md](computo-y-capas.md) §6):

| | ① Entidad declarativa (`f = x²`) | ② Valor imperativo (celda Python) |
|---|---|---|
| Quién computa | el **sistema** (motor nativo, ya existe) | el **autor** (runtime) |
| Transparencia | **rica**: el motor la puede derivar/integrar/buscar raíces | **plana**: es dato opaco (nº, array, LaTeX) — no se puede analizar más |
| Reactividad | **barata** (recomputar al cambiar dependencias) | **cara** (re-ejecutar código = el DAG diferido) |
| Infraestructura | ninguna (JS puro) | sandbox/Pyodide |
| Nivel (doc ejecutables) | **1.5** | **2** |

**Consecuencia:** una entidad declarativa `f` soporta `{raíces, tangente, ∫, plot}`; un dataset que
emite Python soporta `{scatter, mostrar}`; una **expresión** que emite Python (`emit_expr`) se
**reparsea** a entidad rica → recupera todas las operaciones. El namespace guarda entidades de
distinta "riqueza", y qué se puede hacer con cada una depende de su tipo.

### La secuencia correcta (declarativo primero)

Por el principio del proyecto (slider-antes-que-Python, [[dynamism-spectrum]]):

1. **Primero el namespace con entidades declarativas** (nativo, reactivo-barato, transparente). Esto
   es, en el fondo, **"darle una casa al Nivel 1.5"**: hoy la propuesta de ejecutables trata el 1.5
   como "valores computados inline"; el entorno de entidades lo eleva a "un espacio de entidades
   nombradas". Más ambicioso y más foundational.
2. **Después, las celdas Python como productor ADICIONAL del MISMO namespace** (Nivel 2). Traen el
   DAG/sandbox — el aparato caro que el backlog difiere (§4.6 de la propuesta de ejecutables).

---

## 3 · La restricción de diseño que hay que grabar

> **UN solo namespace, no dos.** El error a evitar es construir el "contexto de valores" de los nodos
> ejecutables **separado** del entorno de entidades declarativas. Si son dos espacios, tenés dos
> mundos incompatibles (una `f` declarativa que la prosa ve, y una `f` de Python que solo otras
> celdas ven). Deben ser **el mismo espacio compartido**, poblado por dos productores.

Esta restricción es barata de respetar **si se decide de entrada**, y carísima de arreglar después.
Es el aporte principal de este estudio: aunque no se construya nada ahora, **cuando se construya
cualquiera de los dos, que sea sobre un namespace único.**

---

## 4 · Lo incómodo — y lo que la *profundidad progresiva* desactiva

Al ponderarlo (usuario, 2026-07-22) apareció una distinción que **desarma las dos objeciones más
grandes**: la capa de cómputo puede ser **opt-in y progresiva**. Quien quiere un documento clásico →
PDF **nunca abre el panel de entidades ni toca Python** — inserta una figura, tipea `x^2`, listo,
igual que hoy. Es *profundidad progresiva* (shallow end / deep end: Notion, Excel, la propia
GeoGebra), y **ya está en el ADN del proyecto**: la Regla 1 dice "documento **con profundidad**"; las
escotillas (`rawLatex`) tampoco las toca el usuario clásico; el espectro [[dynamism-spectrum]] deja
que el autor elija su punto. Acá elige su **profundidad**.

La clave: **la arquitectura es neutral respecto de la identidad; lo que la define son los defaults y
la presentación.** El mismo namespace se puede presentar *document-first* (definición inline sigue
siendo el default; panel y Python ocultos, opt-in) o *compute-first* (panel al frente). Con
presentación document-first, el arquitectura potente vive **abajo** y la experiencia de documento
**arriba**.

**Por eso, de las objeciones "grandes", dos se caen:**

- ~~**Encarece el caso común.**~~ **No**, si la definición inline sigue siendo el default: el flujo de
  quien tipea `x^2` en una figura queda **idéntico** (la entidad se crea implícita, invisible).
- ~~**Cambio de identidad / dos productos.**~~ **No**: con profundidad progresiva es la **Regla 1
  extendida** (mismo producto, fondo más hondo), no un producto nuevo. El usuario clásico ni se entera.

**Lo que NO se cae** (profundidad progresiva esconde la complejidad del *usuario*, no del *código*):

- **Rediseño / esfuerzo grande.** Construir namespace + resolver + panel + runtime es mucho trabajo,
  lo vea o no el usuario clásico.
- **El modelo debe soportar entidades** (para quien las use) → expansión de AST con migración.
- **El DAG reactivo sigue caro y diferido** (ME-44, Marimo/Quarto) — solo que el shallow end no lo paga.
- **Es una disciplina que hay que defender:** mantener el inline como default mientras el fondo crece
  cuesta trabajo (la tentación de rutear todo por el panel es real — así se engordaron muchas
  herramientas que empezaron simples).
- **Posicionamiento:** con qué liderás (landing/onboarding) define quién adopta. "Liderar con
  documentos, revelar cómputo para quien lo quiera" — decisión de presentación, separable de la
  arquitectura.

**El neto:** la idea baja de *"apuesta de identidad riesgosa"* a *"extensión grande pero consistente
con la identidad"*. La compuerta que queda es **esfuerzo y prioridad** (más la disciplina), ya **no**
el miedo a volverse otro producto. No cambia el "no ahora"; cambia el **techo** (si se invierte el
esfuerzo, no se arriesga lo que ya anda).

---

## 5 · Cómo se relaciona con el AST — igual que la numeración

Traer el cómputo "al frente" **no cambia el principio del AST** ([computo-y-capas.md](computo-y-capas.md)
§2): el AST guarda **intención**, no resultados. Agrega **nuevos tipos de intención** y deja los
**valores** afuera (② / freeze).

| Cosa | AST o ② | Por qué |
|------|---------|---------|
| **Definición de entidad** `f = x²` | **AST** (intención) | Lo que el autor *declaró*. Fino: la definición, no el resultado. |
| **Cómputo declarado** `r = raíces(f)` | **AST** la *declaración* · **②** el *valor* | El autor declara "quiero las raíces"; las coordenadas las produce el resolver, **no se guardan**. |
| **Código Python** (celda) | **AST** el *código* · runtime el *output* | El código es contenido autorado (como `rawLatex`). Su salida **no se guarda** (salvo freeze). |
| **Referencia** desde prosa ("∫f acá") | **AST** (ref-like) · **②/freeze** el valor | Idéntico a una referencia cruzada: guarda el *target*, no el texto resuelto. |
| **El namespace** (nombre → valor) | **NO AST** | Artefacto de **resolución**, reconstruido en cada compilación. |

**La analogía exacta (con algo que ya funciona):** el namespace es a las entidades **lo que la tabla
de numeración es a `numbered:true`**. `theorem{numbered}` está en el AST; el "1.1" lo computa ② y no
se guarda; un `ref` guarda el target. `entity f=x²` está en el AST; su valor lo computa ② y no se
guarda; una referencia guarda el nombre. **El cómputo se relaciona con el AST igual que la numeración
— es un segundo inquilino (más rico) de ②, nada filosóficamente nuevo.**

**Consecuencias:**

- **El AST sigue fino.** Crece por las **definiciones** (chicas, intención), no por los **resultados**
  (grandes, derivados: coordenadas, arrays de Python, tablas de 10k filas). Lo pesado se queda afuera.
- **Progressive disclosure a nivel AST:** un documento clásico **no tiene** esos nodos → su AST es
  **exactamente el de hoy**. Los tipos nuevos y el paso de resolución son **opcionales**; ausentes, no
  cambian nada.
- **Freeze imperativo ≠ declarativo:** un valor declarativo congelado es auto-reproducible; uno de
  Python necesita **procedencia** (hash de código/datos) para saber si quedó viejo — aparato exclusivo
  del Nivel 2.

**La pregunta que queda:** *¿dónde* viven las definiciones en el árbol? (a) bloques en orden; (b) sección
`meta` global; (c) híbrido. Es la tensión árbol-vs-namespace. El "qué" está claro (definición = intención
= AST; resultado = derivado = ②); el "dónde" se aborda en **§9** (dos regiones: scope global vs cuerpo).

---

## 6 · Interacciones reactivas — **reactivo-declarativo, nunca objetos vivos**

La pregunta natural (usuario, 2026-07-22): que las entidades sean **vivas y multidireccionales** — las
uso en plot/tabla/texto, las cambio desde Python, arrastro un punto y todo se actualiza. **El modelo se
lo banca** — pero solo si se traza **una línea de diseño que no hay que cruzar.** El escenario es un
espectro, y una parte encaja y otra rompe:

| | Capacidad | ¿Encaja? |
|---|-----------|----------|
| **A** | Entidades globales usadas en plot/tabla/texto vía referencia | **Sí** — el namespace declarativo |
| **B** | Cambio una variable → el plot que la usa se refresca | **Sí, ya existe en germen: el slider (ME-36)** |
| **C** | Desde Python cambio/creo una entidad → los consumidores reaccionan | **Sí, tratable** (con condición) |
| **D** | Llamar **métodos a componentes como objetos vivos** (`plot.refresh()`, `f.setColor('red')`) | **NO — rompe el modelo** |

**A y B encajan, y B ya está probado.** "Cambio una variable → el dibujo se refresca" *es* el slider:
un plot con parámetro `a` que re-renderiza en vivo. La clave conceptual: **no es un objeto vivo al que
le pegás un `refresh` — es re-resolución.** El plot es una **vista declarativa** que se recomputa cuando
cambia su entrada. Es el modelo de la **planilla de cálculo**: fórmulas en un grafo de dependencias; no
hay objetos mutables con métodos. Generalizar el slider a "cualquier entidad → cualquier consumidor" es
ese grafo (el DAG) — declarativo y **transparente** (el sistema sabe que `f = expr(a)`).

**C es tratable si la reactividad vive en el namespace.** "Desde Python cambio `a` → el plot se refresca"
funciona porque la dependencia del plot sobre `a` es **declarativa**, y Python solo **cambia el binding**.
Es "un namespace, dos productores" (§2): Python **escribe**; el namespace es reactivo; la vista **se
re-resuelve**. Lo **caro** (DAG diferido) es que las **celdas de Python dependan reactivamente entre sí**
(trazar código opaco, estilo Observable/Marimo). Python-escribe-en-el-namespace = barato;
Python-reactivo-entre-celdas = el aparato pesado.

**D es la línea que NO se cruza.** `plot.refresh()`, `f.setColor('red')`, `f.mutate()` mueven la fuente
de verdad **del AST declarativo al estado mutable de runtime** — modelo Jupyter-widget / scripting de
GeoGebra. Sacrifica lo que hace valioso al AST (fuente única, reproducible, sin estado stale). El
documento dejaría de ser una *descripción* y pasaría a ser un *programa con estado corriendo*, con los
bugs de estado-viejo que el modelo declarativo evita por diseño. **Otro producto.**

### El reencuadre que lo resuelve: no hacen falta objetos vivos

Todo lo que se quiere se consigue **del lado declarativo**, sin cruzar a D — misma efecto visible:

| En vez de (D, imperativo) | Se hace (declarativo) |
|---------------------------|------------------------|
| `plot.refresh()` | cambiar la entrada → **re-resolución** |
| `f.setColor('red')` desde Python | cambiar el **atributo color de la definición de f** → las vistas se re-resuelven en rojo |
| arrastrar un punto en el plot (ME-44) | el gesto **edita la definición del dato** → se re-resuelve en todos lados |

> **Principio a grabar:** el modelo se banca las interacciones **multidireccionales y reactivas** como
> **reactivo-declarativo** (editar = cambiar una definición del AST → se re-resuelven las vistas), **NO**
> como **objetos-vivos-con-métodos** (mutar objetos corriendo). Lo primero *extiende* el modelo; lo
> segundo lo *reemplaza*. **Editar —desde texto, Python o un gesto de vista— es siempre modificar una
> definición del AST**; un solo origen de verdad, siempre el AST.

### Cómo se relaciona con el AST

Consistente con §5: las **definiciones** (f, datos, variables, código Python) están en el **AST**; el
**grafo de dependencias + el recompute** son un artefacto de **②** (como la tabla de numeración: efímero,
reconstruido, **no se persiste**). La reactividad se **deriva**, no se guarda. Editar por cualquier vía =
modificar una definición → re-resolución.

**Honestidad de escala:** esto es el **documento reactivo completo** — territorio Observable/Marimo/
GeoGebra, el DAG que el backlog difiere por caro (ME-44). Sí, el modelo puede bancarlo (reactivo-
declarativo); no es para ahora. Lo tratable y ya-probado es el eslabón del slider; el DAG general y la
reactividad entre celdas Python son el escalón caro.

---

## 7 · Orden de ejecución y el borde opaco de Python

Cómo se relacionan los nodos de cómputo entre sí (¿secuencial? ¿DAG?). Los dos tipos tienen
**tendencias naturales opuestas**:

| Nodo | Dependencias | Tendencia |
|------|--------------|-----------|
| **Declarativo** (`f = a·x²`, `r = raíces(f)`) | **transparentes** — el sistema lee la expresión y *ve* que f usa a | **DAG**, orden-independiente (planilla) |
| **Python** (código, estado mutable) | **opacas** — no sabe qué lee/escribe sin *trazar* | **secuencial** (script/kernel) |

**Lo que habilita el DAG barato es la *transparencia*** (poder extraer dependencias sin ejecutar), y
viene de estar en el **vocabulario nativo** de Matex. Lo declarativo *es* lo transparente; Python es
imperativo **y** opaco.

**El borde opaco (asimetría clave).** La opacidad de Python es sobre su *interior*, no sobre los
*nombres que cruzan su borde*:

```
a = 5                        -- declarativo
f = a·x²                     -- el sistema VE  f → a
p = «python: lee a, escribe p»  -- OPACO:  NO VE  p → a  (adentro)
g = 2·p                      -- el sistema VE  g → p
```

Hay un **agujero en el DAG justo en la celda Python**: los cables **hacia** ella (`p`) y **desde**
ella (`g→p`) se ven (referencias de nombre); la arista que la **atraviesa** (`p→a`) no. Consecuencia:
**lo declarativo arma su DAG solo; Python no entra a un DAG automático** sin declarar sus
entradas/salidas o trazar (por eso Marimo restringe Python; por eso lo simple es orden de documento).

**El innegociable: reproducibilidad.** El documento visible debe determinar la salida. Eso **descarta
el modelo de Jupyter** (kernel mutable, ejecución fuera de orden, estado escondido) — el bug que el
AST-como-fuente-de-verdad existe para evitar. Los que lo resolvieron bien (Observable/Marimo)
prohíben el estado escondido: o DAG, o re-ejecución desde cero.

**La progresión (barato → caro):**

| | Modelo | Qué da | Costo |
|---|--------|--------|-------|
| **V1** | **Orden de documento, ejecución fresca** (kernel nuevo cada compilación) | reproducible, simple, sin DAG; un nodo ve lo de arriba | reactividad **posicional** (un plot *debajo* del cambio lo ve; *arriba* no); re-corre todo |
| **V2** | + procedencia/caché (hash de código+entradas, re-corre solo lo stale) | más rápido, sigue en orden | el aparato freeze/procedencia |
| **V3** | **DAG reactivo** (posición-independiente) | cambiás `a` → todo lo que usa `a` se actualiza, esté donde esté | rastreo de deps (barato declarativo, caro/restrictivo Python) — el escalón diferido |

> **El orden es decisión de ②, NO del AST.** El AST solo declara los nodos y sus referencias; *cómo
> evaluarlos* (orden/DAG) lo decide ②. Por eso se puede **arrancar en orden de documento (V1) y
> evolucionar a DAG (V3) sin tocar el AST**. No hay que resolver "secuencial o DAG" ahora: es
> estrategia de ejecución (②), no del guion. El deseo "modifico `a` desde Python y el plot se refresca
> sin importar la posición" **es V3** — el endpoint, no el arranque.

---

## 8 · La bisagra limpia: Python como **función pura**

El caso límite que une los dos mundos: declarar en el contexto global un nombre `P` cuyo **cuerpo es
Python** pero con **firma declarada**, y llamarlo `P(x,y)` como si fuera nativo. Es **FFI / una UDF de
planilla**: se envuelve el interior opaco detrás de una **interfaz declarada**, y `P` entra al DAG
como un **primitivo opaco-con-contrato** (igual que `sin`, pero con cuerpo Python).

```
P(x, y) = «python: def P(x, y): return …»   -- cuerpo opaco, firma declarada
f = P(x, 0) + x²                             -- el sistema VE  f → P  (trata P como hoja)
```

El sistema **no ve adentro de P pero no lo necesita**: sabe "f usa P"; si el código de P cambia, f
queda stale. La opacidad quedó **encapsulada detrás de la firma** — el borde es declarativo aunque el
cuerpo sea imperativo. Esto **eleva Python** de "celdas que mutan estado compartido" (secuencial,
opaco) a "funciones puras invocables desde expresiones declarativas" (transparente en la interfaz).

**Las dos disciplinas que lo hacen sólido** (y el bug si se violan):

1. **Pureza** — sin efectos, determinista (mismos args → mismo resultado). El DAG *asume* pureza
   ("si las entradas no cambian, no recompute"). Una `P` impura la rompe **en silencio**. Se enfuerza
   con sandbox (sin I/O, determinista).
2. **Cerrada** — todo lo que P usa entra como **argumento**; nada de capturas ocultas. Si `P()` usa la
   entidad `a` por adentro, el DAG ve `f→P` pero **no** `f→a` → cambiás `a`, f queda viejo. La cura:
   `P(x,y,a)` — la dependencia es un argumento, el DAG la ve. **P cerrada = P pura de sus argumentos.**

> **Bajo pureza + cerradura, `P(x,y)` es indistinguible de una función nativa para el DAG.** Es la
> mejor bisagra entre declarativo e imperativo: parte a Python en **función pura** (la preferida —
> entra al DAG limpia, orden-independiente, reproducible) vs **celda con efectos** (escotilla pesada —
> orden secuencial + procedencia + freeze). Mismo ethos del proyecto: preferir lo declarativo/
> transparente; la firma domestica el cuerpo opaco.

**Notas de implementación:** el evaluador nativo ya usa un entorno de funciones (`sin`, `cos`); `P` es
una **entrada foránea** ("cuando veas `P(...)`, invocá el runtime"). Costo: P corre Python → un plot
que la muestrea en 200 puntos pide **vectorizar** (una llamada con array) y **memoizar** (P pura →
cachear por args); en el editor, resolución en vivo con P pide debounce/cache/async. P pura →
`①→②→③` sigue reproducible sin freeze; P impura → vuelve a necesitar freeze+procedencia.

### Aislamiento enforced → ciclos detectables, no escondidos

Como Python lee globales y las globales llaman Python, se abre la puerta a **referencias circulares y
recursiones**. La disciplina que hace a P DAG-friendly es **la misma** que las mantiene bajo control —
si la cerradura se **enforcea**:

> **P se ejecuta en un scope aislado que contiene SOLO sus argumentos — sin acceso al namespace global.**
> No puede leer `f` ni `a` salvo que se los pasen.

Con eso, **P no tiene dependencias ocultas**: es una **hoja** del grafo, y las dependencias fluyen por
los *call sites* (`f = P(g)`), que son **visibles**. Consecuencia:

- Todo ciclo vive en el **DAG transparente** → **detectable** con detección de ciclos estándar → se
  rechaza con error, **como una planilla dice "referencia circular".**
- El único peligro sería un ciclo **escondido** (P captura `f` por adentro) → **justo lo que el
  aislamiento prohíbe por construcción.** *La cerradura mata que los ciclos sean invisibles, no que
  existan.*

**Recursión — dos clases:** (a) **dentro de Python** (`def P(x): return P(x-1)…`) → normal, contenida
en la caja opaca, acotada por el stack; el DAG ni se entera (P es hoja). (b) **a través del grafo**
(`f = P(f)`) → ciclo, detectado y rechazado. La iteración/recurrencia legítima vive **adentro** de una
celda imperativa (un `for` que emite una secuencia) o de un primitivo declarativo (`scan`/`reduce`),
**nunca como arista circular** → el DAG queda **acíclico por construcción**. Es lo que hacen todos los
reactivos (Excel/Observable/Marimo): ciclo = error, loops adentro de una celda. **Bonus:** el
aislamiento hace a la función pura **cycle-safe por construcción**; la **celda con efectos** (acceso
ambiente) es donde un ciclo *podría* esconderse — otra razón para preferir la forma pura.

---

## 9 · Dónde viven las cosas — scope global vs cuerpo del documento

Cierra la pregunta abierta de §5 (*¿dónde viven las definiciones?*) y la aparente contradicción "si
Python está en un nodo posterior, ¿cómo lo usa una declaración previa?". La clave: **Python aparece en
DOS regiones con DOS semánticas**, y conviene no mezclarlas.

| | **Región 1 — Scope declarativo global** | **Región 2 — Cuerpo del documento** |
|---|------------------------------------------|--------------------------------------|
| Contiene | entidades (`f`, `a`, `D`) **+ funciones puras de Python** (`P`) | prosa, plots, tablas, referencias, **+ celdas Python con efectos** |
| Semántica | **DAG** — orden-independiente, forward refs OK, ciclos detectados | **orden de documento** (para lo imperativo) |
| UI | **un panel** (o defs inline que registran al scope global) | el flujo de lectura |
| Forma de Python | **función pura** (§8) | **celda con efectos** (§8) |

```
SCOPE GLOBAL (panel — un DAG, sin orden):
    a = 5
    P(x) = «python puro»
    f = P(a) + x²        -- f usa P: OK. Co-residentes; es un GRAFO, no una secuencia.

CUERPO (orden de lectura):
    § Teorema 1 … (referencia f) …   ·   [plot de f]
    [celda Python efectiva: carga un CSV → emite tabla]      ← forma 2, en orden
    § Sección 2 … (usa esa tabla, está arriba) …
    [otro plot que NO puede usar una celda efectiva de más abajo]
```

**Las dos intuiciones del usuario son las dos correctas, en regiones distintas:**

- *"Una declaración previa no puede usar código Python de un nodo posterior"* → **cierto para las
  celdas efectivas (Región 2):** secuenciales, lo de arriba no ve lo de abajo.
- *"¿Cómo usa una declaración código Python?"* → usa una **función pura co-residente del scope global
  (Región 1)**, no una celda posterior. Como el scope global es un **grafo, no una secuencia**, la
  posición no importa: `f = P(a)` anda aunque `P` esté "más abajo" en el panel.

**Una declaración nunca usa una *celda* Python — usa una *función* Python del mismo scope global.**

**Panel vs inline (la sub-elección de UX, no de modelo):** el scope global se puede presentar como un
**panel** (todo junto, estilo GeoGebra — claro, pero divorcia la definición de su contexto de lectura)
o como **definiciones inline que registran al scope global** (definís junto al teorema que la usa —
mejor para leer, pero puede confundir "¿por qué esto de abajo afecta aquello de arriba?"). Las dos son
presentaciones del **mismo namespace order-independiente**. (Y en la **V1 simple** de §7, hasta las
declaraciones serían orden-dependiente; el scope global order-libre es el **target DAG/V3**.)

> **Es una forma coherente de resolver la tensión árbol-vs-namespace, no la única ni algo cerrado.**
> Pero deja la esquina clara: **scope global declarativo (DAG, funciones puras) ≠ cuerpo del documento
> (orden, celdas efectivas)**; la declaración usa una función pura co-residente, no una celda posterior.

---

## 10 · El camino incremental (cómo ganar los beneficios sin la apuesta)

No hace falta invertir el modelo para ganar lo importante. Sembrar, y dejar que emerja:

1. **Cuando LE-06 (materializar) lo pida**, darle a una función un **id de documento opcional** → la
   prosa puede referenciarla (`∫ f`). Extensión chica, no rediseño. Es la **semilla** de "entidad".
2. **Un panel que liste** las funciones referenciables del documento es entonces una **vista**, no un
   cambio de modelo.
3. Si aparecen los nodos Python (Nivel 2), que **escriban en ese mismo namespace** (la restricción §3),
   no en uno propio.
4. La inversión total ("definí todo arriba, el plot es una vista") es el **punto al que convergés** si
   el uso compute-first se prueba — no algo que apostás de entrada.

> **En una frase.** Entidades-como-entorno y nodos-ejecutables son **una arquitectura** (un namespace,
> dos productores, muchos consumidores), no dos features. Es la mejor **visión** del hilo y la peor
> **acción inmediata**. El valor de escribirlo ahora: fija el norte, y —sobre todo— graba la
> restricción de **un solo namespace**, para no ganarlo a los tumbos el día que se construya.

---

## Notas de consistencia

- La [propuesta de nodos ejecutables](nodos-ejecutables-propuesta.md) todavía trata `verify` como
  "feature estrella". Eso quedó **corregido** (verify es la idea débil, extra opcional; el paso real
  es materializar): ver [computo-y-capas.md](computo-y-capas.md) §6 y el ítem LE-06 del backlog.
  Cuando se retome ese doc, alinear.
- Este estudio **eleva la ambición del Nivel 1.5**: de "valores inline" a "namespace de entidades".
  Esa elevación **es** la apuesta de identidad de §4 — tenerlo presente al ponderarla.

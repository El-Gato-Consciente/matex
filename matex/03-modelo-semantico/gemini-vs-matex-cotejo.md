# Cotejo: charla con Gemini vs. arquitectura ya decidida en Matex

> Este documento no es una fuente nueva de diseño — es un **cotejo**. Su función es separar,
> de una conversación exploratoria con Gemini sobre cuadernos computacionales y AST híbridos,
> qué aporta algo genuinamente nuevo y qué simplemente confirma (con matices más flojos)
> decisiones que `nodos-ejecutables-propuesta.md`, `entorno-de-entidades-estudio.md`,
> `computo-y-capas.md` y `reglas-del-modelo.md` ya habían cerrado.

---

## 1 · Lo novedoso — vale la pena incorporarlo

### 1.1 El patrón *Multipass* para referencias hacia adelante

**Qué es.** Gemini lo trae al final, hablando de LaTeX/Typst: una primera pasada recorre el
documento y recolecta estado (equivalente a lo que LaTeX hace con `.aux`); una segunda pasada
vuelve a recorrerlo y ahora puede resolver referencias que apuntaban "hacia adelante" (un índice,
un total que se calcula más abajo, un `\ref` a algo que todavía no se había definido en la primera
pasada).

**Por qué no está en los documentos del proyecto.** Todo el diseño actual (`nodos-ejecutables-
propuesta.md`, `entorno-de-entidades-estudio.md` §7) asume deliberadamente **"solo lo previo"**:
un nodo ve el entorno acumulado hasta ese punto y nada más. Es una simplificación consciente, no
un olvido — evita el DAG reactivo caro que el proyecto difiere a propósito.

**Por qué es un candidato real para el futuro, con una condición importante:**

- Para el lado **declarativo** (transparente), un multipass es relativamente barato — es
  literalmente lo que ya hace LaTeX con contadores y referencias cruzadas. Extender "solo lo
  previo" a "una segunda pasada resuelve lo que quedó pendiente" para entidades declarativas no
  reintroduce mucho costo, porque el sistema ya puede leer sus dependencias sin ejecutarlas.
- Para el lado **Python** (opaco), un multipass **sí** reintroduce el problema que "solo lo
  previo" evita a propósito: resolver una referencia hacia adelante ahí significaría re-ejecutar
  código en una segunda pasada, es decir, el mismo DAG/procedencia caro que
  `nodos-ejecutables-propuesta.md` §4.6 difiere explícitamente ("se difieren enteros [...] hasta
  tener demanda real").

**Conclusión operativa:** si algún día aparece la necesidad real de referencias hacia adelante
(un índice, un total al principio del documento), el multipass debería aplicarse **solo al lado
declarativo** — como ya hace LaTeX — y no usarse como excusa para relajar la disciplina secuencial
del lado Python.

### 1.2 El constructor como punto de compatibilidad hacia atrás

Gemini señala un matiz sobre `TableNode.from_json(...)` que el proyecto no había hecho explícito:
el constructor/adaptador no es solo el lugar donde se traduce un tipo foráneo (un DataFrame) al
tipo AST — es también el lugar natural donde absorber **cambios de versión del schema**: si el
nodo `table` agrega un campo nuevo, el constructor puede rellenarlo con un default y el código
Python de un autor viejo sigue funcionando sin romperse.

**Por qué vale la pena anotarlo.** Conecta directo con algo que sí está decidido en
`reglas-del-modelo.md` (Regla 2): lo que vive en ① (el AST) persiste, y cambiar su forma **pide
migración** (`MATEX_AST_VERSION`). Lo que no estaba explícito es que el constructor del lado
Python (`emit_table`, etc.) es un candidato natural para alojar esa migración también del lado de
la API que usan las celdas de código — no solo del lado de los documentos `.mtex` ya escritos.

---

## 2 · Lo que se aclaró — precisiones sobre lo ya decidido

Estos puntos no son ideas nuevas: son cosas que la charla con Gemini pasa por alto o resuelve de
forma más floja, y que quedaron más nítidas al contrastarla con los documentos del proyecto.

### 2.1 Un namespace, dos productores — no solo Python

Gemini razona todo el rato como si el contexto/entorno lo llenara **únicamente** Python. En
Matex, el mismo namespace lo alimentan **dos productores de naturaleza distinta**
(`entorno-de-entidades-estudio.md` §2):

| | Entidad declarativa (`f = x²`) | Celda Python |
|---|---|---|
| Quién computa | el sistema (motor nativo) | el autor (runtime) |
| Transparencia | rica (el motor puede derivar/integrar/buscar raíces) | plana (dato opaco) |
| Costo de recomputar | bajo | alto |

Esta distinción es la que explica **por qué** el proyecto prioriza resolver cosas sin Python
(`verify`, "cómputo por intención" — Nivel 1.5) antes de tocar el Nivel 2. La primera pregunta de
`nodos-ejecutables-propuesta.md` — *"¿cuál es la cosa más chica que hace que el documento compute
lo que afirma?"* — nunca se plantea en la charla con Gemini, que arranca asumiendo que la
respuesta es Python.

### 2.2 La resolución termina *antes* de que el backend toque el árbol

En el diseño de Gemini, el backend, mientras renderiza, **consulta activamente** el contexto
(`context.get(...)`) cada vez que encuentra un nodo de inyección. Funciona, pero acopla al
backend con la fase de resolución.

En el diseño ya cerrado (`computo-y-capas.md`, los tres momentos — build-time / edit-time /
runtime — y `nodos-ejecutables-propuesta.md` §4.5), la resolución (②) se completa **por
completo** antes de que el backend empiece: *"LaTeX/PDF lee el valor congelado, NUNCA corre
Python"*. Con eso el backend queda totalmente agnóstico — ni siquiera necesita saber que existe
un contexto global. Es un escalón de separación más limpio que el de la charla.

### 2.3 Freeze y procedencia — la pieza que faltaba en la charla

Nada en la conversación con Gemini contempla que el resultado de una celda Python se **congele
dentro del documento fuente**, con un hash de procedencia (`código + deps + inputs`). Sin eso, el
"Contexto Final" del Modelo B de Gemini es efímero por diseño: reabrir el documento exigiría
volver a correr Python siempre. El mecanismo de freeze (`{ kind:'computed', output, source,
frozen:true, hash }`, `nodos-ejecutables-propuesta.md` §4.5) es justamente lo que hace al
documento reproducible sin depender de tener un runtime Python disponible.

### 2.4 Política compartida (Regla 3) — ausente en la charla

Gemini nunca se pregunta si dos backends podrían resolver la misma cosa de forma distinta. En
Matex esa es la prueba central que decide qué va a ② (`reglas-del-modelo.md`, Regla 3): *"si dos
backends la resuelven distinto, ¿es un bug o una feature?"*. Sin esta pregunta, nada garantiza
que una tabla generada por Python se vea consistente entre LaTeX, HTML y el editor.

### 2.5 Confirmaciones cruzadas (buena señal, no aporte nuevo)

Tres decisiones que el proyecto ya tenía cerradas, y a las que Gemini llega por su cuenta
razonando desde cero sobre cuadernos computacionales — lo cual es una validación externa útil,
aunque no agregue nada:

- **No mutar el AST directamente desde Python** (la intuición de que "parecía peligroso" se
  confirma con la línea D de `entorno-de-entidades-estudio.md` §6: nada de objetos vivos con
  métodos, todo pasa por re-resolución declarativa).
- **El constructor/adaptador tipado** (`TableNode.from_json`) en vez de que Python arme el JSON
  a mano — coincide con el rol de `emit_table` como adaptador, no como cast.
- **Modelo secuencial-intercalado con namespace acumulativo** ("solo lo previo") como la opción
  elegida frente al modelo reactivo (Marimo/Observable) y al clásico caótico (Jupyter/Colab).

---

## 3 · Síntesis

La charla con Gemini es una buena caja de herramientas de *primeros principios* de diseño de
compiladores/notebooks, y confirma — llegando ahí de forma independiente — que las decisiones ya
tomadas en el proyecto no son arbitrarias. Pero le falta lo que distingue a la arquitectura de
Matex de un motor de plantillas genérico: la asimetría declarativo/imperativo entre los dos
productores del namespace, la separación limpia entre resolución (②) y backend (③), el aparato
de freeze/procedencia, y la prueba de política compartida (Regla 3). El único aporte
verdaderamente nuevo y accionable es el patrón *multipass* — y aplica, si acaso, solo al lado
declarativo.

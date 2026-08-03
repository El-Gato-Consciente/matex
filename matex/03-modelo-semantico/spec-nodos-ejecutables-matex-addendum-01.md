# Addendum 01 — Nodos ejecutables en Matex: extensiones y refuerzos

> **Relación con el documento base.** Este archivo **no reemplaza**
> [`spec-nodos-ejecutables-matex-borrador.md`](spec-nodos-ejecutables-matex-borrador.md) — lo
> extiende. Cada entrada dice explícitamente si **agrega** algo nuevo al modelo o **refuerza**
> (da fundamento más sólido, sin cambiar la regla) algo que la especificación base ya tenía. Se
> numeran las secciones como continuación de las 15 originales para que looking-up cruzado sea
> directo: quien lea "§16" sabe que viene después de "§15" del documento base.
>
> **Origen.** Surge de una segunda conversación exploratoria con Gemini sobre el mismo problema
> de diseño, esta vez con un camino en zigzag (propuestas descartadas y retomadas en vivo) que
> resultó más útil como *prueba de por qué* ciertas decisiones ya tomadas son correctas, no solo
> *confirmación de que* lo son.
>
> Mismo criterio de estado: `✅` implementado · `🟡` **propuesto, no ratificado por el proyecto**
> (candidato a vetear) · `⬜` abierto · `❌` descartado. Producido **fuera del ecosistema**; sus
> extensiones (`emit_fragment`, clases isomorfas, multipass refinado) son **propuestas**, no
> decisiones — ver [`08-auditoria/auditoria-spec-nodos-ejecutables.md`](../08-auditoria/auditoria-spec-nodos-ejecutables.md).

---

## 16 · Lo nuevo — extensiones reales al modelo

### 16.1 `emit_fragment` — secuencias heterogéneas de nodos

**El gap que cubre.** Todo el contrato `emit_*` de §5 asume "una llamada → un nodo de un tipo"
(`emit_table` → un `table`). Pero hay un caso legítimo y frecuente que no tiene dónde caer hoy:
un loop de Python que, por cada elemento que procesa, necesita producir una **secuencia
heterogénea** — título + párrafo + tabla, repetido N veces — no un solo nodo.

**Extensión propuesta.** `🟡` Nuevo miembro del contrato:

```python
fragmento = [
    matex.NodeHeading(nivel=2, texto=f"Resultado: {archivo.nombre}"),
    matex.NodeParagraph(texto="Procesado correctamente."),
    matex.emit_table(archivo.datos),
]
matex.emit_fragment(fragmento)
```

`emit_fragment` no inventa un nodo AST nuevo — **produce una lista de nodos ya tipados**, cada
uno vía su propio `emit_*` (o construcción directa isomorfa, ver §16.2), y el compute pass la
"esparce" en el árbol en el punto donde el nodo ejecutable que la produjo tiene su salida (mismo
mecanismo que `table-from-code`, generalizado a N nodos en vez de uno).

**Por qué no rompe ningún invariante:** sigue siendo Python produciendo entidades tipadas hacia
el namespace (I4); el compute pass sigue siendo el único que las adjunta al árbol (I5); cada
elemento de la lista pasó individualmente por su propio contrato de admisión (§5.2 del documento
base) — `emit_fragment` no es una vía alterna de entrada, es un contenedor de resultados ya
válidos.

**Extensión a §3.3 (catálogo de nodos ejecutables) del documento base:**

| Tipo | Salida visible en su posición | Estado |
|---|---|---|
| `fragment-from-code` | sí, **una secuencia** de nodos (no uno solo) | 🟡 nuevo |

**Pregunta que deja abierta (agregar a §13 del documento base):** ¿el orden de la lista es la
única semántica de posicionamiento, o hace falta que cada elemento declare su propio tipo de
contención (¿puede un `table` ir dentro de lo que en otro contexto sería un nodo de "solo
párrafos"? — las reglas de contención de §3 del documento base valen igual acá, y **`emit_fragment`
no está exento de ellas**: si el punto de emisión no admite un `table` en su lugar, debe fallar
en compute pass, no aceptar silenciosamente algo mal ubicado).

---

### 16.2 Clases Python isomorfas al nodo AST — un segundo camino, no un reemplazo de `emit_*`

**El gap que cubre.** Hasta ahora, `emit_table(df)` es *el único* camino: un **adaptador** que
traduce un tipo ajeno (`DataFrame`) al nodo canónico (§5.1 del documento base). Pero hay un caso
distinto: el autor **ya tiene los datos en la forma correcta** (ya sabe qué filas, qué columnas,
qué caption quiere) y no necesita adaptación — solo necesita construir el nodo directamente.

**Extensión propuesta.** `🟡` La librería puente expone, además de los adaptadores `emit_*`,
**clases Python que reflejan 1:1 el schema de cada nodo AST** (mismo patrón que `Pydantic`, con
un discriminador `type` — sin comprometerse acá a una librería de validación específica, solo al
principio):

```python
tabla = matex.NodeTable(
    header=["Nombre", "Edad"],
    rows=[["Ana", 30], ["Juan", 25]],
    caption="Participantes"
)
matex.emit(tabla)   # ya es del tipo correcto — emit() valida forma, no traduce
```

**Diferencia con `emit_table`, explícita para no confundir los dos caminos:**

| | `emit_table(df)` | `NodeTable(...)` + `emit(...)` |
|---|---|---|
| Rol | **adaptador** — traduce un tipo ajeno | **constructor directo** — el autor ya arma la forma exacta |
| Cuándo usarlo | el dato de origen es de una librería externa (`pandas`, `numpy`) | el autor compone la tabla a mano, con datos que él mismo controla |
| Qué valida | la traducción `campo origen → campo destino` (tabla de §5.1) | la forma del nodo en sí (tipos, campos requeridos) |

**Ganancia real: fail-fast más temprano.** Con la clase isomorfa, un error de forma (falta el
`header`, una fila con distinta cantidad de columnas que las demás) se detecta **en la línea de
Python donde se construye el objeto**, antes incluso de que exista la noción de "compute pass".
Es un endurecimiento del Invariante I7 ("avisa, no mientas") — lo mueve más temprano en la
cadena, que siempre es preferible a detectarlo después.

**Por qué esto NO reabre la puerta a "Python escribe el AST directamente" (I4):** la clase
`NodeTable` no es el nodo AST interno del motor — es una **representación espejo**, en la capa de
la librería puente, cuya única salida posible es pasar por `emit()`, que sigue corriendo en el
compute pass, sigue produciendo una entidad en el namespace (nunca escribe el árbol
directamente), y sigue estando sujeta a la Regla de admisión (§5.2). El fail-fast ocurre en la
*validación de forma* del lado Python; la *materialización en el árbol* sigue centralizada.

---

## 17 · Lo reforzado — mismo resultado, fundamento más sólido

### 17.1 Por qué el modelo *pull* (referencia por nombre) le gana al *push* (Python "empuja" a una coordenada)

**Qué ya estaba decidido.** El documento base ya usa exclusivamente el patrón *pull*: un nodo
`ref` (§3.4) lee del namespace por nombre; Python nunca decide *dónde* aparece algo, solo *qué
valor* tiene una entidad.

**Qué agrega este refuerzo.** La charla exploró en vivo la alternativa — un modelo de "anclajes"
donde Python, con una función tipo `matex.reemplazar_nodo(lugar_id, contenido)`, decide
activamente qué contenido va en cada punto marcado, **incluso condicionalmente** (tabla si el
cálculo funcionó, párrafo de error si no) — y la descartó, llegando por su cuenta a la misma
conclusión que ya regía acá. Vale la pena dejar el argumento explícito, porque es más fuerte que
"lo decidimos así":

> **El branching de *qué tipo de contenido* aparece en un punto del documento es una decisión
> estructural, y las decisiones estructurales son responsabilidad del autor al escribir el
> documento (①), no del código que corre después (②).** Si Python pudiera elegir libremente entre
> devolver una tabla o un párrafo de error en el mismo punto, dos ejecuciones del mismo código
> con distintos datos de entrada producirían **estructuras de documento distintas** — no solo
> valores distintos. Eso es exactamente lo que el Invariante I3 (*"el AST guarda intención, no
> resultados"*) prohíbe: la intención ("acá va el resultado de la validación, sea cual sea") debe
> quedar declarada por el autor en el punto de referencia; el código solo aporta el valor.

**Consecuencia de diseño, explícita ahora:** si un caso de uso real necesita "tabla si OK, error
si no falla", la forma correcta **no** es que Python elija el tipo de nodo — es que el propio
`emit_*` devuelva un tipo de resultado que **el nodo de referencia sepa interpretar de forma
declarada** (algo como un `Result<table, error>` conocido de antemano por el `ref`, no una
decisión libre de Python). Esto queda como pregunta abierta concreta, más precisa que antes — ver
§18.2.

---

### 17.2 Por qué la conversión raw→tipado vive en el compute pass, nunca dentro de cada backend

**Qué ya estaba decidido.** El documento base (§6.1) ya establece que `emit_*` corre una sola vez
en el compute pass, antes de que cualquier backend toque el árbol.

**Qué agrega este refuerzo.** La charla, en su tramo final, propuso un modelo alternativo donde
el *nodo AST mismo*, durante el *render*, lee el dato crudo del namespace y ahí recién lo
convierte a forma tipada (`\build_table{data_source=...}` que se autoconstruye al ser recorrido
por el backend). Es un error sutil y vale la pena nombrarlo explícitamente para que no reaparezca
disfrazado de optimización: **si la conversión ocurre dentro de cada backend por separado, nada
garantiza que dos backends conviertan el mismo dato crudo de la misma forma** — exactamente la
misma clase de bug que ya existe documentada como precedente real del proyecto (la numeración
duplicada que motivó la Regla 3 de política compartida en `reglas-del-modelo.md`).

**Refuerzo formal, como corolario explícito de I5 + I6 combinados (no un invariante nuevo, una
aclaración de alcance):**

> **I5+I6, corolario:** la traducción tipo-ajeno → nodo-AST (toda la tabla de §5.1 del documento
> base) ocurre **exactamente una vez**, en el compute pass, en un módulo compartido — nunca
> reimplementada dentro de la lógica de cada backend, aunque la ergonomía de superficie (una
> sintaxis tipo `\build_table{...}`) sugiera lo contrario. Un backend puede decidir *cómo se ve*
> una tabla ya tipada; nunca *cómo se construye* a partir de datos crudos.

---

## 18 · Revisión de preguntas abiertas (reemplaza parcialmente §13 del documento base)

### 18.1 Multipass — refinado: separar "índice liviano" de "valor resuelto"

La entrada original de §13 (*"¿vale la pena un multipass para referencias declarativas hacia
adelante?"*) trataba el problema como una sola pregunta binaria. La charla sugiere una
distinción más barata y más concreta, tomada del propio precedente de LaTeX
(`.aux`/`\ref`/`\pageref`):

| | Costo | Qué resuelve |
|---|---|---|
| **Índice estructural** — saber que una entidad *existe* y de qué tipo es, sin su valor | barato, no exige ejecutar nada — es un escaneo sintáctico previo | "¿existe algo llamado `total` más abajo?" — suficiente para validar referencias, generar un índice de contenidos, o dar autocompletado en el editor |
| **Valor resuelto** — el contenido real de esa entidad | caro — exige haber corrido el compute pass hasta ese punto (y si es Python, haberlo ejecutado) | mostrar el número real de `total` en la página 1 |

El Invariante I2 (*"solo lo previo"*) del documento base bloquea las dos por igual hoy. Esta
distinción sugiere que **la primera podría relajarse sin pagar el costo de la segunda** — un
prepaso liviano que registra *qué entidades van a existir y de qué tipo*, sin resolver ningún
valor, dejaría "solo lo previo" intacto para valores pero permitiría, por ejemplo, que un nodo
`ref` en la página 1 falle en tiempo de autoría con "esa entidad no existe" en vez de "esa
entidad no existe **todavía**" — mejor feedback, sin reabrir el DAG caro que I2 evita a propósito.

**Reemplaza la entrada de §13 del documento base por esta, más específica:**

| Pregunta | Condición de cierre |
|---|---|
| ¿Vale la pena un prepaso liviano de **índice estructural** (nombre + tipo, sin valor) antes del compute pass, manteniendo I2 intacto para valores? | Cuando el editor necesite autocompletar nombres de entidades o validar referencias antes de tener el documento resuelto — caso de uso de tooling, no de multipass de valores. |
| ¿Vale la pena un multipass de **valores** (no solo índice) para referencias declarativas hacia adelante? | Sigue diferido — sin cambios respecto del documento base; limitado, si se hace, al lado declarativo (nunca a Python, por el costo de re-ejecución). |

### 18.2 Nueva pregunta abierta — resultado tipo "éxito/error" en `emit_*`

Surge directo de §17.1: si un caso de uso real necesita mostrar contenido distinto según si un
cálculo tuvo éxito o falló, ¿el contrato `emit_*` debería tener una variante que devuelva un tipo
suma conocido (`ok(table) | error(mensaje)`), interpretable por un `ref` que declare de antemano
que espera ese tipo — en vez de que Python decida libremente qué nodo producir?

**Condición de cierre:** cuando aparezca un caso de uso real de "contenido condicional según
resultado de cómputo" que no se resuelva mostrando el error como parte del propio `frozen.output`
(que ya es la vía natural para casos simples, vía el mecanismo de aviso de I7).

---

## 19 · Bitácora — nuevas entradas (continúa §14 del documento base)

- **2026-07.** Se explora y se descarta (otra vez, con argumento más explícito) el modelo de
  "anclajes" (Python elige activamente el tipo de nodo en un punto por ID, incluso
  condicionalmente). Razón añadida: el branching de tipo de contenido es una decisión
  estructural — corresponde a ① (autor), no a ② (código) — es una instancia más específica del
  mismo principio que ya descartó el AST-rewriting.
- **2026-07.** Se identifica y se prohíbe explícitamente un patrón que no había sido nombrado
  antes: convertir datos crudos a nodo tipado *dentro* de la lógica de cada backend en vez de una
  sola vez en el compute pass. Mismo riesgo que la numeración duplicada (precedente real del
  proyecto, `reglas-del-modelo.md`).
- **2026-07.** Se agrega `emit_fragment` al contrato, para secuencias heterogéneas de nodos —
  gap real que el contrato original ("un `emit_*` → un nodo") no cubría.
- **2026-07.** Se agrega la vía de clases Python isomorfas (`NodeTable`, etc.) como constructor
  directo, complementario a los adaptadores `emit_*` — no reemplaza el patrón de adaptador, cubre
  el caso donde no hace falta adaptar nada.

---

## 20 · Qué falta hacer con este addendum

Este documento **no está fusionado** con `spec-nodos-ejecutables-matex-borrador.md`. Cuando el
modelo pase de "borrador" a la primera versión normativa cerrada, corresponde:

1. Incorporar `fragment-from-code` a la tabla de §3.3 del documento base.
2. Incorporar `NodeX` / `emit()` a §5.3 del documento base, como vía paralela a los adaptadores.
3. Reemplazar la entrada de multipass en §13 del documento base por la versión refinada de §18.1
   de este addendum.
4. Agregar el corolario de §17.2 como nota formal debajo de I5/I6 en §2 del documento base (no
   como invariante nuevo — es alcance más explícito de los dos ya existentes).
5. Mover las entradas de §19 de este addendum a la bitácora única (§14 del documento base).

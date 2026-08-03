# Metadocumento — cómo estructurar la especificación de diseño de un sistema de AST semántico con código ejecutable embebido

> **Qué es esto.** No es una especificación. Es la **guía para escribirla**: qué secciones debe
> tener, en qué orden, qué pregunta responde cada una, qué formato conviene, y qué errores evita.
> Aplica a cualquier sistema con la forma "árbol semántico + nodos de código + entorno
> compartido + múltiples backends" — no a un proyecto puntual.

---

## 0 · El error que este metadocumento existe para evitar

El error más común al especificar un sistema así es escribir **un solo documento que mezcla tres
cosas de naturaleza distinta**, sin avisar en qué modo está el lector en cada párrafo:

1. **Por qué** se diseñó así (motivación, alternativas descartadas) — cambia poco, es casi
   historia.
2. **Qué debe cumplirse** (contrato, invariantes, reglas normativas) — es lo que un
   implementador *no puede* violar.
3. **Qué existe hoy** (lo realmente construido, con su estado real) — cambia todo el tiempo.

Cuando estas tres capas se mezclan, pasan dos cosas: el lector no sabe si lo que está leyendo es
aspiracional o exigible, y el documento se pudre — porque cada cambio de implementación obliga a
tocar el mismo párrafo que también contiene la motivación y la regla.

**La decisión de fondo, antes de escribir una sola línea:** ¿es esto **un documento** o **tres
documentos enlazados**? La recomendación por defecto es *tres*, del mismo tamaño de proyecto para
arriba:

| Documento | Responde | Cambia | Tono |
|---|---|---|---|
| **Visión** | ¿por qué existe esto, qué problema resuelve? | raro, con reencuadres explícitos | narrativo, puede especular |
| **Especificación normativa** | ¿qué DEBE cumplir cualquier implementación? | con cada decisión de diseño nueva | contractual, RFC-like |
| **Referencia** | ¿qué hay hoy, exactamente, y en qué versión de schema? | con cada release/PR | descriptivo, versionado junto al código |

El resto de este metadocumento describe principalmente el documento **normativo** (el más
difícil de organizar bien), pero cada sección indica cuándo algo pertenece en realidad a Visión
o a Referencia en vez de acá.

---

## 1 · Para quién es la especificación — y por qué eso decide el orden

Un sistema de este tipo tiene **al menos cuatro lectores** distintos, y cada uno entra por un
punto distinto:

- quien **implementa un backend nuevo** (necesita: el schema del AST, el contrato de tipos, la
  tabla de política compartida — no necesita el porqué histórico);
- quien **escribe código ejecutable dentro del documento** (necesita: qué puede leer del entorno,
  qué contrato de salida usar, qué pasa si se equivoca — no necesita el modelo de ejecución
  interno);
- quien **audita/revisa** el diseño (necesita: invariantes, casos límite, decisiones descartadas
  y por qué);
- quien **extiende el modelo** (agrega un tipo de nodo, un `emit_*` nuevo) (necesita: la regla de
  admisión, para saber si su propuesta entra o no).

**Consecuencia de diseño:** la especificación debe poder leerse **de lo abstracto a lo concreto**
(alguien que entra por la primera sección y sigue en orden entiende el sistema completo) **y**
consultarse **de lo concreto a lo abstracto** (alguien que ya sabe lo que busca —"¿qué hago si
dos backends no pueden representar lo mismo?"— tiene que poder saltar directo a esa sección sin
leer el resto). Eso se logra con **cross-linking explícito** entre secciones y con cada sección
respondiendo una pregunta autocontenida, no encadenada a que se haya leído la anterior.

---

## 2 · El esqueleto de secciones — qué va en cada una y por qué

Este es el cuerpo del metadocumento. El orden es el de **lectura recomendada**, no
necesariamente el de escritura (eso va en la §5).

### 2.1 Glosario y terminología

**Por qué es la primera sección, no un apéndice.** En un sistema híbrido, las mismas palabras
("nodo", "contexto", "entidad", "referencia") tienden a usarse con sentidos ligeramente distintos
en cada parte del proyecto, y ahí nacen la mitad de los malentendidos de diseño. El glosario no es
cortesía — es la sección que **previene ambigüedad estructural**, no solo terminológica.

**Qué debe tener cada entrada:** el término, una definición de una línea, y —crucial— **el
término con el que se confunde y en qué se diferencia** (p. ej. "entidad" vs. "nodo AST": toda
entidad tiene un nodo que la declara, pero no todo nodo declara una entidad).

**Qué NO va acá:** ejemplos largos, justificación de por qué el término existe (eso es Visión).

### 2.2 Principios / invariantes no negociables

**Qué responde.** La lista corta (idealmente menos de diez) de reglas que **nunca se rompen**,
sin importar qué feature se agregue después. Es el ADN del sistema — si una feature nueva
contradice algo de esta lista, la feature está mal diseñada, no la lista.

**Formato recomendado.** Enumeración corta, cada regla con:
- el enunciado en una línea, en lenguaje normativo (DEBE/NUNCA, no "generalmente" ni "se
  prefiere");
- una **prueba de violación**: cómo se ve un bug concreto si esto se rompe (esto es lo que hace
  que el invariante sea verificable y no una aspiración).

**Ejemplo de forma** (genérico, no de contenido):
> **Invariante N.** *El árbol nunca se muta desde el código embebido; toda modificación pasa por
> redefinir una entidad y volver a resolver.*
> — Violarlo se ve así: dos ejecuciones del mismo documento fuente producen árboles distintos sin
> que el fuente haya cambiado.

**Qué NO va acá.** Reglas específicas de un tipo de nodo (eso es la §2.3); el razonamiento de por
qué se eligió así en vez de la alternativa (eso es Visión / bitácora de decisiones, §2.14).

### 2.3 Modelo de datos — el catálogo de nodos

**Qué responde.** Cuál es la forma exacta del árbol: qué tipos de nodo existen, qué atributos
tiene cada uno, qué puede contener, qué referencias cruzadas admite.

**Cómo organizarlo — por *categoría de nodo*, no alfabéticamente:**

1. **Nodos estáticos** (el contenido "de siempre", sin cómputo).
2. **Nodos de definición/entidad** (declaran algo nombrado, reutilizable — la contraparte
   declarativa).
3. **Nodos ejecutables** (contienen código; subdividir por *si producen salida visible en su
   propia posición* o no — esta distinción sola evita la mitad de la ambigüedad de diseño, según
   se vio en la práctica).
4. **Nodos de referencia/inyección** (consumen algo del entorno, no lo definen).

**Formato por nodo:** tabla con `atributos`, `reglas de contención`, `referencias que admite`, y
—si el sistema es multi-backend— **la proyección a cada backend, incluido el fallback** cuando un
backend no puede representarlo. Esta última columna es la que más se olvida y la que más dolores
de cabeza evita: forzar, para cada nodo, la pregunta "¿y si el backend no puede con esto?" en el
momento de especificarlo, no cuando ya se implementó y falla.

**Qué NO va acá.** Cómo se llena o resuelve cada nodo en tiempo de ejecución (eso es §2.5-2.6).

### 2.4 Modelo de entorno / namespace compartido

**Qué responde.** Quién escribe en el espacio compartido, quién lee, en qué orden, y qué ve cada
lector en cada punto del recorrido. Es la sección más fácil de dejar ambigua y la más costosa de
corregir después, porque todo lo demás depende de ella.

**Debe responder, explícitamente y sin dejarlo implícito:**
- ¿Es **un** espacio compartido o varios espacios que se comunican? (si son varios, cada frontera
  entre ellos es una fuente de bugs — justificar por qué no es uno solo).
- ¿Cuál es el **orden de evaluación** (declarado en el árbol, o inferido por dependencias)?
- ¿Qué ve un nodo al ejecutarse: **todo** el entorno, **solo lo previo**, o **solo lo que declaró
  como dependencia**? Cada opción tiene una tabla de costo/beneficio distinta y hay que
  justificar la elegida, no solo enunciarla.
- Si hay **más de un productor** de naturaleza distinta (p. ej. uno transparente/barato de
  re-resolver y otro opaco/caro), especificar la asimetría explícitamente con una tabla
  comparativa — no asumir que todos los productores son intercambiables.

**Qué NO va acá.** El contrato de tipos de cada función productora (eso es §2.5).

### 2.5 El contrato de tipos entre código y árbol

**Qué responde.** Cuando el código produce algo que debe convertirse en contenido del árbol,
¿cuál es exactamente la función/mecanismo de conversión, y qué garantiza?

**Debe dejar explícito, para cada "constructor" de este tipo:**
- **tipo de entrada** (lo que el lenguaje huésped puede producir de forma nativa) vs. **tipo de
  salida** (el nodo canónico del árbol) — nunca asumir que son el mismo tipo; el constructor es
  precisamente la función que absorbe esa diferencia;
- **qué pasa cuando la entrada no calza perfecto** con el schema destino: ¿degrada con aviso,
  falla explícitamente, o extiende el schema? — las tres son válidas, pero **debe estar decidida
  por escrito**, nodo por nodo, no dejada a criterio de quien implemente;
- **una prueba de admisión reusable**: la regla corta que decide si un campo/capacidad nueva entra
  al modelo canónico o se queda como detalle de la conversión (algo del tipo "¿lo pueden honrar
  todos los backends destino? ¿le ahorra decisión real a quien produce el contenido, o es solo un
  ajuste fino?").

**Formato recomendado:** una tabla por cada función de conversión, con columnas `campo de origen
→ campo de destino`, y una fila aparte para "lo que no tiene equivalente" con la política de
degradación.

### 2.6 Modelo de ejecución — fases, momentos, determinismo

**Qué responde.** El pipeline completo, de principio a fin: parseo → resolución/cómputo →
render. Y, dentro de eso, **en qué momento temporal corre cada cosa** si el sistema tiene más de
uno (tiempo de autoría, tiempo de build, tiempo de lectura/consumo).

**Debe incluir, siempre:**
- una tabla de **momentos** (cuándo corre qué, y para quién sirve cada momento — esto suele
  revelar que features que parecían "una sola feature de cómputo" en realidad son tres con costos
  muy distintos);
- la semántica exacta de **congelar/materializar** un resultado: qué se persiste, con qué
  metadata de procedencia (para que el resultado sea auditable/reproducible sin volver a
  ejecutar), y bajo qué condición se vuelve a computar;
- una afirmación explícita de **qué backends nunca ejecutan código** (si aplica) — es una garantía
  de seguridad y de reproducibilidad que vale la pena declarar como invariante, no dejarla
  implícita en el diagrama de flujo.

### 2.7 Consistencia entre implementaciones / política compartida

**Qué responde.** De todo lo que **no** está en el árbol (porque lo decide el sistema, no el
autor), ¿qué parte **debe** dar el mismo resultado sin importar qué backend/motor lo procese?

**La prueba que organiza toda esta sección** (reusar, no reinventar cada vez): *si dos
implementaciones lo resuelven distinto, ¿es un bug o es una diferencia legítima de medio?* Bug →
va en esta sección, con una tabla que enumere cada decisión, su regla, y el estado real de cada
implementación frente a esa regla (coincide / no coincide / sin verificar). Diferencia legítima →
no entra acá, es una nota aparte de "esto puede y debe variar por backend".

**Por qué esta sección es la que más previene bugs de "funciona distinto según por dónde lo
mires":** convierte una fuente difusa de inconsistencias en una checklist verificable con tests
de equivalencia — la especificación se vuelve, literalmente, el insumo de esos tests.

### 2.8 Errores, casos límite y su taxonomía

**Qué responde.** Ante cada forma de "esto no puede resolverse limpio", ¿qué hace el sistema?

**Organizar por tipo de falla, no por feature:**
- referencias circulares / ciclos — ¿se detectan? ¿cómo? ¿se rechazan o se permiten con aviso?
- contrato de tipos violado (el código produce algo que no calza con lo declarado) — ¿falla en el
  momento de producir, o más tarde, silenciosamente?
- algo representable en un backend pero no en otro — ver §2.3 (columna de fallback) y §2.5
  (degradación), referenciar en vez de repetir.
- estado no determinista donde se esperaba determinismo — ¿se fuerza (seeds, sandboxing) o se
  marca como tal en la procedencia?

**Regla de forma:** cada caso, sin excepción, responde **"avisa o miente"** — un sistema que
finge que algo salió bien cuando degradó silenciosamente es la fuente de bugs más cara de
diagnosticar, y la especificación es el lugar para prohibirlo por escrito.

### 2.9 Seguridad y aislamiento

**Qué responde.** Si hay código de terceros/autor ejecutándose, ¿qué puede y qué no puede tocar?
Sandboxing, superficie expuesta, qué pasa con recursos externos (red, disco, tiempo/memoria).

**Suele subestimarse** porque durante el diseño temprano "total, total nadie más va a correr
esto" — pero es barato de declarar temprano y carísimo de agregar después, así que corresponde
que esté en la especificación normativa desde la primera versión, aunque el mecanismo real (qué
sandbox, qué límites) se difiera.

### 2.10 Versionado y migración

**Qué responde.** Cuando el schema del árbol cambia, ¿qué pasa con los documentos y con el código
ya escrito contra la versión vieja?

**Debe cubrir dos direcciones, no solo una:** migración de documentos ya persistidos (algo del
tipo "versión de AST" con reglas de upgrade), **y** compatibilidad de la API que usa el código
embebido (si un constructor/función cambia de forma, ¿el código viejo se rompe, se degrada con
default, o se rechaza con mensaje claro?). Es común especificar solo la primera y olvidar la
segunda.

### 2.11 Casos de uso trabajados de punta a punta

**Qué responde — y por qué es la sección que más vale la pena escribir con cuidado.** 3 a 6
ejemplos completos, cada uno mostrando: fuente de entrada → estado del árbol → estado del entorno
resuelto → salida en cada backend soportado. Es donde las secciones abstractas anteriores se
ponen a prueba: si un caso de uso no se puede trazar limpio por las reglas ya escritas, **el
modelo tiene un hueco**, no el ejemplo.

**Selección de los casos — que cubran, entre todos, las combinaciones que importan:**
- el caso trivial (nada de código, solo lo estático) — sirve para probar que la capa nueva no
  penaliza al caso simple;
- un caso con un solo productor de cada tipo (uno declarativo, uno de código);
- un caso que **cruza** ambos productores (uno lee lo que produjo el otro) — el caso que ejercita
  la sección 2.4 entera;
- un caso de falla (algo que debería avisar, no fingir) — ejercita 2.8;
- si aplica, un caso de límite del contrato de tipos (algo que no calza perfecto) — ejercita 2.5.

**Formato recomendado:** no prosa larga — una tabla o diagrama de estados por caso, con el fuente
real (no pseudocódigo abstracto) en cada paso.

### 2.12 Límites y no-objetivos explícitos

**Qué responde.** Qué es lo que este sistema **decide no resolver**, y por qué, para que no se
lea como un olvido sino como una decisión.

**Por qué es una sección obligatoria y no un lujo:** sin ella, cada lector nuevo propone la
misma feature descartada, y cada vez hay que rehacer la discusión desde cero. Declarar el límite
por escrito, una vez, con su razón, ahorra esa discusión permanentemente — y si algún día se
revierte, se **reencuadra** explícitamente (ver §4) en vez de borrarse en silencio.

### 2.13 Preguntas abiertas / decisiones diferidas

**Qué responde.** Qué es lo que **todavía no está decidido**, marcado como tal, para que nadie lo
lea como si ya lo estuviera.

**Regla de forma:** cada pregunta abierta lleva **la condición que la cierra** ("se decide
cuando..."), no solo el enunciado de la duda — si no, la sección se vuelve una lista de deseos
sin mecanismo de resolución.

### 2.14 Bitácora de decisiones (decision log)

**Qué responde.** De las alternativas consideradas y descartadas, cuáles fueron y por qué —
fechado.

**Por qué separado de los invariantes (§2.2):** los invariantes son el resultado final,
atemporal; la bitácora es el camino, con fecha, y sirve para que una propuesta futura de revisar
una decisión pueda ver rápido si ya se consideró y por qué se rechazó, en vez de reabrir el debate
sin memoria.

### 2.15 Estrategia de verificación

**Qué responde.** Cómo se comprueba, de forma repetible, que una implementación cumple esta
especificación — no en teoría, en tests concretos.

**Debe derivar directo de secciones anteriores, no inventar criterios nuevos:** tests de
equivalencia sobre la tabla de política compartida (§2.7), un test por cada caso de uso trabajado
(§2.11), un test por cada caso de falla de la taxonomía (§2.8). Si un test no puede escribirse
porque la sección correspondiente es ambigua, esa ambigüedad hay que resolverla antes, no
después.

---

## 3 · Convenciones transversales — aplican a todas las secciones

Estas no son secciones, son reglas de *cómo escribir* cualquier sección de arriba:

- **Marcar estado en todo lo que no sea 100% definitivo:** algo así como
  `✅ implementado / 🟡 parcial / ⬜ pendiente / ❌ descartado`, en cada pieza del modelo. Sin esto,
  la especificación normativa se contamina con aspiración y dos lectores distintos la interpretan
  distinto.
- **Lenguaje normativo real para lo que es contrato** (DEBE / NUNCA / SOLO SI), lenguaje
  descriptivo para lo que es explicación. Mezclar los dos registros en la misma frase es la
  ambigüedad más común de este tipo de documentos.
- **Ejemplo mínimo + contraejemplo** en toda regla no trivial: qué la cumple, qué la viola. Una
  regla sin contraejemplo suele esconder una ambigüedad que nadie detectó todavía.
- **Tablas de decisión antes que prosa** cuando hay una matriz real (quién decide / cuándo se
  resuelve / dónde vive algo). La prosa oculta los casos que faltan; una tabla los expone como
  celdas vacías.
- **Cross-linking explícito**, no implícito: cada sección que depende de otra la referencia por
  nombre, para que el documento se pueda leer salteado.

---

## 4 · Cómo mantenerla viva sin que se pudra

- **Separación física del documento de Referencia** (§0): la especificación normativa dice
  *qué debe cumplirse*; un documento de Referencia aparte, versionado junto al schema real, dice
  *qué hay hoy*. Si se mezclan, cada commit de código obliga a tocar el documento de contrato.
- **Reencuadre visible, no reescritura silenciosa:** cuando una decisión anterior cambia, se dejp
  una nota fechada que dice qué decía antes y qué dice ahora y por qué — nunca se borra el rastro.
  Esto es lo que permite que la bitácora (§2.14) siga siendo confiable con el tiempo.
- **Un documento "vivo" para la parte que todavía se discute, uno "congelado"/versionado para la
  parte que ya se implementó y no se toca sin proceso de migración** — son ritmos de cambio
  distintos y conviene que tengan contenedores distintos desde el principio, no separarlos recién
  cuando ya duele.

---

## 5 · Orden recomendado de *escritura* (no de lectura)

El orden de la §2 es el de lectura. Para escribir, conviene un orden distinto:

1. **Glosario + invariantes primero** (§2.1-2.2) — son lo más estable; escribir el resto sin esto
   produce ambigüedad que hay que deshacer después.
2. **Un caso de uso end-to-end mínimo, antes que el modelo de datos completo** — trazarlo a mano
   fuerza a descubrir qué tipos de nodo hacen falta de verdad, en vez de diseñar el catálogo
   completo de memoria y descubrir después que no alcanza (o que sobra).
3. **Modelo de datos + entorno + contrato de tipos** (§2.3-2.5), iterando contra ese caso de uso
   hasta que trace limpio.
4. **El resto de los casos de uso** (§2.11 completa) — ahora sirven para *encontrar huecos*, no
   para ilustrar un modelo ya cerrado.
5. **Política compartida, errores, seguridad, versionado** (§2.6-2.10) — se completan naturalmente
   una vez que el modelo de datos es estable; escribirlas antes suele ser prematuro.
6. **Límites, preguntas abiertas, bitácora, verificación** (§2.12-2.15) — al final, porque
   dependen de haber visto qué quedó afuera y qué quedó sin resolver en el resto del proceso.

Esto es, en el fondo, la misma disciplina de **"formalizar el modelo antes que la sintaxis, y
validar el modelo con un vertical slice antes de generalizar"**: no se escribe la especificación
completa de memoria y después se prueba — se prueba con un caso mínimo primero, y **la
especificación completa se escribe alrededor de lo que ese caso obligó a decidir**.

---

## 6 · Checklist final de completitud

Antes de considerar la especificación "lista para implementar contra ella":

- [ ] ¿Todo término del glosario se usa consistentemente en el resto del documento?
- [ ] ¿Cada invariante (§2.2) tiene una prueba de violación concreta?
- [ ] ¿Cada tipo de nodo (§2.3) tiene su fila de fallback por backend, aunque sea "no aplica"?
- [ ] ¿El modelo de entorno (§2.4) responde explícitamente qué ve cada nodo — no se puede inferir
      "por sentido común"?
- [ ] ¿Cada función de conversión código→árbol (§2.5) tiene su tabla de campos y su política de
      degradación?
- [ ] ¿Existe una tabla de política compartida (§2.7) y no una lista de buenas intenciones?
- [ ] ¿Cada caso de error (§2.8) dice explícitamente si avisa, falla o degrada — nunca queda
      implícito?
- [ ] ¿Los casos de uso (§2.11) usan fuente real, no pseudocódigo, y cubren al menos: trivial,
      un productor, cruce de productores, un caso de falla?
- [ ] ¿La sección de límites (§2.12) existe y no está vacía?
- [ ] ¿Cada pregunta abierta (§2.13) tiene su condición de cierre?
- [ ] ¿Se puede escribir, hoy, al menos un test por cada fila de la tabla de política compartida?

Si alguna casilla no se puede tildar, esa es la sección por la que conviene seguir iterando antes
de darla por cerrada — no el resto del documento.

# Matex: incorporación de contenido dinámico y código ejecutable
## Informe de diseño conceptual

---

## 0. Contexto y punto de partida

Matex es una abstracción semántica e intencional de LaTeX. La separación de capas ya establecida es:

```
AST (núcleo semántico e intencional)
  │
  ├── compila a → LaTeX
  ├── compila a → otros backends
  └── se edita mediante → editor web (que a su vez es "otro backend",
                            pero uno especial: el que construye el AST)
```

Sobre esta base sólida, surgen dos líneas de evolución que en un primer análisis parecen distintas pero que, como se argumenta en este informe, son **la misma abstracción aplicada dos veces**:

1. **Interacción dinámica con vistas** (zoom/pan sobre gráficos, con "freeze" al AST).
2. **Código ejecutable embebido** (bloques Python, archivos `.py` en el proyecto, variables computadas que retroalimentan texto y fórmulas).

Un tercer caso de uso concreto motiva y valida el diseño: **reemplazar la "magia negra" en JS** que hoy calcula puntos de curvas implícitas, por un algoritmo Python transparente, editable e inspeccionable dentro del propio documento.

Este informe desarrolla el marco conceptual, evalúa alternativas de arquitectura, señala riesgos, y propone un modelo concreto de nodo de AST.

---

## 1. El principio unificador: generación vs. materialización

### 1.1 La idea central

Todo nodo "problemático" (el que no es LaTeX estático puro) tiene, en potencia, dos caras:

- **Cara generativa**: el proceso, código, parámetros o interacción que *produce* un valor. Es dinámica, potencialmente no determinista en el tiempo (depende de versiones de librerías, de estado externo, de random seeds), y **no es directamente compilable a LaTeX**.
- **Cara materializada**: un valor concreto, congelado, con procedencia registrada (qué generó esto, con qué inputs, cuándo), que **sí es compilable a LaTeX** porque es estático por definición.

Zoom/pan sobre un gráfico y ejecución de código Python son, bajo esta lente, el mismo patrón:

| | Zoom/Pan sobre gráfico | Bloque de código ejecutable |
|---|---|---|
| Cara generativa | Interacción de cámara (centro, escala, ángulo) | Código fuente + parámetros + dependencias |
| Cara materializada | Viewport congelado (bounding box, transform) | Valor de la variable (número, lista de puntos, tabla, imagen) |
| Trigger de "freeze" | Usuario decide que esa vista es la definitiva | Usuario ejecuta o el sistema re-ejecuta automáticamente |
| Qué compila a LaTeX | El viewport fijo, no el estado interactivo | El valor materializado, no el código |

### 1.2 Por qué importa unificar esto y no tratarlo como dos features

**A favor de unificar (recomendado):**
- Una sola abstracción nueva en el AST, no dos. Menor superficie de mantenimiento.
- Cualquier feature futura de naturaleza dinámica (simulaciones, datos externos vía API, animaciones, gráficos 3D interactivos) entra por la misma puerta sin rediseñar el AST cada vez.
- El editor necesita un solo patrón de UI para "esto está vivo / esto está congelado / esto quedó desactualizado", reutilizable en todos los casos.
- Conceptualmente, refuerza la identidad de Matex: la intención semántica es el core, y todo lo demás (interactividad, cómputo) es "azúcar" que eventualmente colapsa a esa intención estática.

**En contra de unificar (alternativa: tratarlas como features separadas):**
- Zoom/pan es fundamentalmente *geométrico/visual* y código ejecutable es *computacional/de datos*. Forzar un modelo común podría generar una abstracción demasiado genérica ("todo es un nodo con estado generativo/materializado") que termine siendo difícil de razonar en casos concretos.
- El manejo de errores es distinto: un zoom fallido no existe (siempre hay un viewport válido), pero código que falla en ejecución sí, y necesita su propio modelo de estados (error, running, timeout).
- Riesgo de sobre-ingeniería temprana: diseñar la abstracción general antes de tener 2-3 casos de uso reales implementados puede llevar a generalizar mal.

**Recomendación**: unificar a nivel de *filosofía y vocabulario* (generativo/materializado, fresh/stale, freeze), pero no forzar una única clase de nodo en el AST. Es decir, compartir el *patrón de diseño*, no necesariamente el *código*. Esto da los beneficios conceptuales sin el riesgo de una abstracción prematura y sobrecargada.

---

## 2. Arquitectura de código ejecutable: dos capas, no una

### 2.1 Propuesta central

Separar tajantemente:

**Capa 1 — Módulos de proyecto (`.py`)**
- Viven en el file explorer del proyecto, junto a imágenes y `.mtex`.
- Contienen funciones puras (o casi puras) reutilizables: `implicit_curve(f, domain, resolution)`, `integrate(f, a, b)`, etc.
- Son la "librería" del proyecto: testeable, versionable, sin acoplamiento al flujo narrativo del documento.
- No se ejecutan "solas" — son invocadas.

**Capa 2 — Bloques inline ejecutables (dentro del `.mtex`)**
- Viven en el flujo del documento, intercalados con teoremas, fórmulas, texto.
- Orquestan: llaman funciones de `.py`, o contienen lógica simple propia (glue code).
- Producen **variables con nombre** que quedan disponibles para el resto del documento.
- Son la capa que más se parece a una "celda de notebook", pero acotada a bindeo de variables, no a lógica de negocio pesada.

### 2.2 Por qué esta separación importa

| Sin separación (todo inline) | Con separación (módulos + bloques) |
|---|---|
| El `.mtex` se llena de lógica compleja, deja de ser "documento" y pasa a ser "script" | El `.mtex` sigue siendo legible como documento; el código complejo vive aparte |
| Difícil de testear (no hay forma de correr un test sobre un bloque incrustado en prosa) | Los `.py` se testean con pytest normal, fuera del contexto del editor |
| Reutilización nula entre documentos o incluso dentro del mismo | Un módulo `.py` se puede importar desde múltiples bloques o documentos |
| El editor tiene que ser un IDE completo de Python para que sea usable | El editor solo necesita ser bueno en *bindeo* y *visualización de resultados*; edición pesada de `.py` puede delegarse a syntax highlighting simple o incluso a herramientas externas |

### 2.3 Alternativa a considerar: todo-en-uno (no recomendada, pero justa de evaluar)

Una alternativa válida es no separar y permitir que cualquier bloque de código, sin importar tamaño, viva inline, con la promesa de que el usuario "se organiza solo" (como Jupyter, donde nada te obliga a modularizar).

- **Pros**: menor fricción inicial, un usuario puede empezar a escribir código sin pensar en arquitectura de proyecto, mapea directamente a la experiencia mental de notebooks que ya es popular y conocida.
- **Contras**: es exactamente el problema que ya tienen los notebooks de Jupyter en el mundo real — código desorganizado, difícil de reusar, difícil de testear, y con el agravante de que en Matex el código convive con contenido *semántico* (teoremas, fórmulas), por lo que el desorden es doblemente costoso: ensucia tanto la lógica computacional como la narrativa del documento.

**Conclusión de esta sección**: mantener la separación de dos capas, pero no ser estricto — permitir bloques inline pequeños sin forzar siempre extraer a `.py` (dar la opción, no la obligación).

---

## 3. El problema central: orden de ejecución vs. grafo de dependencias

### 3.1 El error clásico a evitar

Un modelo de "ejecutar bloques en el orden en que aparecen en el documento" (como Jupyter clásico) genera un problema bien conocido: el orden de ejecución real (en el que el usuario efectivamente corrió las celdas) puede divergir del orden visual/textual, produciendo estado inconsistente e invisible — una celda puede "recordar" un valor de una ejecución anterior que ya no corresponde al código actual.

Este problema es *especialmente* peligroso en Matex porque el output no es solo una vista en pantalla (como en Jupyter) — es un **documento LaTeX compilado y potencialmente publicado**. Un valor "fantasma" (correcto en el momento en que se congeló, pero ya no reproducible con el estado actual del código) que se cuela en un paper o informe final es un problema serio de integridad, no solo una molestia de UX.

### 3.2 La alternativa recomendada: grafo de dependencias explícito (DAG)

En vez de "orden de aparición" como fuente de verdad, usar el **grafo de dependencias real** entre variables:

- Cada variable declara (implícita o explícitamente) de qué otras variables depende.
- El sistema deriva el orden de ejecución correcto a partir del grafo, no de dónde está escrito el bloque en el documento.
- Esto es exactamente el enfoque de **Marimo** (notebook reactivo de Python), que resuelve el problema de Jupyter derivando el orden de ejecución del grafo de dependencias real, garantizando que no haya estado oculto o inconsistente.
- Es también, conceptualmente, el mismo enfoque que usan los *build systems* (`make`, `bazel`): un grafo de tareas con dependencias, donde solo se recalcula lo que cambió (más sobre esto en 3.3).

**Pros de esta alternativa:**
- Elimina por completo la clase de bugs "ejecuté las celdas en el orden incorrecto".
- El editor puede mostrar visualmente el grafo: qué depende de qué, y detectar ciclos antes de que sean un problema.
- Encaja naturalmente con la idea de "compilar" que ya tiene Matex: compilar = resolver el grafo hasta el final y congelar todo.
- Permite paralelizar ejecución de nodos independientes (dos integrales que no dependen entre sí pueden calcularse en simultáneo).

**Contras / costos:**
- Mayor complejidad de implementación que "ejecutar en orden de aparición". Hay que parsear/inferir dependencias, detectar ciclos, invalidar en cascada.
- El usuario tiene que entender el modelo mental de "reactivo" en vez de "secuencial", lo cual para gente acostumbrada a notebooks tradicionales (Jupyter) puede requerir una curva de aprendizaje, aunque sea breve.
- Dependencias implícitas (side effects, estado global, variables de entorno) son más difíciles de capturar automáticamente que dependencias explícitas — hay que decidir si se infieren por análisis estático del código o si el usuario las declara a mano (ver 3.4).

### 3.3 Cacheo por hash de procedencia

Una vez que hay grafo de dependencias, el cacheo es casi gratis y muy valioso:

- Cada nodo computado tiene un hash derivado de: su propio código + los valores (o hashes) de sus dependencias + parámetros de ejecución.
- Si el hash no cambió desde la última ejecución, no se recalcula — se reutiliza el valor materializado.
- Esto resuelve de forma natural el "freeze para compilar a LaTeX": congelar es simplemente "asegurarse de que el valor materializado actual corresponde al hash actual del grafo, y persistirlo con su procedencia".
- Bonus: esto también da trazabilidad/reproducibilidad — se puede saber exactamente qué código y qué inputs produjeron un número que aparece en el documento final, lo cual es valioso en contextos académicos/científicos (el público natural de un producto tipo LaTeX).

### 3.4 Cómo declarar dependencias: alternativas

| Enfoque | Descripción | Pros | Contras |
|---|---|---|---|
| **Inferencia estática** | El sistema analiza el AST de Python (vía `ast` module) para detectar qué variables lee y escribe cada bloque | Cero fricción para el usuario, no hay que aprender sintaxis nueva | Falla con metaprogramación, `eval`, imports dinámicos; falsos positivos/negativos posibles |
| **Declaración explícita** | El usuario anota qué variables usa/produce (`# uses: a, b` / `# produces: c`) o mediante firma de función | Robusto, predecible, fácil de depurar | Fricción extra, el usuario puede olvidarse de declarar y generar bugs silenciosos |
| **Firma de función como contrato** | Cada bloque es en el fondo una función; sus parámetros son las dependencias y su valor de retorno (o variables nombradas de retorno) son lo que produce | Balance entre lo anterior: la sintaxis de Python ya lo fuerza naturalmente | Requiere que el editor traduzca bien "bloque en el documento" a "función con firma", puede sentirse menos "notebook-like" |

**Recomendación**: empezar con inferencia estática para el caso común (cubre el 90% de los casos con cero fricción), y caer a declaración explícita solo cuando la inferencia sea ambigua o el usuario quiera forzar un comportamiento distinto. Esto es análogo a cómo TypeScript infiere tipos pero permite anotarlos explícitamente cuando hace falta.

---

## 4. Estados visibles en el editor: fresh / stale / error / running

Independientemente de la alternativa elegida en la sección 3, el editor necesita comunicar claramente el estado de cada variable computada, similar a como una hoja de cálculo (Excel/Google Sheets) muestra recálculo pendiente:

- **Fresh (verde)**: el valor materializado corresponde al hash actual del código y sus dependencias.
- **Stale (amarillo/naranja)**: el código o alguna dependencia cambió desde la última ejecución; el valor mostrado es el último conocido, pero no garantizado como actual.
- **Running (azul/spinner)**: ejecución en curso.
- **Error (rojo)**: la última ejecución falló; se debe decidir si se muestra el último valor válido conocido (con warning) o se bloquea el uso de esa variable aguas abajo.

Esto es crítico para la confianza del usuario: sin esta señal visual, el sistema puede "mentir" (mostrar un valor viejo como si fuera actual), lo cual —de nuevo— es particularmente grave si el destino final es un documento LaTeX compilado y potencialmente publicado.

---

## 5. Dónde ejecutar Python: alternativas de infraestructura

### 5.1 Pyodide / WebAssembly (todo en el navegador)

Python compilado a WASM, corriendo enteramente en el cliente.

**Pros:**
- Sandboxing gratis: el código nunca toca un servidor, no hay riesgo de ejecución arbitraria del lado del backend.
- Cero latencia de red por ejecución, funciona offline una vez cargado.
- Simplifica enormemente la infraestructura (no hay que gestionar kernels, colas, contenedores).

**Contras:**
- Librerías pesadas o con dependencias nativas (compiladas en C/Fortran) pueden no estar disponibles o ser mucho más lentas — numpy y ciertas partes de scipy funcionan razonablemente bien, pero el ecosistema completo (pandas avanzado, librerías de ML, etc.) es más limitado o pesado de cargar.
- Tiempo de carga inicial (descargar el runtime WASM + librerías) puede ser notorio.
- Recursos limitados por el navegador del usuario (memoria, CPU) — cómputo pesado (ej. simulaciones numéricas grandes) puede no ser viable.

### 5.2 Kernel real en backend (tipo Jupyter kernel por sesión/proyecto)

Un proceso Python real corriendo en un servidor, uno por proyecto o por sesión de usuario.

**Pros:**
- Acceso completo al ecosistema Python sin restricciones (cualquier librería, incluidas las que requieren compilación nativa o mucha memoria).
- Cómputo pesado es viable (simulaciones, ML, procesamiento de datos grande).
- Modelo más cercano a lo que un usuario avanzado de Python ya espera.

**Contras:**
- Sandboxing es un problema serio y no opcional: código arbitrario de usuarios ejecutándose en tu infraestructura requiere aislamiento robusto (contenedores, gVisor/Firecracker, límites de recursos, timeouts).
- Costo de infraestructura: mantener kernels vivos por proyecto/usuario implica gestión de recursos, escalado, y costo de cómputo del lado del proveedor del servicio.
- Latencia de red en cada ejecución.
- Gestión de sesiones: qué pasa si el usuario cierra la pestaña, cuánto tiempo se mantiene vivo un kernel inactivo, cómo se recupera el estado.

### 5.3 Modelo híbrido (recomendado)

Dado que Matex ya tiene el concepto de file explorer con `.py` como parte del proyecto (no solo snippets aislados), es probable que el caso de uso real incluya módulos con dependencias no triviales (numpy, matplotlib, scipy, sympy para cálculo simbólico). Esto empuja hacia necesitar backend real en algún punto.

Propuesta de camino incremental:
1. **Empezar con Pyodide** para el 80% de los casos (aritmética, listas de puntos, funciones simples tipo la de curvas implícitas) — cubre el caso de uso mencionado (marching squares con numpy liviano) sin necesidad de infraestructura de backend.
2. **Ofrecer kernel de backend como opción "Pro" o para proyectos que lo requieran explícitamente** — activable cuando el usuario necesita librerías pesadas o cómputo que excede lo razonable en el cliente.
3. Diseñar la interfaz de ejecución (la capa 2 de la sección 2.1) de forma agnóstica al backend de ejecución, para que este sea un detalle de infraestructura intercambiable y no una decisión que contamine el modelo del AST.

---

## 6. Seguridad

Independientemente de dónde corra el código:

- **Pyodide**: el sandboxing del navegador ya aísla razonablemente bien, pero igual hay que cuidar accesos a APIs del navegador expuestas al contexto de ejecución (fetch, storage) si se decide dar acceso a la red desde el código del usuario.
- **Backend**: sandboxing serio no es opcional — contenedores efímeros con límites estrictos de CPU/memoria/tiempo, sin acceso a red salvo whitelist explícita, sin acceso al sistema de archivos del host más allá del proyecto del usuario.
- **Caso especial de colaboración/compartir proyectos**: si en algún momento Matex permite compartir o publicar proyectos (por ejemplo, una plantilla con código reusable), hay que considerar que un usuario podría abrir un proyecto de otro que contenga código malicioso — el sandboxing debe protegerse no solo del "usuario ejecutando su propio código" sino de "usuario ejecutando código de un tercero sin saberlo".

---

## 7. Aplicación al caso concreto: curvas implícitas

Tomando el ejemplo que motivó esta conversación — reemplazar la magia negra en JS que calcula puntos de una curva implícita — el modelo propuesto se aplicaría así:

1. **Módulo `.py` del proyecto**: función `implicit_curve(f, domain, resolution=100, method="marching_squares")` que devuelve una lista de pares `(x, y)` (o múltiples curvas si hay múltiples componentes conexas). Puede apoyarse en `numpy` + un marching squares propio, o en `skimage.measure.find_contours` si se opta por backend con librerías completas.
2. **Bloque inline en el `.mtex`**: invoca esa función con los parámetros específicos del documento (la función implícita en cuestión, el dominio, la resolución deseada), y liga el resultado a una variable, por ejemplo `curva_1`.
3. **Nodo de gráfico existente** (el mismo que ya maneja zoom/pan/freeze): recibe `curva_1` como fuente de datos, en vez de calcular internamente los puntos. El nodo de gráfico sigue siendo responsable de las decisiones estéticas (color, grosor, estilo de línea) — separado limpiamente del cómputo matemático, como se señaló en la sección 2.

### Separación cómputo vs. estética — por qué se remarca este punto

Es tentador mezclar en un mismo bloque la lógica de cálculo (encontrar los puntos) con decisiones visuales (cómo se ven). Mantenerlos separados tiene un beneficio concreto y verificable en este caso: la misma función `implicit_curve` (o una derivada de ella, como una que calcule el área encerrada) se puede reutilizar para producir **otra variable numérica** (ej. área bajo la curva) que se inserte directamente en una fórmula o en texto narrativo, sin arrastrar nada de la configuración visual del gráfico. Si el cómputo y la estética estuvieran mezclados en el mismo bloque, esa reutilización sería mucho más costosa de lograr limpiamente.

### Beneficio pedagógico adicional

Al blanquear el algoritmo como código Python visible y editable, el gráfico deja de ser una "caja negra que dibuja una curva" y pasa a ser una demostración transparente de cómo se calcula numéricamente una curva implícita — con parámetros ajustables (resolución de grilla, método) que el usuario puede modificar y ver el efecto inmediato. Esto es coherente con cualquier ambición educativa/científica del producto, más allá de ser simplemente "más prolijo".

---

## 8. Riesgos y contraargumentos generales a tener en cuenta

Para no perder la mirada crítica, algunos riesgos que vale la pena nombrar explícitamente:

- **Alcance ("scope creep")**: cada feature dinámica que se agrega (zoom, código, y lo que siga — ¿datos externos vía API? ¿animaciones? ¿colaboración en tiempo real sobre código?) empuja a Matex más cerca de ser un IDE/notebook completo, lo cual compite con herramientas ya maduras (Jupyter, Observable, Marimo) en un terreno que no es el diferencial original del producto (la abstracción semántica de LaTeX). Vale la pena preguntarse explícitamente, para cada nueva capacidad: *¿esto refuerza la propuesta de valor central o la diluye?*
- **Complejidad percibida por el usuario nuevo**: un usuario que solo quiere escribir un documento LaTeX más cómodo no debería sentir que necesita entender grafos de dependencias y kernels de Python para usar Matex. La capa ejecutable debe ser estrictamente opt-in y nunca aparecer como requisito en el camino feliz básico.
- **Mantenimiento a largo plazo**: sandboxing seguro, gestión de kernels, e infraestructura de ejecución son superficies de mantenimiento no triviales que compiten por recursos de desarrollo con el core de Matex (el AST y los backends de compilación). Vale la pena evaluar si en una primera etapa conviene apoyarse en soluciones existentes (Pyodide ya resuelto por terceros, o incluso integraciones con Jupyter kernels ya existentes) en vez de construir infraestructura de ejecución propia desde cero.
- **Determinismo y reproducibilidad**: código Python puede tener efectos no deterministas (randomness sin seed fija, dependencias de tiempo/fecha, llamadas a red). Si el objetivo final es un documento LaTeX "confiable", vale la pena considerar advertencias o incluso restricciones sobre patrones no deterministas en el código embebido, o al menos dejar registrado explícitamente en la procedencia si un valor fue generado de forma no determinista.

---

## 9. Síntesis: por qué este diseño mantiene la coherencia filosófica de Matex

El argumento de fondo para que esto no se convierta en un "monstruo" es el siguiente: la capa ejecutable no es una carga estructural sobre todos los documentos, es una **capa ortogonal y opcional** que se adjunta al AST solo en los puntos donde el usuario decide explícitamente exponer una variable computada. Un `.mtex` sin bloques de código sigue siendo tan simple como era antes de esta feature.

Esto se puede formular como un criterio de diseño verificable: **si se pudiera eliminar toda la feature de código ejecutable de Matex y el resto del sistema (AST, compilación a LaTeX, editor, zoom/pan) siguiera funcionando intacto, la separación está bien hecha.** Cualquier decisión de implementación que rompa esta propiedad (por ejemplo, que el compilador a LaTeX necesite saber sobre Python incluso para documentos que no lo usan) es una señal de alerta de que la capa se está filtrando donde no debería.

---

## 10. Preguntas abiertas para la siguiente iteración de diseño

1. ¿Cuál es la sintaxis concreta del bloque ejecutable inline dentro del `.mtex`, y cómo se referencia una variable computada desde una fórmula o texto (ej. `\mxvar{nombre}` u otra convención)?
2. ¿Qué estructura de nodo del AST representa un "nodo computado"? ¿Qué campos mínimos necesita (referencia a código fuente, hash de dependencias, valor materializado, timestamp, estado)?
3. ¿Se infieren dependencias estáticamente o se declaran explícitamente, al menos en la primera versión?
4. ¿Pyodide first, backend first, o ambos desde el día uno?
5. ¿Cómo se comunica visualmente en el editor el grafo de dependencias entre variables, especialmente cuando crece?
6. ¿Qué pasa con valores computados cuando el documento se comparte/exporta sin acceso al entorno de ejecución — se exportan solo los valores congelados, o también el código fuente como parte del artefacto final (por trazabilidad)?

Sí, y de hecho creo que es una extensión natural —no un salto— de lo que ya diseñamos. Vale la pena separar dos preguntas distintas que están mezcladas en tu mensaje, porque tienen implicancias de diseño diferentes:

## 1. Matex como entorno de *investigación* (cálculo numérico, estadística, exploración)

Acá el patrón de uso cambia bastante respecto al "documento final". Investigación implica iterar, ensayar, descartar, comparar — es más parecido al loop exploratorio de un notebook que al de un documento que se escribe una vez y se pule.

**Lo que ya tenés resuelto y que encaja bien:**
- El modelo de grafo de dependencias (sección 3 del informe) es exactamente lo que necesitás para explorar: cambiás un parámetro de un modelo estadístico y todo lo que depende de él (gráficos, tablas, texto que cita el resultado) se invalida y recalcula en cascada, sin que vos tengas que rastrear manualmente qué tocar.
- La separación en capas (`.py` como librería, bloques inline como orquestación) es *más* valiosa acá, no menos: en investigación real las funciones de cómputo (un modelo de regresión, un test de hipótesis, una simulación de Monte Carlo) se reusan constantemente entre distintos análisis del mismo proyecto.

**Lo que le falta a lo diseñado hasta ahora y que investigación sí necesita:**
- **Datasets como ciudadanos de primera clase.** Hoy pensamos el file explorer con `.mtex`, imágenes y `.py`. Estadística real implica `.csv`, `.parquet`, conexiones a bases de datos, o incluso descargas desde APIs. Esto no rompe el modelo (es solo otro tipo de archivo/input en el proyecto), pero sí implica pensar en inspección de datos: poder ver una tabla, no solo un valor escalar, como resultado materializado de un nodo.
- **Salidas más ricas que "una variable con un valor".** Un análisis estadístico no produce solo números — produce tablas de resultados (coeficientes, p-values, intervalos de confianza), matrices, dataframes enteros. El "nodo computado" del AST necesita poder materializar no solo escalares sino estructuras tabulares que después se puedan volcar a una tabla LaTeX bien formateada. Esto es más trabajo de diseño que "una integral da un número".
- **Exploración descartable vs. resultado final.** En investigación, el 90% de lo que ejecutás termina en la basura — no todo cómputo que hacés termina como parte del documento. Convendría distinguir entre "celda de trabajo/scratch" (vive en el proyecto pero no necesariamente en el flujo narrativo del `.mtex` final) y "variable que sí se referencia en el documento". Si mezclás todo el proceso exploratorio dentro del documento narrativo, el `.mtex` se ensucia con intentos fallidos.

**Contraargumento a tener en cuenta:** si Matex se estira demasiado hacia "entorno de investigación con datasets, notebooks exploratorios, etc.", empieza a competir directamente con Jupyter/Marimo/Observable en su propio terreno, donde ya son maduros. El diferencial de Matex no es "otro notebook" — es que el resultado final es un documento LaTeX bellamente estructurado semánticamente. Yo apuntaría a que Matex sea muy bueno en la *frontera* entre exploración y documento final (el momento en que decidís qué resultado de tu investigación "entra" al paper/informe), no necesariamente en reemplazar todo el ciclo de vida exploratorio de un notebook tradicional. Es perfectamente razonable —y probablemente más sano— que alguien explore en Jupyter/Marimo y solo traiga a Matex el código ya limpio que produce los resultados finales.

## 2. Matex para *reportes* que requieren ese tipo de cálculos (uso "productizado", no exploratorio)

Este caso es distinto y, creo, encaja todavía mejor con la filosofía core de Matex — de hecho es casi el caso de uso ideal:

- Pensá en un reporte financiero mensual, un informe de control de calidad con estadística de proceso, un dashboard científico recurrente. La estructura narrativa es **estable** (siempre tiene las mismas secciones, tablas, gráficos), pero los **datos y valores cambian cada vez que se genera**.
- Acá el modelo de "nodo generativo + valor materializado, todo con freeze y hash de procedencia" (secciones 1 y 3.3 del informe) no es solo útil, es *la* propuesta de valor: el reporte se vuelve literalmente **recompilable** — cambia el dataset de entrada, se re-resuelve el grafo, y el LaTeX se regenera con números nuevos pero la misma estructura semántica, con trazabilidad completa de qué código y qué datos produjeron cada cifra.
- Esto es un caso de uso con paralelo directo en herramientas como R Markdown / Quarto (que ya resuelven "documento + código + datos → reporte reproducible"), lo cual valida que la demanda existe, pero también te da competidores directos a mirar: vale la pena estudiar qué les falta o qué les molesta a los usuarios de Quarto, para posicionar a Matex mejor (probablemente: la parte "semántica e intencional" tipo Matex, con AST editable visualmente, es más rica que el modelo de Quarto que sigue siendo básicamente Markdown + chunks).

## Mi lectura general

No lo pensaría como "¿puede Matex servir también para esto?" sino como una señal de que el diseño de la capa ejecutable (grafo de dependencias + freeze + procedencia) es lo suficientemente general como para que estos casos de uso **caigan gratis** una vez que esté bien construido el núcleo — no necesitás features especiales de "modo estadística" o "modo investigación". Lo único que sí es una decisión de producto real es **cuánto querés estirarte hacia el extremo exploratorio** (notebooks, datasets grandes, scratch work) versus mantenerte más cerca del extremo "documento reproducible con cómputo bien acotado", que es donde el diferencial semántico de Matex brilla más y donde hay menos competencia directa.

Antes de decir "cómo ser superior", vale la pena ser honesto sobre qué es Colab realmente, porque si el punto de comparación está mal planteado, la estrategia también lo estará.

## Qué es Colab en el fondo (y por qué es difícil de vencer en su propio terreno)

Colab es, esencialmente, **un Jupyter notebook alojado por Google con cómputo gratis (incluyendo GPU/TPU)**. Su fortaleza no es de diseño conceptual — es de infraestructura y ecosistema: cómputo gratuito subsidiado por Google, acceso irrestricto a todo el ecosistema Python, integración con Drive, y una base de usuarios enorme ya acostumbrada al flujo de trabajo.

Ahí es honesto decir: **no vas a ganarle a Google en esa cancha**. Replicar GPUs gratis, escala de infraestructura y 15 años de ecosistema de paquetes no es una batalla que un producto nuevo deba pelear. Si Matex intenta ser "un Colab mejor", pierde por definición — es jugar el juego de otro con menos recursos.

## Dónde Colab es estructuralmente débil (y ahí es donde Matex puede ser categóricamente superior, no solo "un poco mejor")

Colab nunca fue diseñado para producir un **documento final de calidad publicable** — fue diseñado para explorar y ejecutar código. Eso tiene consecuencias muy concretas que Matex puede explotar:

**1. El artefacto de salida es de segunda clase**
Un notebook de Colab, exportado, da un PDF o HTML mediocre — sin numeración de teoremas, sin referencias cruzadas reales, sin bibliografía, sin control tipográfico. No es un accidente: Colab no tiene ningún concepto de "documento estructurado", solo celdas de texto/código en secuencia. Matex, en cambio, tiene esto como *núcleo* — el AST semántico e intencional es precisamente lo que Colab no tiene y no puede tener sin rediseñarse desde cero.

**2. Las celdas de markdown son texto opaco, no contenido semántico**
En Colab, un "teorema" es simplemente texto en una celda markdown — el sistema no sabe que es un teorema, no puede renumerarlo, no puede referenciarlo desde otro punto del documento, no puede cambiarle el estilo globalmente. Matex ya resuelve esto con su modelo de intención semántica. Esa es una ventaja categórica, no incremental.

**3. Reproducibilidad real, no solo "output visible"**
Ya lo discutimos: el modelo clásico de ejecución de celdas de Colab/Jupyter permite estado fantasma (una celda ejecutada fuera de orden deja un output que ya no corresponde al código actual, y nada te avisa). Si Matex nace con el modelo de grafo de dependencias (como Marimo) en vez del modelo secuencial clásico, tiene una ventaja de diseño que Colab estructuralmente no tiene por herencia histórica de Jupyter.

**4. Procedencia y auditabilidad como ciudadano de primera clase**
Esto es algo que ni Colab ni Marimo ni prácticamente nadie hace bien: que cada valor final en el documento lleve consigo, de forma nativa, el hash de qué código y qué inputs lo generaron. En un paper, una tesis o un reporte financiero, poder decir "este número específico fue producido exactamente por esta versión de este código con estos datos" es un valor real para integridad científica/auditoría — y hoy nadie te lo da gratis. Si lo horneás en el modelo de datos desde el día uno (no como feature agregada después), es difícil de igualar.

**5. El archivo como artefacto colaborable**
Un `.ipynb` es un blob JSON con outputs y metadata embebidos — es tristemente célebre por ser pésimo para diffs de git, revisiones de código, y colaboración real vía control de versiones. Si el `.mtex`/AST de Matex se serializa de forma legible y diff-friendly, ganás algo muy concreto y muy sentido por cualquiera que haya sufrido un merge conflict de un notebook.

**6. El puente "exploración visual → artefacto fijo"**
Ya lo hablamos con zoom/pan y freeze: Colab no tiene ningún concepto de "explorá interactivamente, después fijá esa vista al documento final". Un gráfico en Colab es lo que matplotlib dibujó, punto. Esa capacidad de fijar intencionalmente una vista dinámica al AST estático es algo que Colab ni siquiera intenta resolver.

## Cómo construir esta superioridad en la práctica (no solo en el argumento)

- **Diseñar el modelo de "valor materializado" con calidad tipográfica de publicación desde el inicio** — tablas con formato tipo `booktabs`, números con formato `siunitx`, no solo "lo que matplotlib/pandas tira por defecto en pantalla". Colab no invierte acá porque su target es pantalla, no papel impreso/PDF final.
- **Adoptar el modelo reactivo (DAG) desde el día uno**, no como refactor posterior — es mucho más caro migrar un modelo de ejecución después que diseñarlo bien desde el principio.
- **Hornear hash/procedencia en el tipo de dato de "variable computada"**, no como metadata opcional.
- **Priorizar que el formato de proyecto sea git-friendly** por diseño (texto plano estructurado, no blobs binarios/JSON con outputs mezclados).
- **No competir en cómputo pesado.** Aceptar que para entrenar modelos grandes o correr con GPU, la gente va a seguir usando Colab/Kaggle/lo que sea — y en vez de pelear eso, ofrecer un puente: importar resultados ya limpios desde un notebook externo (o incluso desde `.ipynb`) hacia Matex, en vez de intentar replicar todo el ciclo exploratorio pesado adentro. Sé complementario ahí, no sustituto.

## El posicionamiento honesto

Yo no lo plantearía como "Matex vs. Colab" en el mismo eje, porque no compiten por el mismo trabajo final. Colab es una **herramienta de cómputo con markdown como acompañamiento**. Matex, si se construye bien, es un **sistema de autoría de documentos semánticos con cómputo embebido como acompañamiento**. Son inversos. La superioridad no viene de hacer mejor lo que Colab hace — viene de que Colab, estructuralmente, nunca resolvió el problema que vos estás resolviendo, porque nunca fue su objetivo.

El riesgo real no es "que Colab te gane" — es que Matex se distraiga tratando de igualar a Colab en cómputo genérico y pierda el foco en lo único que nadie más está resolviendo bien: documento semánticamente rico + cómputo reproducible con procedencia + salida de calidad publicable.

¿Querés que arme esto como una sección de posicionamiento competitivo dentro del informe, o preferís que sigamos afinando el modelo técnico (por ejemplo, cómo serializar el `.mtex` para que sea realmente diff-friendly)?
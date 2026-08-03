# Informe: Extensión del AST de MateX con Nodos Ejecutables (Python y más allá)

## 0. La idea en una frase

Agregar al AST de MateX un tipo de nodo `exec` que puede correr código (empezando por Python) en tiempo de compilación (y opcionalmente en tiempo de edición/runtime en el editor web), cuyo **resultado tipado** se inyecta de vuelta como otro nodo semántico del propio AST (una expresión, una tabla, una serie de datos para graficar, una matriz, etc.), no como un blob de texto plano.

Esto convierte a MateX de "lenguaje de documentos matemáticos" a algo más cercano a **Quarto / R Markdown / Jupyter Book, pero con un modelo semántico propio y multi-target** en vez de apoyarse en Pandoc + LaTeX crudo.

---

## 1. Por qué es interesante (motivación)

### 1.1 El AST declarativo tiene un techo expresivo
El módulo de graficación del informe anterior, y en general la sintaxis semántica de MateX, cubre muy bien lo *declarable*: "esta es una función, marcá sus raíces, sombreá esta área". Pero hay cosas que son inherentemente **algorítmicas**, no declarables de forma simple:
- Un método numérico iterativo (Newton-Raphson, bisección, Runge-Kutta) donde el documento debe mostrar la tabla de iteraciones *reales*, no una tabla tipeada a mano que podría tener errores.
- Generación de datos (simulaciones, muestreo aleatorio, datasets reales) que no existen como "expresión matemática cerrada".
- Verificación: comprobar simbólicamente que el resultado que el documento afirma es efectivamente correcto (evitar que un error de tipeo en LaTeX se cuele en un libro de texto).

### 1.2 Correctness-by-construction
Hoy, en LaTeX (y en la mayoría de generadores de documentos matemáticos), el número o la tabla que aparece en el documento fue calculado por el autor **por fuera** del documento (a mano, en una calculadora, en un notebook aparte) y luego transcripto. Un nodo ejecutable elimina ese paso de transcripción: el documento **calcula lo que muestra**, y si el cálculo cambia (se corrige un dato, se cambia un parámetro), el documento se actualiza solo. Esto es exactamente el valor que aportan Jupyter/Quarto en ciencia de datos, pero aplicado a documentos matemáticos "tipográficos".

### 1.3 Encaja naturalmente con el modelo multi-target de MateX
Como MateX ya separa "intención" (AST) de "renderizado" (LaTeX / web / editor), un nodo de código es simplemente **otra fuente de contenido para el AST**, que se resuelve en una fase de compilación separada (ejecución) antes de la fase de renderizado por target. Es decir, no rompe la arquitectura: la agranda.

### 1.4 Cierra el círculo con el módulo de graficación
En el informe anterior aparecía la idea de "funciones definidas por datos" o "campos de pendientes de EDOs resueltas numéricamente". Sin un nodo ejecutable, esos datos tendrían que venir de "algún lado mágico". Con un nodo `exec` en Python (usando `numpy`/`scipy`), esos datos se generan *dentro* del propio documento, y se le pasan al módulo `plot2d` como una serie más.

---

## 2. Modelo de ejecución propuesto

### 2.1 Cuándo se ejecuta el código

| Momento | Descripción | Target típico |
|---|---|---|
| **Build-time (estático)** | El código corre una vez durante la compilación del documento; el resultado queda "congelado" y embebido en el AST resultante. | LaTeX/PDF, web estática |
| **Edit-time (interactivo, sandbox en servidor o WASM)** | El código corre cada vez que el autor edita el documento en el editor de MateX, dando feedback inmediato. | Editor web |
| **Runtime (interactivo, en el navegador del lector final)** | El código corre en el cliente del lector final, permitiendo recomputar resultados si hay sliders/inputs que dependen del código. | Editor web publicado / documento interactivo |

Para runtime en el navegador, la opción natural es **Pyodide** (Python compilado a WebAssembly), que permite correr `numpy`, `scipy` y `sympy` (con algo de fricción de tamaño de descarga) directamente en el cliente sin backend. Para build-time y edit-time, conviene un sandbox de servidor (contenedor aislado, sin red por defecto, con límites de tiempo/memoria).

### 2.2 Tipos de nodo (taxonomía)

- **`exec` (silencioso)**: ejecuta código y define estado (variables, funciones) para nodos posteriores, sin producir salida visible por sí mismo.
- **`eval` / evaluación inline**: como el "inline code" de R Markdown (`` `r x` ``); evalúa una expresión Python y sustituye el resultado dentro de una oración o fórmula del documento.
- **`code-block` visible**: muestra el código fuente *y* su salida (para material didáctico que enseña a programar junto con la matemática).
- **`figure-from-code`**: el código produce datos (arrays, puntos) que se pasan al módulo `plot2d` como una serie semántica más (no una imagen rasterizada de matplotlib, para mantener consistencia visual y multi-target).
- **`table-from-code`**: el código produce una tabla (por ejemplo, un DataFrame de pandas) que se renderiza como una tabla nativa de MateX.
- **`verify` / `assert` (sin salida visible)**: nodo de verificación pura — corre una comprobación simbólica o numérica y **rompe el build** si falla. Es quizás el nodo con mayor valor "silencioso": garantiza que las afirmaciones matemáticas del documento son ciertas.

### 2.3 Contrato de salida (protocolo `matex` para Python)

Para que la salida de Python no sea un string suelto sino algo que el AST entienda, conviene una pequeña librería Python que actúa de puente:

```python
import matex

x = matex.symbol("x")
f = x**2 - 3*x + 2

matex.emit_expr(f.diff(x))          # -> nodo de expresión matemática (vía sympy.latex)
matex.emit_table(df)                # -> nodo de tabla
matex.emit_series(xs, ys, role="primary")  # -> serie de datos para plot2d
matex.emit_value(42, label="resultado")     # -> valor inline
```

Cada `emit_*` mapea a un tipo de nodo ya existente en el AST de MateX (expresión, tabla, serie de plot, valor). Esto es clave: **el código no "dibuja" ni "escribe LaTeX" directamente**, sino que declara qué tipo de objeto semántico está produciendo, y el compilador de MateX se encarga de renderizarlo igual que renderizaría cualquier otro nodo nativo. Así se preserva la garantía de "un mismo AST, múltiples targets" también para contenido generado por código.

### 2.4 Estado y "kernels"

Al estilo Jupyter, conviene que los nodos `exec`/`eval` de una misma sección (o de todo el documento, configurable) compartan una sesión de intérprete con estado persistente, para poder hacer:

```matex
\begin{exec lang="python"}
import numpy as np
datos = np.random.default_rng(42).normal(size=100)
\end{exec}

La media muestral es \eval{np.mean(datos):.3f}.
```

Esto requiere decidir el *scope* del estado (documento completo / por sección / aislado por nodo) y garantizar **reproducibilidad**: mismo seed, mismas versiones de librerías, mismo resultado en cada build (algo similar al mecanismo de "freeze" de Quarto, que cachea resultados de ejecución por hash de código+dependencias para no re-ejecutar innecesariamente y para builds reproducibles).

---

## 3. Seguridad y sandboxing

Ejecutar código arbitrario dentro de un compilador de documentos es delicado, especialmente si MateX se ofrece como servicio web (el típico "pego mi .matex y lo compilo en la nube"):

- **Aislamiento**: contenedor o VM ligera (gVisor, Firecracker, o simplemente un contenedor Docker restringido) por compilación, sin acceso a red por defecto.
- **Límites de recursos**: tiempo de CPU, memoria, tamaño de salida, para evitar bombas fork o loops infinitos.
- **Sin acceso a filesystem del host** más que un directorio de trabajo efímero.
- **Acceso a red opcional y explícito** (para casos de uso como "traer un dataset de una API"), pero detrás de un flag que el usuario/administrador deba habilitar conscientemente.
- **Pyodide en el navegador** resuelve gran parte de esto "gratis" para el caso interactivo, porque el código corre en el sandbox del propio navegador del usuario, no en un servidor compartido.

---

## 4. Cómo se usaría en el editor: alternativas de diseño de interacción

Esta sección responde tres preguntas concretas: **cuándo/cómo se dispara el cálculo de un nuevo valor**, **dónde vive ese resultado** (temporal vs. persistido, y en qué lugar de la estructura del documento/UI), y **cómo lo consume el autor** desde el resto del documento.

### 4.1 Disparadores de (re)cálculo — alternativas

No hay un único modelo correcto; conviene pensar en un espectro y elegir un default razonable, dejando las otras como configuración por nodo o por documento:

| Alternativa | Cómo funciona | Ventajas | Riesgos |
|---|---|---|---|
| **A. Manual ("Run cell")** | El autor hace click en un botón ▶ sobre el nodo `exec` para ejecutarlo, al estilo Jupyter clásico. | Control total, predecible, no gasta cómputo de más. | El autor puede olvidarse de re-ejecutar tras editar código de más arriba → documento "desincronizado" temporalmente. |
| **B. Reactivo/debounced** | Al dejar de tipear ~500ms–1s dentro de un nodo `exec`, se re-ejecuta automáticamente (y en cascada, los nodos dependientes). | Feedback inmediato, se siente "vivo" (estilo Observable notebooks). | Puede ser costoso si el cálculo es pesado; hay que cancelar ejecuciones obsoletas (debounce + cancelación). |
| **C. On-save / on-build** | Solo se ejecuta al guardar el documento o al pedir explícitamente "compilar". | Predecible, barato, encaja bien con el modelo mental de LaTeX ("compilar el documento"). | Menos feedback inmediato durante la edición del código. |
| **D. Reactivo por dependencias (dataflow)** | Al estilo Observable/Excel: cada nodo declara de qué otros nodos depende (variables que lee), y solo se re-ejecutan los nodos afectados por un cambio, no todo el documento. | Eficiente, escalable a documentos grandes, evita reejecutar todo. | Requiere análisis de dependencias entre celdas (no trivial en Python arbitrario, aunque se puede aproximar con análisis estático de variables leídas/escritas). |
| **E. Explícito vía comando en lenguaje natural del editor** | El autor pide "recalculá esto" o edita un parámetro en un panel y el sistema decide qué re-ejecutar. | Bueno para usuarios no técnicos que interactúan con el editor de alto nivel (no directamente con código). | Menos control fino; requiere UI adicional para mapear "qué depende de qué" en términos entendibles. |

**Recomendación práctica**: usar **C (on-save/on-build)** como comportamiento por defecto para el compilador "real" (coherente con la mentalidad LaTeX y con reproducibilidad), pero ofrecer **B/D en el editor interactivo** como modo de "vista previa en vivo" —igual que Jupyter/Observable— sin que ese modo en vivo sea necesariamente lo que se usa para el build final. Es decir: *editar es reactivo, pero publicar/compilar es determinístico y explícito*.

### 4.2 Dónde vive el resultado (persistencia y alcance/contexto)

Hay varias capas posibles, y no son excluyentes — de hecho conviene combinarlas:

1. **En memoria del kernel de edición (efímero, no persistido)**: el estado vivo de variables Python mientras el autor edita — se pierde si cierra la pestaña o reinicia el kernel. Es el equivalente al estado de un notebook Jupyter abierto. Vive solo mientras dura la sesión de edición.

2. **Caché de resultados por hash (persistido, pero "descartable")**: cada nodo `exec`/`eval` se identifica por un hash de `(código fuente + versión de dependencias + inputs de nodos previos)`. El resultado se guarda en una caché (local en el navegador via IndexedDB, o en el backend) asociada a ese hash. Si el hash no cambió, no se re-ejecuta: se reusa el resultado cacheado. Esto es clave para que abrir el documento no dispare toda la cadena de ejecución de nuevo, y para que compilar a LaTeX sea rápido si nada cambió.

3. **Resultado "congelado" embebido en el AST guardado (persistido, autoritativo)**: cuando el autor hace un build formal (o explícitamente "congela" un nodo), el resultado calculado se guarda **dentro del propio documento** (el `.matex` serializado) como parte del nodo, marcado como `frozen: true` con metadata (timestamp, hash de código que lo generó, versión de librerías). Esto es lo que garantiza reproducibilidad al compilar a LaTeX/PDF sin depender de que haya un intérprete Python disponible en ese momento — el documento "ya sabe" su resultado, y solo se recalcula si el autor lo pide explícitamente o si detecta que el código cambió respecto al hash congelado (en cuyo caso debería marcarse visualmente como "desactualizado" hasta re-ejecutar).

4. **Historial de ejecuciones (opcional, para debugging/auditoría)**: guardar N ejecuciones previas (con su output) permite comparar "qué cambió" cuando el autor edita el código, similar a un historial de versiones de celda. Útil sobre todo en el caso de nodos `verify` que empiezan a fallar: poder ver "antes pasaba, ahora no" ayuda a diagnosticar.

**En términos de contexto/scope dentro del documento**: el resultado de un `exec` no vive "flotando" suelto, sino que queda asociado semánticamente a:
- **Su propio nodo** en el AST (como contenido embebido: `exec_node.output = {...}`).
- **El scope de kernel al que pertenece** (documento completo / sección / celda aislada — configurable, ver 2.4), que determina qué otras celdas pueden leer sus variables.
- **Los nodos que lo consumen "río abajo"** (un `\eval{...}` o un `emit_series` que alimenta un `plot2d`) — conviene que el AST guarde también ese enlace (qué nodo depende de qué salida), para poder invalidar en cascada cuando algo cambia.

### 4.3 Cómo lo usaría el autor, paso a paso (flujo típico en el editor)

Un flujo concreto, ilustrando las piezas anteriores:

1. El autor escribe un bloque `exec` con código Python en el editor (panel de texto/código con resaltado de sintaxis, como cualquier editor de código embebido — CodeMirror/Monaco).
2. Mientras tipea, el editor corre el modo **B (reactivo/debounced)**: apenas deja de escribir, se ejecuta en un sandbox (local vía Pyodide si es rápido/liviano, o llamada a un backend si necesita librerías pesadas no disponibles en WASM).
3. El resultado aparece **inline, justo debajo o al costado del bloque de código**, en un pequeño panel de "output de celda" (como en Jupyter/Colab): puede ser un número, una tabla renderizada, o un preview del gráfico que ese código está alimentando en `plot2d`.
4. Si el código tiene un error, el panel de output muestra el traceback ahí mismo, sin romper el resto del documento (el resto del AST sigue siendo válido; solo ese nodo queda en estado "error").
5. Cuando el autor está conforme, guarda el documento → esto dispara el modo **C**: se recalculan (o se reutilizan de caché si no cambió nada) todos los nodos `exec` del documento, y los resultados quedan **congelados** en el AST guardado (capa 3 de la sección 4.2).
6. Si el autor luego edita texto en otra parte del documento que *no* toca el código, al reabrir el documento **no hace falta reejecutar nada**: se leen los resultados ya congelados, y el documento se ve instantáneamente (importante para no depender de tener Python disponible solo para *leer* un documento ya compilado).
7. Si el autor cambia un parámetro (por ejemplo mueve un slider vinculado a una variable que un nodo `exec` usa), en el modo interactivo se dispara solo la re-ejecución de los nodos que dependen de esa variable (modo **D**), actualizando en vivo el gráfico o la tabla afectada, sin tocar el resto del documento.
8. Al exportar a LaTeX/PDF, el compilador toma directamente los resultados **congelados** del AST (no vuelve a ejecutar Python), garantizando que lo que se ve en el PDF es exactamente lo último que el autor validó — con la opción de forzar un "recompute all" antes de exportar si se quiere asegurar que todo esté al día.

### 4.4 Señalización visual del estado de un nodo (UX)

Para que el autor confíe en el sistema, conviene que cada nodo `exec`/`eval` tenga un estado visualmente explícito en el editor, similar a los indicadores de celda de Jupyter/Colab pero adaptado:

- ● **Actualizado**: el resultado mostrado corresponde al código actual (hash coincide).
- ◐ **Desactualizado**: el código cambió desde la última ejecución/congelado; se muestra el último resultado válido pero atenuado o con un badge "recalcular".
- ▶ **Ejecutando**: spinner mientras corre (con timeout visible si tarda demasiado).
- ⚠ **Error**: traceback visible, y el nodo no bloquea el resto del documento pero sí se marca claramente en cualquier vista previa/build.
- 🔒 **Congelado**: resultado fijado explícitamente por el autor (por ejemplo, para no depender de una fuente de datos externa inestable), no se recalcula aunque cambie el código hasta que se "descongele" a propósito.

---

## 5. Casos de uso, de simples a complejos

Para dimensionar el rango de valor de la feature, conviene separarlos por nivel de complejidad — desde un uso casi trivial hasta escenarios que empujan los límites del modelo de ejecución.

### 5.1 Nivel simple (una celda, sin dependencias externas, sin estado complejo)

1. **Calculadora inline**: `\eval{ (3 + 5) * 2 / 7 }` dentro de una oración, para no tener que calcular a mano un número que aparece en el texto.
2. **Redondeo/formato de un resultado exacto**: tomar una fracción o resultado de una cuenta anterior en el documento y mostrarlo con cierta cantidad de decimales, sin tipearlo a mano.
3. **Conversión de unidades**: `\eval{ km_a_millas(distancia) }` con una función chica definida una vez y reusada varias veces en el documento.
4. **Tabla de valores de una función** para completar a mano en un ejercicio (generar el enunciado con la tabla vacía, y la solución con la tabla completa vía código, en dos variantes del mismo documento).
5. **Verificación trivial de una igualdad numérica** puntual (`verify(2**10 == 1024)`), como chequeo de sanidad de un dato que se menciona en el texto.

### 5.2 Nivel intermedio (varias celdas relacionadas, algo de estado, uso de librerías estándar)

6. **Tabla de iteraciones de un método numérico** (Newton-Raphson, bisección) generada y mostrada completa, con el número de iteraciones necesario calculado dinámicamente según la tolerancia pedida.
7. **Verificación simbólica de una derivada/integral** que el documento afirma en el texto, comparando el resultado tipeado en LaTeX contra el resultado de `sympy`, marcando el documento como inconsistente si no coinciden.
8. **Generación de una familia de ejercicios con un seed fijo**: mismo enunciado estructural, coeficientes distintos por versión, con su solución calculada automáticamente — pensado para imprimir 4 variantes de un mismo examen.
9. **Estadística descriptiva de un dataset chico embebido** (una tabla de 30-50 filas escrita en el propio documento o pegada de un CSV): media, desvío, cuartiles, y un histograma alimentando `plot2d`.
10. **Resolución numérica de una EDO simple** (`scipy.integrate.solve_ivp`) y superposición de la curva solución sobre un campo de pendientes ya declarado con la sintaxis semántica del módulo de graficación.
11. **Simplificación/factorización automática** de una expresión larga que el autor no quiere simplificar a mano, mostrando el resultado como una expresión matemática nativa (no como texto de código).

### 5.3 Nivel complejo (múltiples celdas interdependientes, datos externos, interactividad real, o cómputo pesado)

12. **Documento "notebook" completo de un curso de métodos numéricos**: múltiples secciones, cada una con su propio kernel compartido, código visible + oculto, tablas y gráficos generados en cadena, y nodos `verify` cruzados que validan resultados de secciones anteriores.
13. **Simulación de Monte Carlo interactiva**: el lector mueve un slider (número de simulaciones, parámetro de una distribución) y el documento recalcula en vivo (vía Pyodide en el navegador) el histograma resultante y estadísticos asociados — requiere el modelo reactivo por dependencias (4.1-D) funcionando en el cliente final, no solo en el editor del autor.
14. **Importación de un dataset real desde una API o archivo externo** (con la fricción explícita de habilitar red en el sandbox), limpieza de datos con `pandas`, y generación de un reporte estadístico completo con múltiples gráficos vinculados — el documento funciona como un mini "paper" reproducible.
15. **Generador automático de exámenes con banco de ejercicios y verificación cruzada**: un nodo `exec` recorre una lista de "tipos de ejercicio" (cada uno con su propio generador y verificador), arma un examen completo con dificultad balanceada, resuelve cada ejercicio para generar la clave de corrección, y produce dos documentos (examen y solucionario) a partir del mismo AST con distintos flags de renderizado.
16. **Verificación de consistencia global de un libro de texto extenso**: al hacer build de un documento de cientos de páginas, se ejecutan todos los nodos `verify` distribuidos en distintos capítulos (cada uno posiblemente dependiendo de definiciones de capítulos anteriores vía el kernel compartido a nivel documento), y el build falla con un listado de qué afirmaciones matemáticas dejaron de ser válidas tras la última edición — útil como "test suite" de un libro.
17. **Visualizaciones algorítmicas pesadas** (fractales de alta resolución, autómatas celulares con muchas iteraciones, layouts de grafos grandes) donde el cómputo es demasiado pesado para correr en Pyodide en el navegador del lector, y por lo tanto se resuelve **siempre en build-time en servidor**, congelando el resultado como imagen/vector estático — un caso donde conviene que el propio nodo declare explícitamente su "modo de ejecución preferido" (`mode: build-only` vs `mode: interactive`) en vez de asumir que todo puede ser interactivo.
18. **Multi-lenguaje combinado** (a futuro): un nodo `exec lang="python"` que resuelve numéricamente y un nodo `exec lang="r"` o `julia` que hace un análisis estadístico específico sobre el mismo resultado, compartiendo datos a través del contrato de emisión común (`emit_table`, etc.) aunque corran en runtimes distintos — el caso límite que valida que el diseño del protocolo de salida haya sido efectivamente agnóstico al lenguaje desde el principio.

---

## 6. Por qué empezar por Python (y cómo generalizar después)

Python es la opción obvia para arrancar por el ecosistema ya maduro y estándar de facto en matemática/ciencia: `numpy`, `scipy`, `sympy` (álgebra computacional con salida a LaTeX ya integrada vía `sympy.latex()`), `pandas`, y la disponibilidad de **Pyodide** para correrlo también en el navegador sin backend. Esto cubre el 90% de los casos de uso del punto 4 con una sola integración.

Para generalizar a otros lenguajes sin rehacer la arquitectura, conviene diseñar el nodo `exec` con un atributo `lang` desde el día uno (`\begin{exec lang="python"}`) y definir el contrato de salida (`emit_expr`, `emit_table`, `emit_series`, `emit_value`) como una **interfaz**, no como algo específico de Python. Así, agregar R o Julia a futuro (candidatos naturales por su afinidad con cómputo científico) es "solo" implementar el mismo protocolo de emisión en esos lenguajes y un runtime de ejecución nuevo, sin tocar el AST ni los compiladores de destino.

---

## 7. Riesgos y decisiones de diseño pendientes

- **No-determinismo**: código con aleatoriedad, fecha/hora, o llamadas a red puede romper la reproducibilidad del documento entre builds; conviene forzar seeds explícitos y cachear resultados por defecto ("freeze").
- **Tiempo de build**: ejecutar código (especialmente con `scipy`/simulaciones) puede ser lento; un mecanismo de caché por hash de código+inputs es casi obligatorio para iterar rápido en el editor.
- **Versionado de dependencias**: el mismo documento debería dar el mismo resultado dentro de un año; hace falta algún mecanismo de lockfile de paquetes por documento.
- **Separación LaTeX vs. ejecución**: al compilar a PDF, la ejecución de Python no puede pasar "dentro" del propio proceso de `pdflatex`; tiene que ser una fase previa que produce un AST ya resuelto (con los resultados congelados) que luego se traduce a TikZ/pgfplots como cualquier otro nodo estático.
- **Nivel de confianza del contenido generado**: hay que decidir si el código y su salida se muestran siempre juntos (transparencia, bueno para material educativo de programación) o si por defecto el código queda oculto y solo se ve el resultado matemático (mejor para un documento "limpio" de matemática pura), con esto configurable por nodo.

---

## 8. Conclusión

Un nodo `exec` (empezando en Python) no es solo "una feature más": es lo que le permite a MateX pasar de ser un generador de documentos matemáticos *estáticos y declarativos* a un sistema donde el documento **computa lo que afirma**, cerrando la brecha entre "escribir matemática" y "hacer matemática". El punto de diseño más importante no es la ejecución en sí (eso es un problema resuelto: sandboxing + Pyodide), sino el **contrato de salida tipado** (`emit_expr`, `emit_table`, `emit_series`, `emit_value`) que permite que el resultado del código se integre al AST como un ciudadano de primera clase, y no como una imagen o un bloque de texto opaco — preservando exactamente la propiedad que hace valioso a MateX: un único AST semántico, muchos destinos de compilación.

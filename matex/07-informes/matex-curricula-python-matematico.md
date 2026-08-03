# Currícula: Aprender Python a través de la Matemática (sobre MateX)

## 0. Idea central

Usar el propio documento MateX (con sus nodos `exec`/`eval`/`verify`/`plot2d` del informe anterior) como el **medio de enseñanza en sí mismo**, no como un anexo. Cada lección es un documento MateX ejecutable donde:

- El **texto** explica un concepto matemático.
- El **código Python** de esa lección introduce *un* concepto nuevo de programación, aplicado directamente a ese concepto matemático (nunca "aprender Python en abstracto" — siempre con una excusa matemática interesante).
- Un nodo `verify` autocalifica el ejercicio del alumno en el momento (feedback inmediato, sin backend de corrección aparte).
- Cuando aplica, un nodo `figure-from-code` conecta el resultado con el módulo `plot2d`, para que el alumno *vea* lo que su código produjo, no solo lea un número.

Esto le da a MateX una segunda propuesta de valor además de "escribir documentos matemáticos": **enseñar a programar usando la matemática como dominio de aplicación**, en la línea de Project Euler, Matplotlib+Jupyter en cursos de cálculo numérico, o "Python for the mathematically inclined" — pero con corrección automática embebida y salida tipográfica de calidad.

---

## 1. Principios de diseño de la currícula

1. **Un concepto de Python por lección, nunca dos.** Cada lección introduce exactamente un elemento nuevo del lenguaje (un `for`, una función, una estructura de datos). El concepto matemático puede ser nuevo o puede ser un refuerzo de algo ya visto — lo nuevo casi siempre es la herramienta de programación, no la matemática, para no sobrecargar cognitivamente.
2. **La matemática motiva la sintaxis, no al revés.** No se enseña "así se escribe un `for`" en abstracto; se enseña "quiero sumar los primeros N términos de una serie, y por eso necesito repetir una operación" y el `for` aparece como la herramienta natural para eso.
3. **Todo ejercicio se autocalifica.** Cada lección termina con un mini-ejercicio que el alumno completa en una celda `exec`, y un nodo `verify` oculto (o parcialmente visible) que compara el resultado contra el esperado, dando feedback inmediato (✅/❌ + pista) sin depender de un profesor mirando el código.
4. **Progresión en espiral, no lineal.** Ciertos temas matemáticos (funciones, sucesiones, ecuaciones) se revisitan varias veces a lo largo de la currícula, cada vez con una herramienta de Python más potente (primero con `for`, después con `numpy`, después con `sympy`), reforzando tanto la matemática como mostrando *por qué* existen herramientas más avanzadas.
5. **Cada módulo termina en un "proyecto visual"**: una lección de cierre que no enseña sintaxis nueva, sino que integra todo lo del módulo en algo vistoso (un fractal, una animación, una simulación), aprovechando `plot2d` — la recompensa visual como motivador de cierre de módulo.
6. **El código siempre produce algo matemáticamente real**, nunca un ejemplo de juguete desconectado ("imprimir hola mundo" se reemplaza directamente por "imprimir la tabla de multiplicar" o similar) — cada primera línea de código que ve un alumno ya es matemática.

---

## 2. Anatomía de una lección tipo

```matex
\begin{lesson id="L07" python_concept="for + acumulador" math_concept="sumas parciales de series"}

## Motivación matemática
[Texto: qué es una serie, ejemplo de la serie armónica, por qué "sumar infinitos términos"
 tiene sentido preguntarse cuánto da una suma parcial.]

## Concepto de Python nuevo
[Texto breve: qué es un bucle `for`, qué es un acumulador, con un ejemplo mínimo
 no matemático primero (analogía) y luego el caso real.]

\begin{exec lang="python" visible="true"}
suma = 0
for n in range(1, 11):
    suma += 1 / n**2
\end{exec}

La suma de los primeros 10 términos de \(\sum 1/n^2\) es \eval{suma:.5f},
que se acerca a \(\pi^2/6 \approx\) \eval{math.pi**2/6:.5f}.

\begin{plot-from-code}
  # el propio código genera la serie de sumas parciales y se grafica
  # con plot2d como puntos discretos, mostrando la convergencia
\end{plot-from-code}

## Ejercicio para el alumno
Completá el código para calcular la suma de los primeros 20 términos de
\(\sum (-1)^{n+1}/n\) (serie armónica alternada) y guardala en la variable `resultado`.

\begin{exec lang="python" editable="true" id="ejercicio_L07"}
# tu código acá
resultado = ...
\end{exec}

\begin{verify hidden="true"}
assert abs(resultado - 0.6687714032) < 1e-6, \
    "Revisá el signo alternado (-1)**(n+1) y el rango del for"
\end{verify}

\end{lesson}
```

Esta estructura (motivación → concepto → ejemplo resuelto → visualización → ejercicio → verificación oculta) es el molde que se repite en las ~40 lecciones propuestas más abajo.

---

## 3. Mapa general de la currícula (módulos)

| Módulo | Eje de Python | Eje matemático | Proyecto de cierre visual |
|---|---|---|---|
| 0. Arranque | variables, tipos, operadores, `print`/salida | aritmética, orden de operaciones, fracciones, notación científica | Calculadora de expresiones con formato bonito |
| 1. Decisiones | `if` / `elif` / `else`, booleanos | clasificación de números (par/impar, primo, signo), inecuaciones | Clasificador visual de números 1–100 (criba coloreada) |
| 2. Repetición | `for`, `while`, acumuladores | sucesiones, sumatorias, aproximación de constantes | Convergencia de series (animación) |
| 3. Funciones propias | `def`, parámetros, `return` | funciones matemáticas, composición, dominio | Explorador de composición de funciones |
| 4. Listas y datos | listas, indexado, comprensión de listas | vectores, tablas de valores, sucesiones como listas | Graficador casero de puntos (antes de usar `plot2d`) |
| 5. NumPy | arrays, operaciones vectorizadas | vectores, operaciones elemento a elemento, normas | Suma de vectores y visualización geométrica |
| 6. Gráficos desde código | integración con `plot2d` (emit_series) | familias de funciones, transformaciones (traslación, escala) | Animación de familia de funciones con slider |
| 7. Recursión | funciones recursivas, caso base | factorial, Fibonacci, definiciones recursivas | Fractales (árbol, copo de Koch, Sierpinski) |
| 8. Diccionarios y conjuntos | `dict`, `set`, conteo | combinatoria básica, conjuntos matemáticos, MCD/MCM | Diagrama de Venn interactivo |
| 9. SymPy I | librería externa, objetos simbólicos | simplificación, resolución simbólica de ecuaciones | Resolvedor de ecuaciones paso a paso |
| 10. SymPy II | encadenar métodos, `.diff()`, `.integrate()` | derivadas, integrales, recta tangente | Explorador de f, f', f'' superpuestas |
| 11. Métodos numéricos | `while` con condición de corte, tolerancia | Newton-Raphson, bisección, error numérico | Animación de convergencia de Newton-Raphson |
| 12. Probabilidad | módulo `random`, simulación | experimentos aleatorios, ley de grandes números | Simulación de Monte Carlo para \(\pi\) |
| 13. Álgebra lineal | matrices con NumPy, `@` (producto matricial) | transformaciones lineales, rotaciones, sistemas de ecuaciones | Visualizador de transformaciones lineales sobre una figura |
| 14. Proyecto integrador | todo lo anterior combinado | elección del alumno (o EDOs, o teoría de números, o estadística) | Mini "paper" reproducible del alumno |

---

## 4. Detalle lección por lección (ejemplo de un módulo completo: Módulo 2 — Repetición)

Para mostrar el nivel de granularidad esperado, se detalla completo el Módulo 2 (el resto sigue el mismo patrón, resumido en tablas en la sección 5):

| Lección | Concepto Python | Concepto matemático | Código ilustrativo |
|---|---|---|---|
| L2.1 | `for` sobre `range` | tabla de multiplicar / sucesión aritmética | Generar e imprimir los primeros 12 términos de \(a_n = 3n+1\) |
| L2.2 | acumulador dentro de un `for` | sumatoria \(\sum_{n=1}^{N} n\) y su fórmula cerrada | Comparar suma calculada vs. fórmula \(N(N+1)/2\) con un `verify` |
| L2.3 | `for` con condición (`if` adentro) | número de divisores, primalidad ingenua | Determinar si un número es primo probando divisores |
| L2.4 | `while` con condición de corte | aproximación iterativa (método babilónico de raíz cuadrada) | Aproximar \(\sqrt{2}\) hasta una tolerancia dada |
| L2.5 | `while` + contador de iteraciones | conjetura de Collatz | Calcular cuántos pasos tarda un número en llegar a 1 |
| L2.6 (cierre) | combinar `for`/`while`, sin sintaxis nueva | convergencia de series (\(\sum 1/n^2\), \(\sum (-1)^{n}/n\)) | Graficar la sucesión de sumas parciales con `plot2d`, mostrando visualmente la convergencia |

Este patrón — 4 a 6 lecciones "de concepto" seguidas de 1 lección "de cierre visual sin sintaxis nueva" — se repite en todos los módulos.

---

## 5. Resto de los módulos (resumen lección por lección)

### Módulo 3 — Funciones propias
- L3.1 `def` sin parámetros → constantes matemáticas con nombre (funciones que devuelven \(\pi\), \(\varphi\) con más precisión que las built-in).
- L3.2 `def` con parámetros → definir \(f(x) = x^2 - 3x + 2\) como función Python real, evaluarla en varios puntos.
- L3.3 `return` de múltiples valores (tuplas) → devolver raíces de una cuadrática (ambas, cuando existen).
- L3.4 parámetros con valor por defecto → función de interés compuesto con tasa/período configurable.
- L3.5 (cierre) composición de funciones `f(g(x))` → explorar visualmente cómo cambia la gráfica al componer, conectando con `plot2d`.

### Módulo 4 — Listas y datos
- L4.1 listas literales, indexado → guardar y acceder a los términos de una sucesión ya calculada.
- L4.2 `len()`, slicing → tomar "los primeros 5 términos" o "cada 2 términos" de una sucesión.
- L4.3 comprensión de listas → generar tabla de valores `[f(x) for x in valores]` de forma compacta.
- L4.4 `zip` de dos listas → pares \((x_i, y_i)\) para graficar, introduciendo la idea de "puntos" antes de usar NumPy.
- L4.5 (cierre) graficador casero con Unicode/ASCII antes de introducir `plot2d` "de verdad" → valora entender qué hace el módulo de gráficos por debajo.

### Módulo 5 — NumPy
- L5.1 `np.array`, operaciones vectorizadas vs. loops → comparar sumar dos vectores "a mano" vs. con NumPy.
- L5.2 `np.linspace`/`np.arange` → generar dominios de muestreo para graficar funciones (conecta con cómo `plot2d` samplea por debajo).
- L5.3 operaciones elemento a elemento → evaluar una función sobre un array completo de una vez.
- L5.4 norma de un vector, producto punto → distancia entre puntos, ángulo entre vectores.
- L5.5 (cierre) suma geométrica de vectores → dibujar vectores como flechas sobre `plot2d`.

### Módulo 6 — Gráficos desde código
- L6.1 `matex.emit_series` → primera vez que el código del alumno "dibuja" usando el protocolo de emisión, no un truco casero.
- L6.2 graficar varias funciones relacionadas (familia \(f(x) = a\sin(x)\) para varios `a`) con un `for` que emite varias series.
- L6.3 transformaciones: graficar \(f(x)\), \(f(x)+k\), \(f(x-k)\) lado a lado, generadas por código en vez de tipeadas tres veces.
- L6.4 (cierre) animación: un slider vinculado a un parámetro dispara la re-ejecución (conecta directo con el modelo reactivo de la sección de interactividad del informe anterior).

### Módulo 7 — Recursión
- L7.1 caso base + llamada recursiva → factorial.
- L7.2 recursión con dos llamadas → Fibonacci ingenuo, y de paso una primera mención (sin implementarla aún) de por qué es lento.
- L7.3 memoización con `dict` → Fibonacci rápido, uniendo con el módulo 8 que viene.
- L7.4 recursión geométrica → construir recursivamente los puntos de una curva de Koch o un árbol fractal.
- L7.5 (cierre) fractal completo renderizado con `plot2d` a partir de las coordenadas generadas recursivamente.

### Módulo 8 — Diccionarios y conjuntos
- L8.1 `dict` para contar frecuencias → dígitos de \(\pi\), ¿qué dígito aparece más en los primeros 1000?
- L8.2 `set` y operaciones de conjuntos → unión/intersección visualizada como diagrama de Venn.
- L8.3 MCD/MCM con `math.gcd` y un `set` de divisores comunes.
- L8.4 (cierre) criba de Eratóstenes con un `set`/lista de booleanos, visualizando los primos hasta N coloreados en una grilla.

### Módulo 9 — SymPy I (álgebra simbólica)
- L9.1 `sympy.symbols`, expresiones simbólicas vs. numéricas → la diferencia entre "calcular" y "manipular símbolos".
- L9.2 `.simplify()`, `.expand()`, `.factor()` → simplificar expresiones que el alumno mismo escribió mal a propósito.
- L9.3 `sympy.solve` → resolver ecuaciones y sistemas, comparando contra la resolución manual del alumno (con `verify`).
- L9.4 (cierre) resolver y mostrar los pasos de una ecuación cuadrática con la fórmula general, verificando simbólicamente que el discriminante determina el número de soluciones.

### Módulo 10 — SymPy II (cálculo)
- L10.1 `.diff()` → derivada de una función, comparar con la derivada "a mano" del alumno.
- L10.2 recta tangente en un punto (usando la derivada simbólica) superpuesta en `plot2d`.
- L10.3 `.integrate()` definida vs. indefinida → área bajo la curva, conectando con el nodo de área sombreada del módulo de graficación.
- L10.4 `.limit()` → asíntotas, introducidas como límite en infinito o en un punto de discontinuidad.
- L10.5 (cierre) graficar \(f\), \(f'\), \(f''\) simultáneamente con roles semánticos distintos (`primary`/`derivative`).

### Módulo 11 — Métodos numéricos
- L11.1 bisección con `while` y tolerancia → primera raíz aproximada de una función sin solución cerrada.
- L11.2 Newton-Raphson, usando la derivada simbólica del módulo 10 para el paso iterativo → cruce explícito entre SymPy y métodos numéricos.
- L11.3 tabla de iteraciones (usando listas del módulo 4) mostrando cómo decrece el error en cada paso.
- L11.4 (cierre) animación de convergencia de Newton-Raphson sobre la gráfica de la función (cada iteración como un frame).

### Módulo 12 — Probabilidad
- L12.1 `random.random()`/`random.randint` → simular una moneda, un dado.
- L12.2 repetir un experimento N veces con un `for` → frecuencia relativa vs. probabilidad teórica.
- L12.3 ley de grandes números → graficar cómo la frecuencia relativa converge a medida que crece N.
- L12.4 (cierre) estimación de \(\pi\) por Monte Carlo (puntos dentro/fuera de un círculo), con `plot2d` mostrando los puntos coloreados según si cayeron dentro o fuera.

### Módulo 13 — Álgebra lineal
- L13.1 matrices como `np.array` 2D, indexado por fila/columna.
- L13.2 producto matricial `@` → aplicar una transformación lineal a un conjunto de puntos.
- L13.3 matrices de rotación/escala/reflexión → transformar una figura (por ejemplo, un triángulo) y graficar antes/después.
- L13.4 resolver sistemas de ecuaciones lineales con `np.linalg.solve` → conectar con la resolución simbólica del módulo 9, comparando enfoque numérico vs. simbólico.
- L13.5 (cierre) visualizador interactivo: un slider controla el ángulo de rotación aplicado a una figura, recalculando en vivo.

### Módulo 14 — Proyecto integrador
- Lección abierta (sin nueva sintaxis): el alumno elige un tema (EDOs con `scipy`, teoría de números, estadística de un dataset propio, generación de fractales propios) y arma un documento MateX completo — texto + código + verificación + gráfico — que funciona como su propio "mini paper" reproducible, usando todo lo aprendido en los 14 módulos.

---

## 6. Cómo se aprovecha específicamente la plataforma MateX (y no solo "un notebook más")

- **Corrección automática embebida** (nodos `verify` ocultos): a diferencia de un notebook de Jupyter suelto, cada ejercicio se autocalifica al momento, sin necesidad de un profesor revisando código a mano — viable para currícula autoguiada o para escalar a muchos alumnos.
- **El resultado matemático se ve tipografiado como matemática de verdad** (vía `emit_expr`/`sympy.latex()`), no como texto de consola — refuerza la idea de que "el código y la matemática son la misma cosa vista desde dos ángulos", que es exactamente el mensaje pedagógico que se busca transmitir.
- **Multi-target gratis**: la misma lección compila a una guía imprimible en PDF (para quien quiera estudiar sin conexión, con el código y su output ya congelados) y a una versión interactiva en el editor web (para quien quiera tocar el código en vivo) — sin mantener dos materiales separados.
- **Progresión visible entre módulos reutilizando `plot2d`**: como el módulo de graficación ya existe como pieza semántica separada, las lecciones de Python no tienen que "enseñar a graficar" desde cero (evitando la fricción típica de introducir `matplotlib` en un curso que ya tiene bastante carga cognitiva) — el alumno usa `emit_series`/`plot-from-code` y el resultado ya se ve prolijo, con el foco puesto en el concepto matemático/de programación, no en pelear con la librería gráfica.
- **Historial de intentos por ejercicio** (mencionado en el informe de nodos ejecutables): permite mostrarle al alumno "tus últimos 3 intentos" para ese ejercicio, útil como feedback formativo sin exponer la solución.

---

## 7. Extensiones posibles a futuro

- **Rutas alternativas** dentro de la misma currícula según el interés del alumno (rama hacia probabilidad/estadística vs. rama hacia cálculo vs. rama hacia álgebra lineal) a partir de un tronco común (módulos 0–5).
- **Nivelación automática**: un nodo `verify` que además de aprobar/reprobar, mide tiempo/intentos y sugiere reforzar un módulo anterior si el patrón de errores lo indica.
- **Modo "código oculto, solo resultado"** para currículas más orientadas a la matemática que a la programación (mostrar el gráfico/resultado, con el código colapsado y expandible para quien quiera mirarlo), reutilizando el flag `visible` de los nodos `exec` ya propuesto en el informe anterior.
- **Generación automática de variantes de ejercicio** (usando la propia capacidad de nodos ejecutables) para que cada alumno tenga números distintos en el mismo ejercicio, dificultando copiarse la respuesta entre compañeros.

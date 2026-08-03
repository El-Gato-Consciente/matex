# Cartografía Semántica de la Visualización en LaTeX
## Un mapa por intención comunicativa, no por paquete

*Informe técnico — versión 2.0 (reestructuración semántica) — Julio 2026*

---

## 0. Por qué reordenar el informe original

El informe "Más Allá de los Ejes Cartesianos" clasifica los gráficos **según qué motor los dibuja**: pgfplots aquí, TikZ allá, chemfig para moléculas, tikz-feynman para física de partículas. Es una clasificación válida y útil como *referencia de implementación*, pero tiene un problema de fondo: agrupa bajo un mismo paraguas cosas que responden preguntas completamente distintas, y separa cosas que responden la misma pregunta solo porque se dibujan con paquetes diferentes.

Ejemplo concreto del documento original: mete "Árboles Sintácticos" y "Grafos y Redes Complejas" en la misma categoría ("Estructuras Jerárquicas, Árboles y Grafos") solo porque ambos son "nodos con líneas". Pero semánticamente son casi opuestos:

- Un **árbol** responde: *¿qué contiene a qué? ¿quién depende de quién?* (hay una raíz, hay dirección, no hay ciclos).
- Un **grafo general** responde: *¿quién se conecta con quién?* (no hay jerarquía necesaria, puede haber ciclos, la "importancia" es distribuida, no heredada).

Esa diferencia importa mucho más para decidir qué dibujar que el hecho de que ambos usen TikZ por debajo.

Este informe propone entonces una taxonomía organizada por **la pregunta que el gráfico contesta**, no por el paquete que lo renderiza. La información de "carpintería" (qué paquete usar) se conserva, pero como nota lateral — es información de implementación, no de intención.

---

## 1. Marco conceptual: la pregunta antes que la herramienta

Todo gráfico —estadístico, matemático o técnico— existe para responder implícitamente una de un puñado de preguntas fundamentales. Proponemos diez familias semánticas, agrupadas en tres grandes dominios:

| Dominio | Qué caracteriza a estas preguntas |
|---|---|
| **A. Cuantitativo** | Preguntas sobre magnitudes, partes, dispersión y covariación de datos |
| **B. Estructural / lógico** | Preguntas sobre orden, contención, conexión y equivalencia entre entidades (sin magnitud numérica) |
| **C. Representación de sistemas reales especializados** | Preguntas sobre cómo notar fielmente un sistema físico, químico o de ingeniería con simbología estandarizada |

---

## 2. Las diez familias semánticas

### Dominio A — Cuantitativo

#### A1. Comparación
**Pregunta que responde:** ¿cuál es mayor, cuál es menor?
Compara magnitudes discretas entre categorías. Es la familia más transversal de todas: economía, ciencia, ingeniería, informes ejecutivos.
- *Formas típicas:* barras, columnas (simples, agrupadas)
- *Nota de carpintería:* `pgfplots` con `\addplot coordinates` sobre `ybar`; curva de aprendizaje media.

#### A2. Composición
**Pregunta que responde:** ¿cómo se reparte un todo entre sus partes?
A diferencia de la comparación pura, aquí el 100% importa: la lectura correcta exige ver la parte *en relación al total*, no solo una parte contra otra.
- *Formas típicas:* sectores (pie/donut), barras apiladas, treemaps
- *Nota de carpintería:* `pgf-pie`, o `ybar stacked` en `pgfplots`. Ojo: el pie chart es el ejemplo clásico de gráfico sobreusado — funciona bien con 2-4 categorías, se degrada rápido con más.

#### A3. Distribución
**Pregunta que responde:** ¿cómo se dispersan mis datos? ¿dónde está la mediana, dónde los atípicos, cuál es la forma de la nube de valores?
Aquí el foco no es comparar categorías sino entender la variabilidad interna de *una* variable (o comparar esa variabilidad entre grupos).
- *Formas típicas:* histogramas, boxplots (caja y bigotes), violin plots
- *Nota de carpintería:* soporte nativo en `pgfplots` (`\addplot+[boxplot]`); histogramas vía `hist` en `pgfplots`.

#### A4. Relación / covariación
**Pregunta que responde:** ¿cómo varía una cosa cuando varía la otra?
Curiosamente, el informe original casi no la menciona pese a ser una de las cuatro preguntas cuantitativas fundamentales (siguiendo el marco clásico de Abela, *Comparison / Composition / Distribution / Relationship*). Es el terreno de la correlación.
- *Formas típicas:* scatter plots, bubble charts
- *Nota de carpintería:* `\addplot[only marks]` en `pgfplots`; para burbujas, `scatter/@pre marker code` variando el tamaño del marcador.

---

### Dominio B — Estructural / lógico (sin magnitud numérica)

#### B1. Secuencia y flujo lógico
**Pregunta que responde:** ¿qué pasa primero, qué pasa después, bajo qué condición se bifurca el camino?
No hay cantidades: hay pasos, decisiones y orden temporal-lógico.
- *Formas típicas:* diagramas de flujo (flowcharts), diagramas de bloques
- *Nota de carpintería:* librería `shapes.geometric` de TikZ, con `\draw[->]` para las flechas direccionales.

#### B2. Jerarquía y contención
**Pregunta que responde:** ¿qué contiene a qué? ¿quién es padre/hijo de quién?
Hay una raíz, hay dirección única (de lo general a lo particular), no hay ciclos. Es la familia que el informe original confundía con las redes.
- *Formas típicas:* árboles sintácticos, árboles de decisión, organigramas
- *Nota de carpintería:* `forest` o `tikz-qtree` — ambos optimizan automáticamente el espaciado para que el árbol no se vea desbalanceado.

#### B3. Conexión y red
**Pregunta que responde:** ¿quién se conecta con quién, sin que necesariamente haya una jerarquía?
Puede haber ciclos, la "importancia" de un nodo es emergente (grado de conexión, centralidad), no heredada de un padre.
- *Formas típicas:* grafos de redes sociales, topologías de red, redes neuronales artificiales
- *Nota de carpintería:* TikZ + `graphdrawing` (requiere LuaLaTeX) para posicionamiento automático de nodos; redes neuronales suelen dibujarse "a mano" con bucles `\foreach`.

#### B4. Equivalencia y estructura abstracta
**Pregunta que responde:** ¿qué caminos distintos llevan al mismo resultado? ¿qué transformaciones conmutan?
Es el terreno de la teoría de categorías y el álgebra abstracta: los nodos son objetos matemáticos, las flechas son morfismos, y lo interesante no es la cantidad ni la jerarquía sino la *equivalencia estructural* entre trayectos.
- *Formas típicas:* diagramas conmutativos, diagramas de quiver
- *Nota de carpintería:* `tikz-cd`, el estándar de facto — sintaxis tipo matriz, muy legible una vez aprendida.

#### B5. Temporalidad y evolución de proyectos
**Pregunta que responde:** ¿cuándo ocurre cada cosa, y cómo se relacionan los plazos entre tareas o hitos?
Distinguimos aquí dos matices que el informe original trataba como una sola familia:
- **Gantt**: responde "¿qué recursos/tareas se solapan en el tiempo y de qué dependen?" — es planificación.
- **Timeline**: responde "¿en qué orden ocurrieron los eventos?" — es narrativa histórica, sin foco en dependencias.
- *Nota de carpintería:* `pgfgantt` para lo primero; TikZ a medida o `chronos` para lo segundo.

---

### Dominio C — Representación fiel de sistemas físicos especializados

#### C1. Isomorfismo simbólico de dominio
**Pregunta que responde:** ¿cómo represento, con notación estandarizada por una disciplina, un sistema físico o formal real?
Esta es la familia más distinta de todas las anteriores: no se trata de "elegir la mejor forma de mostrar una relación abstracta", sino de **seguir una notación ya fijada por convención internacional** (IEEE/IEC para circuitos, notación química estándar, reglas de Feynman para QFT). Aquí la libertad de diseño es casi nula — el gráfico *es* el estándar.
- *Formas típicas:* esquemas de circuitos, estructuras químicas moleculares, diagramas de Feynman
- *Nota de carpintería:* `circuitikz` (biblioteca masiva de componentes IEEE/IEC), `chemfig` (enlaces, anillos aromáticos), `tikz-feynman` (vértices y propagadores).

---

## 3. Tabla-mapa: de la pregunta a la herramienta

| Pregunta semántica | Familia | Ejemplos | Paquete típico (nota) |
|---|---|---|---|
| ¿Cuál es mayor? | A1 Comparación | Barras, columnas | `pgfplots` |
| ¿Cómo se reparte el total? | A2 Composición | Pie, apiladas, treemap | `pgf-pie` |
| ¿Cómo se dispersan los datos? | A3 Distribución | Histograma, boxplot | `pgfplots` |
| ¿Cómo covarían dos variables? | A4 Relación | Scatter, bubble | `pgfplots` |
| ¿Qué pasa después? | B1 Secuencia | Flowchart, bloques | TikZ (`shapes.geometric`) |
| ¿Quién contiene a quién? | B2 Jerarquía | Árboles, organigramas | `forest`, `tikz-qtree` |
| ¿Quién se conecta con quién? | B3 Red | Grafos, redes neuronales | TikZ + `graphdrawing` |
| ¿Qué caminos son equivalentes? | B4 Equivalencia abstracta | Diagramas conmutativos | `tikz-cd` |
| ¿Cuándo y con qué dependencias? | B5 Temporalidad | Gantt, timelines | `pgfgantt` |
| ¿Cómo notar un sistema físico real? | C1 Isomorfismo de dominio | Circuitos, moléculas, Feynman | `circuitikz`, `chemfig`, `tikz-feynman` |

---

## 4. Casos límite: cuando una forma sirve a más de una pregunta

Vale la pena señalar que algunas formas gráficas **cambian de familia según cómo se usen** — la forma no determina la intención, la intención determina qué forma conviene:

- Un **treemap** es composición (A2) *y* jerarquía (B2) a la vez: reparte un todo en partes, pero esas partes están anidadas jerárquicamente. Es un híbrido genuino.
- Una **barra apilada** es comparación (A1) si el foco está en comparar el total entre categorías, pero es composición (A2) si el foco está en ver qué proporción ocupa cada segmento dentro de cada barra. Mismo dibujo, dos preguntas distintas según qué eje mira el lector primero.
- Un **árbol de decisión** puede leerse como jerarquía (B2, "qué contiene a qué") o como secuencia lógica (B1, "qué pasa si la condición es verdadera") — en la práctica casi siempre se usa para lo segundo, aunque su forma sea de árbol.

Esto sugiere una regla práctica: antes de elegir un tipo de gráfico, conviene completar la frase *"quiero que quien lo mire entienda..."* — la respuesta a esa frase, no el catálogo de formas disponibles, es lo que debería guiar la elección.

---

## 5. Conclusión

El informe original documenta con precisión el ecosistema de paquetes de LaTeX para visualización no cartesiana — esa parte se mantiene íntegramente válida como referencia técnica. Lo que este reordenamiento aporta es una capa previa: antes de preguntar *"¿qué paquete uso?"*, conviene preguntar *"¿qué pregunta le estoy haciendo a estos datos o conceptos?"*. Esa pregunta tiene solo diez respuestas posibles (según el marco aquí propuesto), y una vez identificada, la elección de paquete en LaTeX se vuelve casi mecánica — que es, en definitiva, donde el informe original brilla.

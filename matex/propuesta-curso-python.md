# Propuesta: Curso de Python orientado a matemática

> Insumo: [`nodos-ejecutables-propuesta.md`](nodos-ejecutables-propuesta.md), [`niveles-de-ambicion.md`](niveles-de-ambicion.md),
> [`vision-y-alcance.md`](vision-y-alcance.md), `CLAUDE.md`. Currícula del curso de Python como **árbol de
> prerrequisitos**, no como niveles secuenciales — así se puede seguir agregando contenido (para
> matemáticos y para científicos de la computación) sin renumerar nada, con IDs estables al estilo
> `matex/06-backlog/backlog.md`.

## 0. Tesis

**El curso no depende de que exista el Nivel 2 de nodos ejecutables en Matex.** Vale por sí solo, como
laboratorio, igual que el Nivel A de la plataforma vale sin B ni C.

**Por qué árbol y no niveles.** Una secuencia 0→1→2→…→8 obliga a decidir de antemano *todo* lo que existirá,
y cualquier tema nuevo interesante ("quiero un nodo de autómatas celulares", "quiero teoría de números
computacional") exige renumerar o forzar un lugar. Un árbol de prerrequisitos con IDs estables resuelve esto:
cada nodo declara **de qué depende**, no **en qué posición va**. Nodos nuevos se cuelgan de un prerrequisito
existente y el árbol crece sin fricción — el mismo principio que ya usás en el backlog del proyecto
("inventario único... con IDs estables").

**Tres ramas después de un tronco común**, pensadas para dos públicos distintos que hoy no tienen un lugar
natural donde converger:

- **Rama Matemática (`PY-M*`)** — el diferencial de Matex (Cara B: Newton-Raphson, complejidad, simulación)
  más una cola profunda para quien viene del lado matemático puro (teoría de números, álgebra abstracta,
  probabilidad).
- **Rama Computación (`PY-C*`, nueva)** — estructuras de datos, paradigmas de diseño de algoritmos, grafos,
  nociones de computabilidad. Nada de esto estaba en la propuesta original; es el espacio para quien viene
  del lado de ciencias de la computación y quiere profundidad ahí, no solo "Python aplicado a matemática".
- **Rama Entorno (`PY-E*`)** — Pyodide, stdlib amplia, datos reales, y el apéndice de integración con Matex.

## 1. El árbol

```
PY-N1 Fundamentos
  └─ PY-N2 Estructuras y funciones de primera clase
       └─ PY-N3 POO con objetos matemáticos
            ├─ PY-M1 Métodos numéricos y algoritmos (núcleo Cara B)
            │    ├─ PY-M3 Matemática simbólica (SymPy)
            │    └─ PY-M4 Matemática avanzada (números, álgebra, probabilidad)
            ├─ PY-M2 Álgebra lineal computacional (NumPy) ──────┘ (PY-M4 también depende de M2)
            ├─ PY-C1 Estructuras de datos clásicas
            │    ├─ PY-C2 Paradigmas de diseño de algoritmos ← (también depende de PY-M1, por "complejidad")
            │    ├─ PY-C3 Algoritmos sobre grafos
            │    └─ PY-C4 Computabilidad y lenguajes formales ← (también depende de PY-C2)
            └─ PY-E1 Pyodide y el navegador
                 └─ PY-E4 Python dentro de Matex ← (también depende de PY-M1; sólo si existe el Nivel 2 de nodos)

PY-N2 ──── PY-E2 Stdlib amplia y buenas prácticas (no necesita POO, rama corta y temprana)
              └─ PY-E3 Datos reales (pandas) ← (también depende de PY-M2)
```

Notación: `A ← (también depende de B)` marca prerrequisitos múltiples que no caben en el árbol ASCII lineal;
la tabla de la §2 es la fuente de verdad (declara **todos** los prerrequisitos de cada nodo).

## 2. Nodos, con ID y prerrequisitos

Cada nodo agrupa varias lecciones (formato Aprender/Ejemplo/Practicar + quiz, igual que LaTeX); el conteo es
orientativo, no un compromiso cerrado.

### Tronco — `PY-N*`

| ID | Nodo | Prerrequisitos | Lecciones (aprox.) |
|---|---|---|---|
| `PY-N1` | Fundamentos con sabor matemático — números, variables, booleanos, strings, condicionales, bucles, funciones, errores | — | 10 |
| `PY-N2` | Estructuras y funciones de primera clase — dicts/sets, comprehensions, orden superior, *closures*, decoradores, recursión, `math`, excepciones, generadores, `assert` (puente a `verify`) | `PY-N1` | 10 |
| `PY-N3` | POO con objetos matemáticos — Fracción, Vector (`__add__`/`__mul__`), `__eq__`/`__lt__`, type hints, `dataclasses`, composición (Polinomio de Términos) | `PY-N2` | 6 |

### Rama Matemática — `PY-M*`

| ID | Nodo | Prerrequisitos | Para quién pega más | Lecciones |
|---|---|---|---|---|
| `PY-M1` | Métodos numéricos y algoritmos — precisión de punto flotante, bisección, Newton-Raphson, integración numérica, interpolación/ajuste, recursión aplicada, complejidad, ordenamiento/búsqueda, Monte Carlo, Euler | `PY-N3` | Núcleo Cara B — el diferencial de Matex | 12 |
| `PY-M2` | Álgebra lineal computacional (NumPy) — arrays, *broadcasting*, vectores/matrices, sistemas lineales, estadística, `linspace` | `PY-N3` | Ambos públicos | 5 |
| `PY-M3` | Matemática simbólica (SymPy) — símbolos, simplificar/factorear, resolver, derivar/integrar, series de Taylor, `sympy.latex()`, cuándo usar CAS vs. motor nativo | `PY-M1` | Matemáticos — CAS real | 7 |
| `PY-M4` **(nuevo)** | Matemática avanzada computacional — teoría de números (primos, MCD, aritmética modular), álgebra abstracta con SymPy (grupos, anillos), probabilidad y estadística, combinatoria computacional | `PY-M1`, `PY-M2` | Matemáticos — el hueco que faltaba | 8 |

### Rama Computación — `PY-C*` (nueva)

| ID | Nodo | Prerrequisitos | Para quién pega más | Lecciones |
|---|---|---|---|---|
| `PY-C1` **(nuevo)** | Estructuras de datos clásicas — pilas, colas, listas enlazadas, árboles (binarios, BST), tablas hash | `PY-N3` | Científicos de la computación | 6 |
| `PY-C2` **(nuevo)** | Paradigmas de diseño de algoritmos — *greedy*, divide y vencerás, programación dinámica, *backtracking* | `PY-C1`, `PY-M1` | Científicos de la computación | 5 |
| `PY-C3` **(nuevo)** | Algoritmos sobre grafos — representación, BFS/DFS, caminos mínimos (Dijkstra), árboles de expansión mínima | `PY-C1` | Científicos de la computación | 5 |
| `PY-C4` **(nuevo, opcional/avanzado)** | Computabilidad y lenguajes formales — autómatas finitos, expresiones regulares como teoría, P vs. NP, intratabilidad | `PY-C2` | Científicos de la computación — la cola teórica | 4 |

### Rama Entorno — `PY-E*`

| ID | Nodo | Prerrequisitos | Lecciones |
|---|---|---|---|
| `PY-E1` | Pyodide y el navegador — WASM, sistema de archivos virtual, interoperabilidad JS↔Python, `micropip` | `PY-N3` | 5 |
| `PY-E2` | Stdlib amplia y buenas prácticas — `collections`, `itertools`/`functools`, regex, JSON, testing formal, manejo de errores propio | `PY-N2` (no necesita POO) | 6 |
| `PY-E3` | Datos reales (pandas) — CSV, limpieza, agrupar, tabla/gráfico | `PY-M2`, `PY-E2` | 4 |
| `PY-E4` (apéndice) | Python dentro de Matex — modelo `exec`/`eval`/`code-block`, contrato `matex.emit_*`, *freeze*, litmus test, proyecto | `PY-M1`, `PY-E1` — **y** que exista el Nivel 2 de nodos ejecutables en Matex | 5 |

**Total actual: 3 (tronco) + 4 (Matemática) + 4 (Computación) + 4 (Entorno) = 15 nodos, ≈68 lecciones.**

## 3. Por qué esta forma ayuda a crecer

- **Nodos nuevos no reordenan nada.** Ejemplos de crecimiento futuro que ya tienen dónde colgarse sin tocar
  el resto: `PY-M5` "Ecuaciones diferenciales y modelado" (prereq `PY-M1`+`PY-M2`), `PY-C5` "Algoritmos
  aproximados y heurísticas" (prereq `PY-C2`), `PY-M6` "Optimización convexa" (prereq `PY-M2`+`PY-M3`).
- **Caminos múltiples y válidos.** Alguien puede llegar a `PY-C3` (grafos) sin haber tocado SymPy, y a `PY-M3`
  (SymPy) sin haber tocado estructuras de datos. El árbol no impone un único recorrido — sólo impone qué es
  *necesario* antes de qué.
- **`PY-E2` (stdlib) cuelga directo de `PY-N2`, no de `PY-N3`.** Es deliberado: no necesita POO, así que
  alguien puede desviarse ahí temprano si sólo quiere "Python general" sin pasar por el tronco matemático
  completo.
- **Las ramas nuevas (`PY-C*`, `PY-M4`) son exactamente donde vive la extensibilidad que pediste** — son las
  hojas más "abiertas" del árbol: la rama de computación puede crecer hacia teoría de la complejidad,
  criptografía aplicada, autómatas celulares; la de matemática avanzada hacia geometría computacional,
  teoría de grafos algebraica, sistemas dinámicos. Ninguna de esas adiciones futuras rompe un prerrequisito
  existente.

## 4. Qué deliberadamente NO entra (no-objetivos)

- ❌ Herencia múltiple ni jerarquías de clases profundas en `PY-N3` — POO se enseña con composición.
- ❌ Programación web, `asyncio` como disciplina propia, ciencia de datos/ML como campo — fuera del wedge.
- ❌ No compite con Jupyter/Colab en exploración pesada.

## 5. IDE mínimo

File explorer + CodeMirror 6 + Pyodide en un Web Worker. Autocompletado básico (introspección del
*namespace* vivo) y marcado de errores por sintaxis alcanzan para el tronco. Vale la pena anticipar un botón
de "detener ejecución" (barato en un Worker, crítico en `PY-M1`/`PY-C2`, donde los loops mal escritos son el
error más común). `PY-E1` necesita el sistema de archivos virtual visible desde el explorer.

Si la plataforma quisiera reflejar el árbol en la UI (en vez de una lista lineal de lecciones), esto se
presta directamente a una vista tipo "árbol de habilidades" — cada nodo se desbloquea cuando sus
prerrequisitos están completos, con las ramas nuevas visualmente abiertas hacia arriba/afuera.

## 6. Secuencia sugerida de construcción (no confundir con el árbol de contenidos)

1. IDE mínimo + `PY-N1`–`PY-N3` — valor propio inmediato.
2. `PY-M1` — es donde vive el diferencial real (§4.2 y §7 de la propuesta de nodos).
3. `PY-C1`–`PY-C3` y `PY-E1` — en paralelo, según qué público llega primero.
4. `PY-M2`, `PY-M3`, `PY-E2` — cuando haya señal de que la gente llega hasta ahí.
5. `PY-M4`, `PY-C4`, `PY-E3` — las hojas más profundas, sin apuro.
6. `PY-E4` — sólo cuando el Nivel 2 de nodos ejecutables exista en Matex.

## 7. Preguntas abiertas

- ¿El curso comparte infraestructura de lecciones/quiz/repaso espaciado con el curso de LaTeX?
- ¿La UI del curso debería mostrar el árbol explícitamente (tipo *skill tree*) o mantenerse como lista con
  "prerrequisito sugerido" en texto? Afecta bastante el trabajo de frontend.
- `PY-E4` toca temas que quizás cambien si Matex termina el Nivel 2 con backend+sandbox (Fase D, diferida)
  en vez de sólo Pyodide — ¿marcarlo "sujeto a revisión" explícitamente en el propio nodo?

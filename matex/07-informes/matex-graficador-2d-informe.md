# Informe: Módulo de Graficación de Funciones 2D para MateX

## 0. Contexto y filosofía de diseño

MateX es una abstracción semántica sobre LaTeX que compila a múltiples destinos (LaTeX/TikZ-pgfplots, web estática, editor interactivo web) desde un único AST. Esto tiene una consecuencia directa para el diseño del módulo de graficación: **cada feature que se defina debe pensarse en términos de su significado matemático, no de su representación visual**, y luego debe existir un mapeo (a veces con degradación) hacia cada backend.

Ejemplo de diferencia de enfoque:

- LaTeX/pgfplots: sintaxis potente pero imperativa y de bajo nivel (`\addplot[domain=-5:5, samples=100, blue, thick] {x^2};`). El usuario controla samples, dominio, estilo, todo manualmente.
- GeoGebra: modelo declarativo centrado en objetos matemáticos (puntos, funciones, vectores) con actualización automática y dependencias vivas entre objetos (hoja de cálculo geométrica).
- MateX (propuesto): declarar **qué es** el objeto matemático y **qué rol** cumple (función principal, derivada, auxiliar, envolvente, etc.), dejando que el compilador decida samples, colores por defecto, resolución, e interactividad según el target.

Este informe enumera las capacidades que debería tener el módulo `plot2d` (nombre tentativo) de MateX, organizadas por categoría, inspiradas en LaTeX (TikZ/pgfplots, pgfplots addons como `fillbetween`) y en GeoGebra (Graphing Calculator + CAS + Geometry).

---

## 1. Tipos de objetos graficables

### 1.1 Funciones explícitas `y = f(x)`
- Definición por expresión matemática (`f(x) = x^2 - 3x + 2`).
- Definición por función nombrada reutilizable, referenciable en otras partes del documento (texto, otras gráficas, tablas de valores).
- Restricción de dominio explícita (`domain: [-5, 5]`, `domain: x ≠ 0`).
- Múltiples ramas / funciones a trozos (piecewise), con posibilidad de indicar apertura/cierre de intervalo (círculo relleno vs. hueco, como en GeoGebra).
- Funciones inversas graficadas automáticamente (reflejo sobre `y = x`), como ayuda semántica (`plot inverse of f`).
- Composición de funciones con trazo diferenciado (`f∘g`).

### 1.2 Funciones paramétricas
- `x(t), y(t)` con rango de parámetro y control de dirección (flechas de orientación, como TikZ `decoration={markings}`).
- Animación del parámetro `t` como "traza" progresiva en el target interactivo (dibujo animado de la curva, útil para cicloides, espirales, Lissajous).

### 1.3 Funciones implícitas `F(x, y) = 0`
- Trazado por contorno (marching squares) — necesario porque no siempre son despejables.
- Curvas de nivel de una función de dos variables (`level curve of F at c`), útil para introducir 3D "aplanado" sin comprometerse a un módulo 3D completo.

### 1.4 Coordenadas polares
- `r(θ)` con rango angular, número de vueltas, dirección.
- Conversión automática y coherente con el sistema de ejes cartesiano subyacente (rejilla polar opcional superpuesta).

### 1.5 Datos discretos / no analíticos
- Nubes de puntos (scatter) desde tabla de datos o CSV embebido.
- Diagramas de barras / histogramas simples en el mismo lienzo 2D.
- Sucesiones y series: graficar `a_n` como puntos discretos, con opción de unión poligonal (útil en cálculo/análisis numérico).
- Interpolación visual entre datos discretos (splines, lineal, escalonada) — dejando claro semánticamente que es una interpolación y no una función "real" definida.

### 1.6 Desigualdades y regiones
- Sombreado de región solución de una inecuación (`y > x^2`), con detección automática del semiplano/región válida.
- Intersección de múltiples regiones (sistemas de inecuaciones), como en un problema de programación lineal.
- Sombreado de área entre dos curvas (`fillbetween` de pgfplots / `Integral(f,g,a,b)` de GeoGebra), con opción de mostrar el valor numérico del área calculada.

### 1.7 Campos y elementos vectoriales
- Campos de pendientes (slope fields) para ecuaciones diferenciales `y' = f(x,y)`.
- Campos vectoriales `F(x,y) = (P(x,y), Q(x,y))`.
- Curvas solución de EDOs superpuestas al campo de pendientes (integración numérica tipo Euler/Runge-Kutta bajo el capó).

### 1.8 Cónicas y lugares geométricos
- Definición semántica de cónicas (círculo por centro+radio, elipse por focos, parábola por foco+directriz, hipérbola por focos) en vez de forzar al usuario a escribir la ecuación implícita.
- Lugares geométricos genéricos (`locus of P as Q moves along ...`), replicando el comando `Locus` de GeoGebra — muy potente pedagógicamente.

---

## 2. Sistema de coordenadas y configuración de ejes

- **Viewport**: automático (ajustado a los objetos graficados, con márgenes razonables) o manual (`xrange`, `yrange`).
- **Escalas**: lineal, logarítmica (`log-x`, `log-y`, `log-log`), simétrica-log para datos con valores negativos y positivos.
- **Relación de aspecto**: `equal` (círculos se ven como círculos, esencial en geometría) vs `auto` (aprovecha el espacio disponible).
- **Grid / rejilla**:
  - Densidad configurable, o automática según el rango.
  - Subrejilla (líneas menores) opcional.
  - Alineación a múltiplos de π, e, u otras constantes (crucial para trigonometría — GeoGebra permite `π/2` en el eje x directamente).
- **Ejes**:
  - Posición: cruzados en el origen (estilo "ejes matemáticos"), en el borde (estilo "gráfico científico/caja"), o desplazados a un punto arbitrario.
  - Flechas en los extremos (convención matemática) configurables.
  - Etiquetas de eje (`x`, `t`, `tiempo (s)`, etc.) con unidades opcionales.
  - Eje y secundario (doble escala), útil para comparar magnitudes de distinta naturaleza.
- **Marcas (ticks)**: automáticas, manuales, o expresadas simbólicamente (fracciones de π, raíces, etc.).
- **Ocultar ejes / grid** para ilustraciones puramente geométricas o "limpias" (modo pizarra).

---

## 3. Estilo visual y semántica de trazos

La idea de MateX de ser "semántico e intencional" sugiere que el estilo no debería asignarse manualmente color por color, sino por **rol semántico**, con un tema (theme) que resuelve el estilo concreto según el target:

| Rol semántico | Ejemplo de uso | Resolución típica |
|---|---|---|
| `primary` | función principal del problema | color de énfasis del tema, trazo grueso |
| `derivative` | f'(x), f''(x) | color relacionado pero distinguible, trazo más fino |
| `auxiliary` | asíntota, recta tangente | discontinuo/punteado, color neutro |
| `construction` | líneas de construcción geométrica (estilo GeoGebra) | gris claro, fino |
| `highlight` | punto crítico, intersección | marcador destacado + etiqueta |
| `region` | área sombreada | relleno semitransparente |

Además de esto, soporte de bajo nivel para quien quiera control fino:
- Color explícito (paleta propia o estándar tipo `tab10`/`Set2`).
- Grosor de línea, estilo (sólido, punteado, guiones, guion-punto).
- Opacidad y gradientes de relleno.
- Marcadores en puntos (círculo, cruz, cuadrado, relleno/vacío) con tamaño configurable.
- Etiquetado de curva al final del trazo (como en `pgfplots` con `\addlegendentry` pero también inline, al estilo Excel/Desmos donde la etiqueta "flota" al final de la curva sin necesitar leyenda aparte).

---

## 4. Anotaciones matemáticas automáticas y manuales

Esta es el área donde más valor puede aportar MateX frente a LaTeX puro, automatizando lo que en TikZ hay que calcular a mano:

- **Puntos notables auto-detectados** (opt-in, ya que requiere resolver simbólica/numéricamente):
  - Raíces / ceros (intersección con eje x).
  - Intersección con eje y.
  - Extremos locales (máximos/mínimos) vía derivada.
  - Puntos de inflexión vía segunda derivada.
  - Intersecciones entre dos o más curvas graficadas.
- **Etiquetas de coordenadas**: mostrar `(a, f(a))` junto al punto, con formato numérico o exacto (fracciones, radicales) según corresponda.
- **Rectas tangentes y normales** en un punto dado o en un punto móvil (interactivo).
- **Asíntotas**: verticales, horizontales y oblicuas, detectadas automáticamente por análisis de límites o declaradas explícitamente.
- **Área bajo la curva / entre curvas**: sombreado + cálculo numérico/simbólico del valor, con opción de mostrar la partición (rectángulos de Riemann, trapecios) como recurso didáctico para introducir la integral.
- **Vectores y flechas** libres, con notación de componentes o magnitud/dirección.
- **Anotaciones de texto libre** con soporte de LaTeX inline (fórmulas dentro de la etiqueta), líneas de referencia (leader lines) hacia el objeto anotado.
- **Marcas de longitud/distancia** (llaves, segmentos con medida), útil para geometría.
- **Marcas de ángulo** (arcos entre rectas/vectores con valor en grados o radianes).
- **Cuadrícula de valores / tabla de valores** vinculada a la función graficada (para pedagogía de "construir la gráfica a mano").

---

## 5. Composición de múltiples elementos

- Overlay de N funciones en un mismo sistema de ejes, con leyenda automática opcional.
- Subgráficos (grid de gráficos, "facets"), útil para comparar transformaciones (`f(x)`, `f(x)+k`, `f(x+k)`, `k·f(x)` en una grilla 2x2 didáctica).
- Sincronización de rango/zoom entre subgráficos vinculados.
- Capas (layers) con z-order explícito, para controlar qué se dibuja encima (p. ej. grid detrás, función en medio, anotaciones adelante).

---

## 6. Interactividad (target: editor web / documento web)

Acá es donde GeoGebra marca la diferencia frente a LaTeX estático, y donde el compilador a "web interactivo" de MateX puede brillar:

- **Sliders paramétricos**: declarar un parámetro simbólico (`a` en `f(x) = a·sin(x)`) y que el compilador genere automáticamente un control deslizante con rango y paso configurables (o inferidos).
- **Puntos arrastrables (draggable points)**: puntos que el usuario mueve y que recalculan en vivo cualquier objeto dependiente (pendiente, área, distancia, etc.) — el equivalente al motor de dependencias de GeoGebra.
- **Zoom y pan** libres, con botón de "reset view".
- **Animación de parámetro**: reproducir automáticamente la variación de un parámetro en el tiempo (play/pause/velocidad), útil para mostrar familias de funciones o simular movimiento.
- **Tooltips / lectura de coordenadas** al pasar el mouse o tocar la curva, mostrando `(x, f(x))` en vivo.
- **Modo de construcción paso a paso** (equivalente al "Protocolo de Construcción" de GeoGebra): reproducir la creación del gráfico paso a paso como recurso didáctico.
- **Snap a la rejilla** al mover puntos, para construcciones geométricas exactas.
- **Exportación**: imagen estática (PNG/SVG), o si hay animación, GIF/video corto, o el propio embed interactivo para insertar en otra página.
- **Vínculos vivos entre objetos**: un punto definido como intersección de dos curvas se recalcula si el usuario edita cualquiera de las dos curvas (dependencias tipo hoja de cálculo, núcleo de GeoGebra).

---

## 7. Motor simbólico/numérico subyacente

Para que todo lo anterior funcione, el módulo necesita (o debe apoyarse en) un motor de cómputo:

- Parser de expresiones matemáticas a AST evaluable (ya lo tiene MateX como base, en principio reutilizable).
- Derivación simbólica automática (para tangentes, extremos, inflexión, campos de pendiente).
- Integración simbólica cuando sea posible, numérica (Simpson/cuadratura adaptativa) como fallback, con indicación clara de cuál se usó.
- Resolución de ecuaciones (raíces, intersecciones) por métodos simbólicos si aplica y numéricos (bisección/Newton) si no.
- Cálculo de límites (para asíntotas y continuidad).
- Muestreo adaptativo del dominio: más muestras cerca de curvatura alta, discontinuidades o asíntotas, y detección de "huecos" para no dibujar líneas espurias (problema clásico al portar de LaTeX: pgfplots dibuja una línea vertical falsa en una asíntota si no se maneja `unbounded coords=jump`; el compilador de MateX debería resolver esto automáticamente).

---

## 8. Manejo de dominio, singularidades y casos límite

- Declaración explícita de dominio (`x ∈ [0, ∞)`, `x ≠ 2`).
- Detección automática de discontinuidades evitables (hueco, con círculo vacío) vs. no evitables (salto, con círculos lleno/vacío en los extremos de cada rama), como GeoGebra maneja funciones a trozos.
- Manejo robusto de división por cero, raíces de números negativos, logaritmos de no positivos: el compilador no debe romper, sino simplemente no graficar ese punto y (opcionalmente) marcar la asíntota o el borde del dominio.
- Advertencias semánticas en tiempo de compilación (no errores duros) cuando el dominio declarado no coincide con el dominio real de la expresión.

---

## 9. Accesibilidad y semántica exportable

Dado el carácter "semántico e intencional" de MateX, el gráfico no debería ser solo una imagen:

- **Texto alternativo generado automáticamente** describiendo la función, su comportamiento cualitativo (creciente/decreciente, asíntotas, simetría) para lectores de pantalla.
- **Exportación de datos subyacentes** (tabla de puntos muestreados, expresión simbólica) embebida como metadata en el SVG o en el HTML, permitiendo que otras herramientas (o el propio usuario) reutilicen el gráfico como dato, no solo como imagen.
- **Sonificación** (mapear valores de la función a tono/volumen): feature avanzada pero cada vez más estándar en herramientas educativas accesibles (Desmos la incorporó).

---

## 10. Extensibilidad hacia otros dominios (mención breve)

Aunque el foco es 2D, conviene que el diseño no cierre la puerta a:
- Curvas de nivel de superficies 3D proyectadas en 2D (ya mencionado en 1.3).
- Diagramas de fase para sistemas de EDOs (2 variables de estado, sin depender de tiempo explícito).
- Retrato de campos complejos (dominio coloring) para funciones de variable compleja — muy visual y cada vez más usado en enseñanza de análisis complejo.

---

## 11. Mapeo a los distintos backends de compilación

| Feature | LaTeX (TikZ/pgfplots) | Web estática (SVG/Canvas) | Editor interactivo |
|---|---|---|---|
| Función explícita | `\addplot[domain=...] {expr};` | Muestreo + `<path>` SVG | Igual + recomputable si depende de slider |
| Paramétrica | `\addplot[domain=...] ({x(t)},{y(t)});` | Igual, con posible animación CSS/JS | Animación con control de tiempo |
| Implícita | requiere `contour` o paquete extra | marching squares en cliente | igual, recalculado en vivo si depende de parámetro |
| Sliders | no existe (estático) — se resuelve generando **múltiples gráficos** o pidiendo un valor fijo | no aplica (o se simula con varias imágenes) | control nativo, recomputa el AST y re-renderiza |
| Puntos arrastrables | no existe (estático) | no aplica | núcleo de dependencias vivo, reevalúa subárbol del AST afectado |
| Área sombreada | `\addplot fill between` | relleno de `<path>` con `fill-opacity` | igual + valor numérico recalculado si cambian límites |
| Detección de asíntotas | manual, requiere `unbounded coords=jump` | automática en el sampler | igual, además puede resaltarse al hacer hover |
| Texto alternativo | no aplica (PDF) | atributo `aria-label`/`<desc>` en SVG | igual + lectura dinámica del estado actual |

La conclusión de este mapeo es que **el AST de MateX debe capturar la intención completa** (incluyendo qué es interactivo y qué no), y que cada backend decide cómo "degradar" grácilmente lo que no puede soportar (p. ej., un slider en LaTeX se convierte en un valor fijo con una nota al pie, o en una grilla de varios gráficos mostrando distintos valores del parámetro).

---

## 12. Propuesta ilustrativa de sintaxis semántica en MateX

Solo a modo de ejemplo de cómo podría verse la intención declarativa (pseudo-sintaxis):

```matex
\begin{plot2d}
  view: auto
  aspect: equal
  grid: minor

  function f(x) = x^2 - 3x + 2
    role: primary
    domain: [-2, 5]
    label: "f(x)"

  derivative of f
    role: derivative
    label: "f'(x)"

  tangent to f at x = 1
    role: auxiliary

  mark roots of f
  mark extrema of f

  shade area between f and x-axis over [1, 3]
    show-value: true

  slider a: [0.5, 3, step: 0.1] = 1
  function g(x) = a * sin(x)
    role: primary
\end{plot2d}
```

La idea clave: el usuario declara **qué quiere ver** (raíces, tangente, área, derivada) y el compilador decide cómo calcularlo y cómo dibujarlo en cada target, en vez de que el usuario tenga que escribir coordenadas o samples a mano.

---

## 13. Tabla comparativa general: LaTeX (pgfplots) vs GeoGebra vs MateX (propuesto)

| Capacidad | LaTeX/pgfplots | GeoGebra | MateX (propuesto) |
|---|---|---|---|
| Sintaxis | Imperativa, de bajo nivel | Declarativa por objetos, GUI + comandos | Declarativa semántica por rol/intención |
| Cálculo simbólico | No (requiere `sympy`/externo) | Sí (CAS integrado) | Sí (motor propio reutilizado del AST) |
| Interactividad | No (estático) | Sí, nativo | Sí, en target editor/web |
| Exportación a documento imprimible | Nativo (es LaTeX) | Limitado (exporta imagen) | Nativo (compila a LaTeX también) |
| Semántica del contenido (accesibilidad, reutilización de datos) | Baja (es dibujo vectorial "mudo") | Media | Alta (por diseño, vía AST) |
| Curva de aprendizaje | Alta | Baja-media | Objetivo: baja, manteniendo poder expresivo |
| Detección automática de rasgos (raíces, asíntotas, extremos) | Manual | Semi-automática (comandos específicos) | Automática, opt-in por declaración de intención |
| Multi-target (mismo doc → distintos formatos) | No | No | Sí (razón de ser de MateX) |

---

## 14. Roadmap sugerido

**MVP (v0.1)**
- Funciones explícitas, dominio, estilo básico por rol.
- Ejes configurables (rango, grid, aspect ratio).
- Marcado manual de puntos y etiquetas.
- Compilación a SVG estático y a pgfplots.

**v0.2 – Anotación inteligente**
- Detección automática de raíces, extremos, intersecciones.
- Tangentes, área sombreada con valor numérico.
- Funciones a trozos y manejo de discontinuidades/asíntotas.

**v0.3 – Ampliación de tipos**
- Paramétricas, polares, implícitas, desigualdades/regiones.
- Cónicas semánticas, lugares geométricos.

**v0.4 – Interactividad (target editor)**
- Sliders, puntos arrastrables, zoom/pan, tooltips.
- Motor de dependencias vivas.

**v0.5 – Accesibilidad y extensión**
- Texto alternativo automático, exportación de datos.
- Campos de pendientes/vectoriales, EDOs.
- (Opcional) sonificación, dominio de variable compleja.

---

## 15. Conclusión

El diferencial de MateX frente a LaTeX puro es reemplazar comandos imperativos de bajo nivel por **declaraciones de intención matemática** (qué representa cada trazo, qué rol cumple, qué relación tiene con otros objetos), inspirándose en el modelo de objetos vivos de GeoGebra pero conservando la capacidad de LaTeX de producir documentos impresos de calidad tipográfica. El módulo `plot2d` debería, en definitiva, funcionar como una capa semántica que:

1. Captura la intención matemática completa en el AST (no solo el trazo final).
2. Delega en cada backend la decisión de cómo materializar esa intención (estático en LaTeX, interactivo en el editor web).
3. Automatiza lo que en LaTeX es tedioso (samples, asíntotas, áreas) y lo que en GeoGebra requiere clicks (declarar roles, estilos consistentes, generar variantes para imprimir).

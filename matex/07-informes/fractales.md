La generación de fractales dentro del ecosistema LaTeX es uno de los ejercicios más exigentes para el motor de composición tipográfica, ya que sitúa a la herramienta en la frontera entre la descripción de documentos y la computación gráfica pura.

A continuación, se presenta un informe exhaustivo que analiza las bases matemáticas de las estructuras fractales y los diferentes pipelines arquitectónicos disponibles en LaTeX para su renderizado profesional.

---

# Informe Técnico: Computación Gráfica de Estructuras Fractales en el Ecosistema LaTeX

## 1. Fundamentos Matemáticos del Objeto Fractálico

Para abordar el diseño de un motor de renderizado de fractales, es indispensable clasificar las estructuras según su naturaleza matemática fundamental. Rigurosamente, un fractal es un objeto geométrico cuya dimensión de Hausdorff-Besicovitch ($D_H$) excede estrictamente su dimensión topológica ordinaria ($D$).

### 1.1. Sistemas de Funciones Iteradas (IFS) y Atractores

Los fractales lineales (como el triángulo de Sierpinski, el copo de nieve de Koch o la curva del dragón) se definen mediante un espacio métrico completo $(X, d)$ y un conjunto finito de contracciones algebraicas $w_i: X \to X$, cada una con un factor de escala $r_i < 1$.

El Teorema del Punto Fijo de Banach garantiza la existencia de un único subconjunto compacto no vacío $K \subset X$ (el atractor del sistema) que satisface la ecuación de autosemejanza:

$$K = \bigcup_{i=1}^{n} w_i(K)$$

Formalmente, muchos de estos atractores lineales se modelan mediante **Sistemas de Lindenmayer (L-Systems)**, donde una gramática formal compuesta por un alfabeto, un axioma inicial y un conjunto de reglas de producción (sustitución de cadenas) define la geometría fractal al traducirse a comandos de movimiento (geometría de tortuga).

### 1.2. Fractales de Tiempo de Escape (Dinámica Holomorfa)

Los fractales no lineales (como el conjunto de Mandelbrot y los conjuntos de Julia) se estudian dentro del marco de la iteración de funciones complejas sobre la esfera de Riemann. Específicamente, para la familia cuadrática elemental:

$$z_{n+1} = z_n^2 + c \quad (z, c \in \mathbb{C})$$

* **Conjunto de Julia ($J_f$):** Para un valor de $c$ constante, es la frontera del conjunto de puntos iniciales $z_0$ cuya órbita permanece acotada cuando $n \to \infty$.
* **Conjunto de Mandelbrot ($M$):** Es el espacio de parámetros en el plano complejo $c$ para los cuales la órbita del punto crítico $z_0 = 0$ no escapa a infinito:

$$M = \{ c \in \mathbb{C} \mid \lim_{n \to \infty} \vert{}z_n\vert{} \neq \infty \}$$

Computacionalmente, el algoritmo evalúa la velocidad de escape midiendo cuántas iteraciones se requieren para que el módulo de la órbita supere un umbral de confinamiento (usualmente $\vert{}z_n\vert{} > 2$).

---

## 2. El Desafío Computacional dentro de TeX

El núcleo histórico de LaTeX (`pdfTeX`) opera bajo una arquitectura de macros monolítica optimizada para el cálculo de cajas de texto, pegamento tipográfico (*glue*) y operaciones aritméticas rudimentarias en punto fijo (unidades de escala de puntos escalados, `sp`, donde $1\,\mathrm{pt} = 65536\,\mathrm{sp}$).

Intentar calcular un fractal directamente en TeX expone tres limitaciones sistémicas:

1. **Desbordamiento de la pila (*Stack Overflow*):** La recursión profunda en macros consume la memoria interna de tokens de TeX de forma exponencial.
2. **Aritmética deficiente:** Carecer de tipos de datos primitivos para punto flotante nativo de 64 bits obliga a implementar emulaciones de software costosas.
3. **Gestión de memoria:** Guardar miles de coordenadas de puntos vectoriales dentro de un único macro colapsa los límites de memoria de la distribución (`main memory size`).

---

## 3. Soluciones Arquitectónicas en LaTeX

Para superar estas limitaciones, el ecosistema ofrece cuatro aproximaciones técnicas bien diferenciadas.

### Método 1: TikZ + Autómatas Gramaticales (`lindenmayersystems`)

Para fractales que responden a esquemas L-System, TikZ provee una librería dedicada nativa llamada `lindenmayersystems`. En lugar de utilizar recursión pura de macros de TeX, esta librería utiliza un intérprete interno optimizado que procesa cadenas simbólicas bit a bit, minimizando drásticamente la huella en memoria de la pila.

A continuación, se detalla la implementación exacta para renderizar la **Curva del Dragón de Heighway** de orden 10:

```latex
\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{lindenmayersystems}

\begin{document}
\begin{center}
\begin{tikzpicture}[scale=2.5]
    % Definición formal de la gramática del L-System
    \pgfdeclarelindenmayersystem{dragon}{
        \symbol{F}{\pgflsystemdrawforward}
        \symbol{+}{\pgflsystemturnleft}
        \symbol{-}{\pgflsystemturnright}
        \axiom{F}
        \rule{F -> F+G+}
        \rule{G -> -F-G}
    }
    
    % Renderizado del camino fractal con profundidad 10
    \draw[thick, color=darkgray] 
        lindenmeyer system [lsystem={dragon, axiom=F, order=10, angle=90, step=0.04cm}];
\end{tikzpicture}
\end{center}
\end{document}

```

### Método 2: Pgfplots + Gnuplot (Escape de Tiempo Externo)

Calcular el conjunto de Mandelbrot punto a punto en TikZ requiere evaluar una rejilla bidimensional (por ejemplo, $200 \times 200 = 40000$ puntos complejos), ejecutando un bucle interno de hasta 50 iteraciones por punto. Realizar esto nativamente causaría un fallo por tiempo de compilación excedido.

La estrategia profesional consiste en delegar el bucle iterativo a **Gnuplot** mediante la directiva `raw gnuplot`, devolviendo a LaTeX únicamente la matriz con las curvas de nivel o el mapa de densidad numérica.

```latex
\documentclass{article}
\usepackage{pgfplots}
\pgfplotsset{compat=1.18}

\begin{document}
\begin{tikzpicture}
\begin{axis}[
    view={0}{90}, % Proyección cenital (2D)
    colorbar,
    colormap/viridis,
    xmin=-2.0, xmax=0.5,
    ymin=-1.25, ymax=1.25,
    xlabel={$\Re(c)$},
    ylabel={$\Im(c)$},
    axis on top
]
    % Llamada al subproceso matemático externo de Gnuplot
    \addplot3[
        surf,
        shader=flat,
        raw gnuplot,
        mesh/rows=150, % Muestreo en el eje Real
        mesh/cols=150  % Muestreo en el eje Imaginario
    ] gnuplot {
        set table;
        # Definición del algoritmo de escape en sintaxis gnuplot
        mandel(x, y, max_iter) = \
            value = 0; \
            zx = 0.0; zy = 0.0; \
            do for [i=1:max_iter] { \
                if (zx*zx + zy*zy > 4.0) { value = i; break; } \
                tmp = zx*zx - zy*zy + x; \
                zy = 2.0*zx*zy + y; \
                zx = tmp; \
            }; \
            return value;
        
        # Mapeo tridimensional (Z representa las iteraciones de escape)
        splot [-2.0:0.5] [-1.25:1.25] mandel(x, y, 50);
    };
\end{axis}
\end{tikzpicture}
\end{document}

```

*Requisito de compilación:* Requiere activar la bandera `-shell-escape` en la terminal para permitir la llamada al binario del sistema.

### Método 3: LuaLaTeX + TikZ (Cómputo Nativo Asíncrono)

Para documentos que deben ser compilados en entornos estrictos o servidores en la nube sin soporte para binarios externos (como ciertas configuraciones restringidas de Overleaf), la arquitectura híbrida de **LuaLaTeX** ofrece la solución definitiva.

Al delegar los cálculos numéricos de punto flotante a la máquina virtual Lua integrada, se procesan los conjuntos numéricos a la velocidad de código compilado de alto rendimiento (aprovechando el compilador JIT si está disponible), y se inyectan las primitivas directamente al búfer de PDF mediante la API interna de TeX.

```latex
\documentclass{article}
\usepackage{tikz}
\usepackage{luacode}

\begin{luacode*}
function render_mandelbrot(res_x, res_y, max_iter)
    local x_min, x_max = -2.0, 0.5
    local y_min, y_max = -1.25, 1.25
    local dx = (x_max - x_min) / res_x
    local dy = (y_max - y_min) / res_y

    for i = 0, res_x do
        local cr = x_min + i * dx
        for j = 0, res_y do
            local ci = y_min + j * dy
            local zr, zi = 0.0, 0.0
            local iter = 0
            
            while (zr*zr + zi*zi <= 4.0) and (iter < max_iter) do
                local temp = zr*zr - zi*zi + cr
                zi = 2.0 * zr * zi + ci
                zr = temp
                iter = iter + 1
            end
            
            -- Si el punto pertenece al conjunto o escapa tarde, se dibuja una primitiva de píxel
            if iter == max_iter then
                tex.sprint(string.format("\\fill (%.4f,%.4f) rectangle +(%.4f,%.4f);", cr, ci, dx, dy))
            end
        end
    end
end
\end{luacode*}

\begin{document}
\begin{center}
\begin{tikzpicture}[scale=3]
    % Ejes decorativos cartesianos nativos
    \draw[gray,->] (-2.2,0) -- (0.7,0) node[right] {$\Re(z)$};
    \draw[gray,->] (0,-1.4) -- (0,1.4) node[above] {$\Im(z)$};
    
    % Invocación del motor matemático de Lua con rejilla de 120x120
    \begin{scope}[color=black]
        \directlua{render_mandelbrot(120, 120, 30)}
    \end{scope}
\end{tikzpicture}
\end{center}
\end{document}

```

---

## 4. Matriz Arquitectónica de Criterios

| Criterio Técnico | TikZ (`lindenmayersystems`) | Pgfplots + Gnuplot | LuaLaTeX + Lua Integrado |
| --- | --- | --- | --- |
| **Tipología Fractal Óptima** | Lineal / Gramatical (Sierpinski, Koch) | Dinámica Compleja (Mandelbrot, Julia) | Mixta de Alta Densidad Matricial |
| **Backend de Cómputo** | Intérprete de macros de TeX | Ejecutable de Gnuplot (C/C++) | Intérprete Lua nativo en memoria |
| **Seguridad de Compilación** | Totalmente seguro | Requiere permisos `shell-escape` | Totalmente seguro |
| **Portabilidad** | Alta (Cualquier distribución) | Baja (Depende del PATH del SO) | Alta (Requiere motor LuaTeX) |
| **Eficiencia de Memoria** | Moderada (Límites de TeX internos) | Excelente (Tablas pre-calculadas) | Excelente (Recolector de basura Lua) |

---

Para comprender a fondo la dinámica de estos sistemas y cómo la variación de los parámetros altera la topología antes de trasladar el código a un entorno de compilación LaTeX rígido, resulta de gran utilidad interactuar directamente con un motor de cálculo numérico que emule estos algoritmos de escape de tiempo y sus transformaciones en tiempo real.
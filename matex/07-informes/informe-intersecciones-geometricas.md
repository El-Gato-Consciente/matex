# **Informe Técnico: Resolución y Renderizado de Intersecciones Geométricas y Sistemas de Coordenadas**

**Autor:** Sistema de Asistencia Científica

**Fecha:** Julio de 2026

## **1\. Introducción al Problema de las Intersecciones**

El cálculo de puntos de intersección entre curvas o superficies constituye uno de los pilares del análisis numérico y la geometría computacional. En el contexto de los motores tipográficos científicos (como LaTeX) y sus subsistemas vectoriales (TikZ, Pgfplots, Asymptote), este problema diverge del cálculo simbólico puro.

Cuando se busca la intersección de dos curvas implícitas dadas por *f(x,y) \= 0* y *g(x,y) \= 0*, intentar resolver el sistema algebraico subyacente mediante el motor del documento es ineficiente. Una heurística teórica común sugiere plantear la superficie combinada *f(x,y)² \+ g(x,y)² \= 0*, pero este enfoque colapsa en la práctica numérica: al no existir valores negativos para la función resultante, no se produce un cruce real por cero (inversión de signo), volviendo inútiles algoritmos de búsqueda como *Marching Squares*. Por ello, la industria ha adoptado la **resolución vectorial** sobre la algebraica.

## **2\. Resolución Vectorial mediante TikZ y Pgfplots**

La filosofía detrás del motor vectorial de TikZ consiste en desacoplar el cálculo matemático de la resolución topológica. Las curvas se generan externamente (usualmente vía Gnuplot) y se importan al documento como polilíneas o trayectorias de curvas de Bézier.

### **2.1. La Librería intersections**

Al cargar el módulo especializado \\usetikzlibrary{intersections}, LaTeX habilita un subsistema que examina la intersección puramente gráfica de los caminos dibujados. El motor de PostScript o PDF subyacente recorre los vectores y, utilizando técnicas de recorte de Bézier (Bézier clipping) y detección de colisión de segmentos, devuelve las coordenadas exactas de cruce.

Para que el motor identifique qué trayectorias procesar, se deben asignar alias a cada curva empleando la directiva name path.

`\documentclass{article}`  
`\usepackage{pgfplots}`  
`\usetikzlibrary{intersections}`  
`\pgfplotsset{compat=1.18}`

`\begin{document}`  
`\begin{tikzpicture}`  
`\begin{axis}[`  
    `xmin=-2, xmax=2, ymin=-2, ymax=2,`  
    `axis lines=center, set layers`   
`]`  
    `% Curva A: Elipse`  
    `\addplot[thick, color=blue, raw gnuplot, name path=curvaA] gnuplot {`  
        `set contour base; set cntrparam levels discrete 0; unset surface; set table;`  
        `splot x**2 + 4*y**2 - 4;`  
    `};`

    `% Curva B: Hipérbola`  
    `\addplot[thick, color=red, raw gnuplot, name path=curvaB] gnuplot {`  
        `set contour base; set cntrparam levels discrete 0; unset surface; set table;`  
        `splot x**2 - y**2 - 1;`  
    `};`

    `% Extracción y dibujado`  
    `\path[name intersections={of=curvaA and curvaB, by={i1, i2, i3, i4}}];`  
    `\pgfonlayer{plot foreground}`  
        `\fill[black] (i1) circle (2.5pt);`  
        `\fill[black] (i2) circle (2.5pt);`  
    `\endpgfonlayer`  
`\end{axis}`  
`\end{tikzpicture}`  
`\end{document}`  
    

## **3\. Intersección con los Ejes Cartesianos**

La búsqueda de raíces (intersección con *y \= 0*) o la ordenada al origen (intersección con *x \= 0*) son casos particulares de la intersección vectorial. En Pgfplots, la mejor aproximación es crear un camino auxiliar invisible que coincida geométricamente con el eje deseado, o bien declarar los ejes propios con un name path.

Al utilizar \\path\[name path=ejeX\] (\\pgfkeysvalueof{/pgfplots/xmin},0) \-- (\\pgfkeysvalueof{/pgfplots/xmax},0); se inyecta un vector paramétrico de límite a límite del área de ploteo. La colisión entre la curva funcional y este vector auxiliar revela inmediatamente los puntos intercepto sin recurrir a cálculos externos ni llamar nuevamente a la función original.

## **4\. Rendimiento Extremo y Soluciones C++ en Asymptote**

A diferencia de TikZ, Asymptote aborda el problema combinando ambas estrategias: la métrica algebraica y la resolución vectorial de bajo nivel, sustentada por una estructura de datos nativa en C++.

* **Evaluación Paramétrica Analítica:** Asymptote utiliza algoritmos adaptativos para aislar los intervalos de las curvas subyacentes.  
* **El tipo de dato guide:** Cuando la función contour() construye las isolíneas, devuelve una matriz de trayectorias (guide\[\]\[\]). Esto evita la manipulación engorrosa de subcadenas vectoriales.  
* **Función Nativa:** La orden intersectionpoints(curva1, curva2) ejecuta un barrido espacial hiper-optimizado, devolviendo de inmediato un arreglo de pares de coordenadas (pair\[\]).

## **5\. Sistemas de Coordenadas Oblicuos y Transformaciones Afines**

Frecuentemente en áreas como la cristalografía o la física relativista (diagramas de Minkowski), el espacio de representación debe abandonar la ortogonalidad. Un cambio de base altera la métrica del lienzo para que los vectores directores *X* e *Y* posean un ángulo distinto de 90°.

En Pgfplots, la transformación es global e inmediata. Al redefinir los vectores base mediante funciones trigonométricas en la definición del axis:

`x={(cos(10)*1cm, sin(10)*1cm)},`  
`y={(cos(60)*1cm, sin(60)*1cm)},`  
    

El motor gráfico aplica una **transformación afín** (o matriz de cizalladura) a todas las coordenadas que ingresen desde Gnuplot. Las curvas implícitas se deforman automáticamente para coincidir con el nuevo marco proyectivo, preservando todas las propiedades de intersección previamente discutidas, lo que demuestra la robustez matemática del pipeline.

## **6\. Matriz de Evaluación Tecnológica**

| Desafío Geométrico / Requisito | Solución Recomendada | Justificación Técnica   |
| :---- | :---- | :---- |
| Cálculo de múltiples puntos de cruce (sistemas no lineales) | TikZ (Librería intersections) | Abstracción total. Evita programar búsquedas numéricas (como Newton-Raphson 2D) iterando sobre cajas de delimitación paramétricas de los vectores. |
| Extracción de coordenadas para cálculos matemáticos posteriores | Asymptote | Retorna tipos de datos puros (pair\[\]) que pueden ser manipulados algorítmicamente en tiempo de compilación. |
| Simulación de espacios afines y geometría de deformación | Pgfplots | Las transformaciones matriciales (cambio de vectores base) operan como máscaras de capa global y no requieren recodificar las funciones matemáticas. |
| Entornos sin acceso al shell o sistemas de servidores estrictos | LuaLaTeX \+ Lua Nativo | La programación matricial y geométrica ocurre de manera encapsulada en la RAM del proceso TeX. |


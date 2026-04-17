considera criticamente lo siguiente y pondera si vale la pena incorporarlo de alguna manera; para tener en cuenta y quizas agregar a la doc y a los manifiestos:

Cuando generes documentos LaTeX, usá compilación condicional para asegurar compatibilidad entre motores (pdfLaTeX, XeLaTeX, LuaLaTeX).

1. Detectá el motor con `iftex`.

2. Separá claramente los modos:

* En pdfLaTeX:

  * usar `fontenc`, `inputenc`, `lmodern`
* En XeLaTeX / LuaLaTeX:

  * usar `fontspec`
  * opcional: `unicode-math`
  * definir fuentes explícitas

3. Nunca mezclar paquetes incompatibles entre motores.

4. Asegurar que el documento compile sin warnings relevantes en ambos modos.

5. Mantener un bloque común para paquetes matemáticos (`amsmath`, etc.).

El objetivo es que el mismo `.tex` sea portable y robusto en múltiples entornos, incluyendo compiladores WebAssembly.

------------------------------------------------
Opcion alternativa: generar codigo especifico para un compilador. Quizas podriamos tener un default y en algun lugar a futuro permitir configurarlo, y entre la configuraciones podria estar la de tener compilacion condicional.
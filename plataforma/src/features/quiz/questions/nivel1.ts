import type { Question } from '../types'

export const nivel1Questions: Question[] = [
  {
    id: 'q-l1-preambulo-1',
    lessonId: 'l1-preambulo',
    level: 1,
    prompt: '¿Qué comando carga un paquete, y dónde va?',
    answer: '\\usepackage{...}, en el preámbulo',
    distractors: [
      '\\usepackage{...}, dentro del document',
      '\\loadpackage{...}, en el preámbulo',
      '\\require{...}, antes de la clase',
    ],
    explanation:
      'Los paquetes se cargan con \\usepackage y van siempre en el preámbulo (antes de \\begin{document}). El error “Can be used only in preamble” aparece si se mete dentro del document.',
  },
  {
    id: 'q-l1-idioma-1',
    lessonId: 'l1-idioma-codificacion',
    level: 1,
    prompt: '¿Qué paquete adapta el idioma (guiones, nombres como “Índice”)?',
    answer: '\\usepackage[spanish]{babel}',
    distractors: [
      '\\usepackage[spanish]{idioma}',
      '\\usepackage[T1]{fontenc}',
      '\\usepackage{lmodern}',
    ],
    explanation:
      'babel adapta el idioma. fontenc fija la codificación de fuente (acentos correctos) y lmodern mejora la nitidez, pero ninguno cambia el idioma.',
  },
  {
    id: 'q-l1-tipografia-1',
    lessonId: 'l1-tipografia',
    level: 1,
    prompt: 'Para resaltar con significado (no solo “poner en cursiva”), ¿qué conviene usar?',
    answer: '\\emph{texto}',
    distractors: ['\\textit{texto}', '\\italic{texto}', '\\slanted{texto}'],
    explanation:
      '\\emph marca énfasis semántico y alterna el estilo si se anida. \\textit fuerza cursiva sin significado; \\italic y \\slanted no son los comandos estándar.',
  },
  {
    id: 'q-l1-amsmath-1',
    lessonId: 'l1-amsmath',
    level: 1,
    prompt: 'En un entorno align, ¿qué hace el símbolo &?',
    answer: 'Marca el punto de alineación de cada renglón',
    distractors: [
      'Separa el numerador del denominador',
      'Inserta un espacio horizontal grande',
      'Termina la ecuación y la numera',
    ],
    explanation:
      'En align, & indica dónde alinear (típicamente antes del =) y \\\\ separa renglones. No tiene que ver con fracciones, espacios ni con cerrar la ecuación.',
  },
  {
    id: 'q-l1-tablas-1',
    lessonId: 'l1-tablas',
    level: 1,
    prompt: 'Según las buenas prácticas (booktabs), ¿qué conviene evitar en las tablas?',
    answer: 'Las líneas verticales entre columnas',
    distractors: [
      'Las reglas \\toprule y \\bottomrule',
      'La especificación de columnas {lcr}',
      'El separador de celdas & entre datos',
    ],
    explanation:
      'La regla de oro de booktabs: nada de líneas verticales, y solo reglas horizontales (\\toprule/\\midrule/\\bottomrule). Las columnas y el separador & son imprescindibles.',
  },
  {
    id: 'q-l1-figuras-1',
    lessonId: 'l1-figuras',
    level: 1,
    prompt: '¿Qué comando agrega la leyenda numerada de una figura?',
    answer: '\\caption{...}',
    distractors: ['\\title{...}', '\\legend{...}', '\\figtext{...}'],
    explanation:
      '\\caption{...} dentro del entorno figure genera la leyenda numerada (“Figura 1: …”). \\title es la portada del documento; \\legend y \\figtext no son estándar.',
  },
  {
    id: 'q-l1-referencias-1',
    lessonId: 'l1-referencias',
    level: 1,
    prompt: '¿Por qué no conviene escribir “ver la Sección 2” a mano?',
    answer: 'Si reordenás el documento, el número queda mal',
    distractors: [
      'Porque LaTeX no permite escribir números',
      'Porque “Sección” debe ir siempre en inglés',
      'Porque las secciones no se pueden numerar',
    ],
    explanation:
      'Con \\label/\\ref (o \\cref) LaTeX inserta el número correcto y lo actualiza si reordenás. Escribirlo a mano se desincroniza apenas cambia el orden.',
  },
  {
    id: 'q-l1-geometry-1',
    lessonId: 'l1-diseno-pagina',
    level: 1,
    prompt: '¿Cuál es la forma recomendada de cambiar los márgenes?',
    answer: '\\usepackage[margin=2.5cm]{geometry}',
    distractors: [
      '\\setlength{\\textwidth}{16cm} a mano',
      '\\margin{2.5cm} en el preámbulo',
      '\\renewcommand{\\hoffset}{2.5cm}',
    ],
    explanation:
      'geometry calcula todos los márgenes de forma consistente. Tocar \\textwidth o \\hoffset a mano es frágil y descoordina el resto del diseño; \\margin no existe.',
  },
  {
    id: 'q-l1-simbolos-1',
    lessonId: 'l1-simbolos-operadores',
    level: 1,
    prompt: '¿Cómo se escribe el límite para que NO salga en cursiva como variables?',
    answer: '\\lim',
    distractors: ['lim', '\\limit', '\\Lim'],
    explanation:
      'Los operadores con nombre llevan barra: \\lim, \\sin, \\log. Escribir “lim” en modo math lo compone como un producto de variables (l·i·m) en cursiva.',
  },
  {
    id: 'q-l1-fancyhdr-1',
    lessonId: 'l1-fancyhdr',
    level: 1,
    prompt: '¿Qué hace falta para activar encabezados y pies personalizados con fancyhdr?',
    answer: '\\pagestyle{fancy}',
    distractors: ['\\pagestyle{plain}', '\\fancystyle{on}', '\\usepackage{header}'],
    explanation:
      'Tras cargar fancyhdr, \\pagestyle{fancy} activa el estilo; recién ahí \\fancyhead/\\fancyfoot tienen efecto. plain es el estilo por defecto, sin personalización.',
  },
  {
    id: 'q-l1-tablasx-1',
    lessonId: 'l1-tablas-adaptables',
    level: 1,
    prompt: 'En tabularx, ¿qué hace una columna de tipo X?',
    answer: 'Se estira para ocupar el ancho disponible',
    distractors: [
      'Centra el texto de la columna',
      'Repite la columna varias veces',
      'Oculta la columna en el PDF',
    ],
    explanation:
      'La columna X absorbe el ancho sobrante y ajusta el texto, evitando que la tabla se desborde. Las columnas l/c/r toman el ancho de su contenido.',
  },
  {
    id: 'q-l1-flotantes-1',
    lessonId: 'l1-flotantes-subfiguras',
    level: 1,
    prompt: '¿Qué paquete permite poner varias subfiguras con su propia letra (a), (b)?',
    answer: 'subcaption',
    distractors: ['multifig', 'subfigment', 'floatrow'],
    explanation:
      'subcaption provee el entorno subfigure, cada uno con su \\caption numerado como (a), (b). Los otros nombres no son los estándar para esto.',
  },
  {
    id: 'q-l1-hyperref-1',
    lessonId: 'l1-hyperref',
    level: 1,
    prompt: '¿Qué comando crea un enlace con texto visible distinto de la URL?',
    answer: '\\href{url}{texto}',
    distractors: ['\\url{texto}', '\\link{url}{texto}', '\\hyperlink{url}{texto}'],
    explanation:
      '\\href{url}{texto} muestra “texto” y enlaza a la url. \\url muestra la propia url; \\hyperlink es para destinos internos del documento; \\link no existe.',
  },
  {
    id: 'q-l1-canon-1',
    lessonId: 'l1-canon-preambulo',
    level: 1,
    prompt: 'Según el canon de la plataforma, ¿qué va en el PISO de todo documento en español?',
    answer: 'fontenc, lmodern, babel+es-noshorthands y microtype',
    distractors: [
      'solo babel y amsmath, el resto es opcional',
      'geometry, pgfplots, biblatex y tikz',
      'fontenc y babel; lmodern y microtype son innecesarios',
    ],
    explanation:
      'El PISO va siempre (es gratis y evita bugs): fontenc[T1], lmodern, babel con es-noshorthands y microtype. Lo demás (geometry, pgfplots, biblatex…) es EXTRA: se carga solo si el contenido lo usa.',
  },
  {
    id: 'q-l1-canon-2',
    lessonId: 'l1-canon-preambulo',
    level: 1,
    prompt: '¿En qué orden van hyperref y cleveref?',
    answer: 'hyperref casi al final y cleveref después de él',
    distractors: [
      'cleveref primero y hyperref al final de todo',
      'da igual el orden entre los dos',
      'ambos al principio, antes que el resto',
    ],
    explanation:
      'hyperref se carga casi al final del preámbulo, y cleveref es la única excepción a esa regla: va inmediatamente después de hyperref. Al revés, cleveref no funciona bien.',
  },
  {
    id: 'q-l1-siunitx-1',
    lessonId: 'l1-siunitx',
    level: 1,
    prompt: 'En siunitx v3, ¿cómo se escribe una cantidad con unidad como 10 m/s?',
    answer: '\\qty{10}{\\metre\\per\\second}',
    distractors: [
      '\\SI{10}{\\metre\\per\\second}',
      '\\unit{10 m/s}',
      '\\num{10}{m/s}',
    ],
    explanation:
      '\\qty{número}{unidad} es la forma de v3 (antes era \\SI, ahora desaconsejado). La unidad se arma con macros (\\metre\\per\\second), no como texto. \\unit es solo para la unidad sola y \\num solo para el número.',
  },
]

import type { Question } from '../types'

export const nivel3Questions: Question[] = [
  {
    id: 'q-l3-largos-1',
    lessonId: 'l3-documentos-largos',
    level: 3,
    prompt: '¿Qué clase habilita el comando \\chapter?',
    answer: 'report (o book)',
    distractors: ['article (o letter)', 'beamer (o slides)', 'standalone (o minimal)'],
    explanation:
      'report y book tienen capítulos; article no. beamer es para presentaciones y standalone para una figura suelta: ninguno define \\chapter.',
  },
  {
    id: 'q-l3-pgfplots-1',
    lessonId: 'l3-pgfplots',
    level: 3,
    prompt: '¿Qué comando grafica una función dentro de un entorno axis?',
    answer: '\\addplot[domain=-3:3]{x^2};',
    distractors: ['\\plot[domain=-3:3]{x^2};', '\\draw plot {x^2};', '\\function{x^2}[-3:3];'],
    explanation:
      '\\addplot (de pgfplots) dibuja la expresión en el axis. \\draw plot es TikZ puro (más manual) y los otros no existen. El axis va dentro de un tikzpicture.',
  },
  {
    id: 'q-l3-tikz-1',
    lessonId: 'l3-tikz',
    level: 3,
    prompt: 'En TikZ, ¿cómo se traza una línea entre dos puntos?',
    answer: '\\draw (0,0) -- (2,2);',
    distractors: ['\\line (0,0) (2,2);', '\\draw (0,0) to[line] (2,2)', '\\path[draw] (0,0) => (2,2);'],
    explanation:
      'El comando es \\draw con dos coordenadas unidas por --. \\line no es de TikZ; las otras usan sintaxis inventada (=> no es un operador de path).',
  },
  {
    id: 'q-l3-codigo-1',
    lessonId: 'l3-codigo',
    level: 3,
    prompt: '¿Qué entorno muestra código fuente literal con formato?',
    answer: '\\begin{lstlisting}',
    distractors: ['\\begin{listing}', '\\begin{sourcecode}', '\\begin{codeblock}'],
    explanation:
      'lstlisting es el entorno del paquete listings. Los otros nombres no existen en listings (sí hay un entorno flotante “listing” en otros paquetes, pero no es el del código literal).',
  },
  {
    id: 'q-l3-beamer-1',
    lessonId: 'l3-beamer',
    level: 3,
    prompt: 'En Beamer, ¿qué es una diapositiva?',
    answer: 'Un entorno frame',
    distractors: ['Un entorno slide', 'Un comando \\newframe', 'Una sección \\section'],
    explanation:
      'Cada diapositiva es un entorno frame (con \\frametitle para el título). slide es de otras clases; \\newframe no existe; \\section organiza pero no crea la diapositiva.',
  },
  {
    id: 'q-l3-clases-1',
    lessonId: 'l3-clases',
    level: 3,
    prompt: '¿Dónde van las opciones de clase como 12pt o twocolumn?',
    answer: 'Entre corchetes: \\documentclass[12pt,twocolumn]{article}',
    distractors: [
      'Entre llaves: \\documentclass{12pt}{article}',
      'En un paquete: \\usepackage[12pt]{article}',
      'Con un comando: \\setoption{twocolumn}',
    ],
    explanation:
      'Las opciones globales van entre [ ] antes de la clase. Las llaves son para la clase; \\usepackage es para paquetes; \\setoption no existe.',
  },
  {
    id: 'q-l3-modularizar-1',
    lessonId: 'l3-modularizar',
    level: 3,
    prompt: '¿Qué comando pega el contenido de otro archivo .tex tal cual, en ese punto?',
    answer: '\\input{archivo}',
    distractors: ['\\include{archivo}', '\\import{archivo}', '\\use{archivo}'],
    explanation:
      '\\input inserta el contenido en el lugar. \\include también incluye pero está pensado para capítulos (agrega salto de página y permite \\includeonly); \\import y \\use no son estándar.',
  },
  {
    id: 'q-l3-datos-1',
    lessonId: 'l3-datos',
    level: 3,
    prompt: 'Para graficar mediciones (datos, no una fórmula) con pgfplots se usa…',
    answer: '\\addplot table {...}',
    distractors: ['\\addplot {datos}', '\\plotdata{...}', '\\addtable{...}'],
    explanation:
      '\\addplot table lee datos (de un archivo o en línea con encabezados). \\addplot {expr} es para expresiones; los otros no existen.',
  },
  {
    id: 'q-l3-diagramas-1',
    lessonId: 'l3-diagramas',
    level: 3,
    prompt: '¿Qué librería de TikZ provee estados y transiciones para autómatas?',
    answer: 'automata',
    distractors: ['graphs', 'shapes', 'trees'],
    explanation:
      'La librería automata da \\node[state] y las transiciones. trees es para árboles, shapes para formas y graphs para grafos genéricos.',
  },
  {
    id: 'q-l3-pseudocodigo-1',
    lessonId: 'l3-pseudocodigo',
    level: 3,
    prompt: '¿Qué paquete sirve para escribir pseudocódigo (algoritmos)?',
    answer: 'algorithm2e',
    distractors: ['listings', 'minted', 'verbatim'],
    explanation:
      'algorithm2e (o algorithmicx) compone algoritmos en pseudocódigo. listings, minted y verbatim muestran código fuente literal, no pseudocódigo estructurado.',
  },
  {
    id: 'q-l3-beamer-av-1',
    lessonId: 'l3-beamer-avanzado',
    level: 3,
    prompt: 'En Beamer, ¿cómo se hace que un ítem aparezca recién en el paso 2?',
    answer: '\\item<2->',
    distractors: ['\\item\\pause2', '\\step{2}', '\\item[2]'],
    explanation:
      'La especificación de overlay `<2->` muestra el ítem desde el paso 2. \\pause avanza un paso (sin número); \\item[...] cambia la etiqueta, no el overlay.',
  },
]

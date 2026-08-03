import type { Question } from '../types'

export const nivel2Questions: Question[] = [
  {
    id: 'q-l2-teoremas-1',
    lessonId: 'l2-teoremas',
    level: 2,
    prompt: '¿Qué comando define un entorno de teorema numerado?',
    answer: '\\newtheorem{teo}{Teorema}',
    distractors: ['\\newenvironment{teo}{Teorema}', '\\theorem{teo}{Teorema}', '\\declaretheorem{Teorema}'],
    explanation:
      '\\newtheorem{nombre}{Etiqueta} (de amsthm) crea el entorno y su contador. \\newenvironment define entornos genéricos sin numeración de teorema; \\theorem no existe así; \\declaretheorem es de thmtools, no del núcleo de amsthm.',
  },
  {
    id: 'q-l2-numeracion-1',
    lessonId: 'l2-numeracion',
    level: 2,
    prompt: '¿Cómo hacés que un teorema reinicie su numeración en cada sección (2.1, 2.2…)?',
    answer: '\\newtheorem{teo}{Teorema}[section]',
    distractors: [
      '\\newtheorem{teo}[section]{Teorema}',
      '\\numberwithin{teo}{section}',
      '\\setcounter{teo}{section}',
    ],
    explanation:
      'El argumento opcional [section] al final liga el contador a la sección. Puesto antes (\\newtheorem{teo}[otro]{...}) significa “compartir contador”. \\numberwithin sirve para equation; \\setcounter fija un valor, no lo liga.',
  },
  {
    id: 'q-l2-mate-av-1',
    lessonId: 'l2-matematica-avanzada',
    level: 2,
    prompt: '¿Qué entorno escribe una matriz entre paréntesis?',
    answer: '\\begin{pmatrix}',
    distractors: ['\\begin{matrix*}', '\\begin{parenmatrix}', '\\begin{matrix}()'],
    explanation:
      'pmatrix (de amsmath) pone los paréntesis. matrix existe pero va sin delimitadores; bmatrix usa corchetes. parenmatrix no existe.',
  },
  {
    id: 'q-l2-enumitem-1',
    lessonId: 'l2-listas-enumitem',
    level: 2,
    prompt: '¿Cómo se personaliza la etiqueta de una enumerate (p. ej. (a), (b)…)?',
    answer: '\\begin{enumerate}[label=(\\alph*)]',
    distractors: [
      '\\begin{enumerate}{label=(\\alph*)}',
      '\\begin{enumerate}[type=(\\alph*)]',
      '\\renewcommand{\\labelenumi}{alph}',
    ],
    explanation:
      'Con enumitem, las opciones van entre [ ] y la clave es label. Las llaves { } no sirven para opciones, type no es la clave correcta, y la redefinición manual de \\labelenumi es más limitada y propensa a errores.',
  },
  {
    id: 'q-l2-biblio-1',
    lessonId: 'l2-bibliografia',
    level: 2,
    prompt: '¿Qué comando inserta una cita en el texto?',
    answer: '\\cite{clave}',
    distractors: ['\\ref{clave}', '\\bibitem{clave}', '\\quote{clave}'],
    explanation:
      '\\cite{clave} referencia una entrada de la bibliografía. \\ref es para secciones/figuras; \\bibitem declara la entrada (no la cita); \\quote no existe para esto.',
  },
  {
    id: 'q-l2-macros-1',
    lessonId: 'l2-macros',
    level: 2,
    prompt: 'Una macro con un argumento se define así:',
    answer: '\\newcommand{\\abs}[1]{\\left|#1\\right|}',
    distractors: [
      '\\newcommand{\\abs}(1){\\left|#1\\right|}',
      '\\newcommand{\\abs}{[1]\\left|#1\\right|}',
      '\\def\\abs[1]{\\left|#1\\right|}',
    ],
    explanation:
      'La cantidad de argumentos va entre [ ] después del nombre, y se usan como #1, #2… Los paréntesis no sirven, las llaves mal puestas tampoco, y \\def usa otra sintaxis (\\def\\abs#1{...}).',
  },
  {
    id: 'q-l2-mathtools-1',
    lessonId: 'l2-mathtools',
    level: 2,
    prompt: '¿Qué comando de mathtools define delimitadores que escalan solos (como el valor absoluto)?',
    answer: '\\DeclarePairedDelimiter',
    distractors: ['\\DeclareMathOperator', '\\newcommand', '\\newdelimiter'],
    explanation:
      '\\DeclarePairedDelimiter (mathtools) crea comandos como \\abs cuyos delimitadores crecen con el contenido. \\DeclareMathOperator define operadores con nombre; \\newcommand es genérico; \\newdelimiter no existe.',
  },
  {
    id: 'q-l2-cajas-1',
    lessonId: 'l2-cajas',
    level: 2,
    prompt: '¿Qué paquete es el más completo para cajas con color, título y marco?',
    answer: 'tcolorbox',
    distractors: ['fancybox', 'boxedminipage', 'colorbox'],
    explanation:
      'tcolorbox arma cajas ricas (color de fondo y marco, título, partes). Los otros son mucho más limitados o solo dan un fondo/borde simple.',
  },
  {
    id: 'q-l2-biblatex-1',
    lessonId: 'l2-bibliografia-moderna',
    level: 2,
    prompt: 'Con biblatex, ¿cómo se imprime la lista de referencias?',
    answer: '\\printbibliography',
    distractors: ['\\bibliography{refs}', '\\printbib', '\\makebibliography'],
    explanation:
      'Con biblatex la lista se genera con \\printbibliography. \\bibliography{...} es del flujo clásico (bibtex); los otros dos no existen.',
  },
  {
    id: 'q-l2-indices-1',
    lessonId: 'l2-indices',
    level: 2,
    prompt: '¿Qué comando marca un término para que aparezca en el índice alfabético?',
    answer: '\\index{término}',
    distractors: ['\\printindex', '\\makeindex', '\\glossary{término}'],
    explanation:
      '\\index{...} marca el término. \\makeindex activa la recolección (preámbulo) y \\printindex imprime el índice; \\glossary es para glosarios.',
  },
]

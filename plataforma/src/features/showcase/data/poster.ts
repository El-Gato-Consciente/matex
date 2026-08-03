import { posterMatex } from './matexAsts'
import type { ExemplarInput } from '../types'

/**
 * Ejemplar · Póster (clase tikzposter). Póster A0 con título, columnas y bloques
 * de contenido, ideal para una jornada o congreso.
 */
export const poster = {
  id: 'ex-poster-montecarlo',
  title: 'Póster: estimación de π',
  docType: 'Póster (tikzposter)',
  description:
    'Póster científico A0 con la clase tikzposter: título con autor e institución, tema visual, y contenido organizado en columnas y bloques (\\block). Modelo para presentar un trabajo en una jornada.',
  techniques: [
    'clase tikzposter (A0)',
    'tema visual (\\usetheme)',
    'columnas y \\block',
    'título con autor/institución',
  ],
  source: [
    '\\documentclass[25pt,a0paper,portrait]{tikzposter}',
    '\\usepackage{lmodern}',
    '\\usepackage{microtype}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage[spanish,es-noshorthands]{babel}',
    '\\usepackage{amsmath}',
    '',
    '\\usetheme{Default}',
    '\\usecolorstyle{Britain}',
    '',
    '\\title{Estimación de $\\pi$ por Monte Carlo}',
    '\\author{Estudiante}',
    '\\institute{Laboratorio de Cálculo · Lic. en Matemática}',
    '',
    '\\begin{document}',
    '\\maketitle',
    '',
    '\\begin{columns}',
    '  \\column{0.5}',
    '  \\block{La idea}{',
    '    Un punto al azar en el cuadrado $[0,1]^2$ cae dentro del cuarto de círculo',
    '    de radio $1$ con probabilidad igual a su área, $\\pi/4$.',
    '  }',
    '  \\block{El estimador}{',
    '    Si de $N$ puntos uniformes, $M$ caen dentro del cuarto de círculo, entonces',
    '    \\[ \\hat{\\pi} = \\frac{4M}{N} \\xrightarrow[N\\to\\infty]{} \\pi. \\]',
    '  }',
    '',
    '  \\column{0.5}',
    '  \\block{Resultados}{',
    '    Con $N = 10^6$ muestras obtuvimos $\\hat{\\pi} \\approx 3{,}1413$, con un error',
    '    del orden de $10^{-3}$.',
    '  }',
    '  \\block{Conclusión}{',
    '    El método es simple y general, pero converge lento ($1/\\sqrt{N}$): para una',
    '    cifra más hace falta multiplicar $N$ por cien.',
    '  }',
    '\\end{columns}',
    '',
    '\\end{document}',
    '',
  ].join('\n'),
  matex: posterMatex,
} satisfies ExemplarInput

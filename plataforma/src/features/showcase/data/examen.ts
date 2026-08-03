import { examenMatex } from './matexAsts'
import type { ExemplarInput } from '../types'

/**
 * Ejemplar · Examen (clase exam). Preguntas con puntajes, totales automáticos y
 * **soluciones** que se muestran con la opción `answers` (versión docente) o se
 * ocultan (versión alumno).
 */
export const examen = {
  id: 'ex-examen-parcial',
  title: 'Examen: parcial de Análisis',
  docType: 'Examen (exam)',
  description:
    'Parcial con la clase exam: preguntas con puntaje, suma automática de puntos, encabezado/pie y soluciones que se muestran (opción answers) u ocultan según la versión. Modelo para tomar o resolver un examen.',
  techniques: [
    'clase exam',
    'questions / question[pts]',
    'puntajes automáticos (addpoints)',
    'soluciones (answers)',
    'encabezado y pie',
  ],
  source: [
    '\\documentclass[addpoints,answers,11pt]{exam}',
    '\\usepackage{microtype}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage{lmodern}',
    '\\usepackage[spanish,es-noshorthands]{babel}',
    '\\usepackage{amsmath}',
    '',
    '\\pagestyle{headandfoot}',
    '\\header{Análisis I}{Parcial 1}{\\today}',
    '\\footer{}{Página \\thepage\\ de \\numpages}{}',
    '\\pointsinrightmargin',
    '',
    '\\begin{document}',
    '',
    '\\begin{center}',
    '  {\\large\\textbf{Análisis I — Primer parcial}}',
    '\\end{center}',
    '\\vspace{0.5em}',
    'Nombre: \\makebox[7cm]{\\hrulefill} \\hfill Puntaje total: \\numpoints',
    '',
    '\\begin{questions}',
    '',
    '\\question[10] Calculá el límite notable $\\displaystyle \\lim_{x \\to 0} \\frac{\\sin x}{x}$.',
    '\\begin{solution}',
    '  Vale $1$. Es un límite fundamental (geométrico / regla de L\'Hôpital).',
    '\\end{solution}',
    '',
    '\\question[15] Derivá $f(x) = x^3 - 2x + 1$ y hallá sus puntos críticos.',
    '\\begin{solution}',
    '  $f\'(x) = 3x^2 - 2$, que se anula en $x = \\pm\\sqrt{2/3}$.',
    '\\end{solution}',
    '',
    '\\question[20] Demostrá que $\\sqrt{2}$ es irracional.',
    '\\begin{solution}',
    '  Por contradicción: si $\\sqrt{2} = p/q$ con la fracción irreducible, entonces',
    '  $2q^2 = p^2$, así que $p$ es par, $p = 2k$, y $2q^2 = 4k^2$, luego $q$ también',
    '  es par. Eso contradice que $p/q$ sea irreducible.',
    '\\end{solution}',
    '',
    '\\end{questions}',
    '\\end{document}',
    '',
  ].join('\n'),
  matex: examenMatex,
} satisfies ExemplarInput

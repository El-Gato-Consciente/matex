import { cartaMatex } from './matexAsts'
import type { ExemplarInput } from '../types'

/**
 * Ejemplar · Carta formal (clase letter). Muestra la estructura propia de la
 * clase: `\address`, `\signature`, `\opening`, `\closing`, `\encl`.
 */
export const carta = {
  id: 'ex-carta-formal',
  title: 'Carta formal',
  docType: 'Carta (letter)',
  description:
    'Carta formal con la clase letter: remitente (\\address), destinatario, apertura y cierre (\\opening/\\closing), firma (\\signature) y anexos (\\encl). Modelo para una solicitud o nota administrativa.',
  techniques: [
    'clase letter',
    '\\address / \\signature',
    '\\opening / \\closing',
    '\\encl (anexos)',
  ],
  source: [
    '\\documentclass[11pt]{letter}',
    '\\usepackage{microtype}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage{lmodern}',
    '\\usepackage[spanish,es-noshorthands]{babel}',
    '',
    '\\address{Nombre Apellido \\\\ Calle Falsa 123 \\\\ Ciudad, País \\\\ correo@ejemplo.com}',
    '\\signature{Nombre Apellido \\\\ Estudiante de Lic. en Matemática}',
    '\\date{\\today}',
    '',
    '\\begin{document}',
    '\\begin{letter}{Secretaría Académica \\\\ Universidad Nacional \\\\ Departamento de Matemática}',
    '',
    '\\opening{Estimada Secretaría:}',
    '',
    '\\textbf{Asunto:} solicitud de constancia de materias aprobadas.',
    '',
    'Por la presente, y a los efectos de gestionar una beca, solicito una',
    'constancia de las materias aprobadas en la carrera de Licenciatura en',
    'Matemática, con sus respectivas calificaciones y fechas.',
    '',
    'Quedo a disposición para cualquier información adicional y agradezco desde ya',
    'su colaboración.',
    '',
    '\\closing{Saludos cordiales,}',
    '',
    '\\encl{Copia del documento de identidad.}',
    '\\end{letter}',
    '\\end{document}',
    '',
  ].join('\n'),
  matex: cartaMatex,
} satisfies ExemplarInput

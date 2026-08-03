import { cvMatex } from './matexAsts'
import type { ExemplarInput } from '../types'

/**
 * Ejemplar · CV (clase moderncv). Currículum con un estilo y color de moderncv,
 * datos de contacto y secciones con `\cventry`/`\cvitem`.
 */
export const cv = {
  id: 'ex-cv-moderncv',
  title: 'CV con moderncv',
  docType: 'Currículum (moderncv)',
  description:
    'Currículum vitae con la clase moderncv: estilo y color configurables, datos de contacto con íconos, y secciones de formación, habilidades y proyectos con \\cventry y \\cvitem. Modelo listo para personalizar.',
  techniques: [
    'clase moderncv',
    '\\moderncvstyle / \\moderncvcolor',
    'datos de contacto',
    '\\cventry y \\cvitem',
  ],
  source: [
    '\\documentclass[11pt,a4paper,sans]{moderncv}',
    '\\usepackage{lmodern}',
    '\\usepackage{microtype}',
    '\\moderncvstyle{classic}',
    '\\moderncvcolor{blue}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage[spanish,es-noshorthands]{babel}',
    '\\usepackage[scale=0.82]{geometry}',
    '',
    '\\name{Nombre}{Apellido}',
    '\\title{Estudiante de Lic. en Matemática}',
    '\\email{correo@ejemplo.com}',
    '',
    '\\begin{document}',
    '\\makecvtitle',
    '',
    '\\section{Formación}',
    '\\cventry{2022--actualidad}{Lic. en Matemática}{Universidad Nacional}{}{}{Promedio 9{,}1.}',
    '\\cventry{2021}{Bachiller}{Colegio Nacional}{}{}{Abanderado.}',
    '',
    '\\section{Habilidades}',
    '\\cvitem{Programación}{Python, TypeScript, C.}',
    '\\cvitem{Tipografía}{LaTeX (avanzado): documentos largos, matemática, gráficos.}',
    '\\cvitem{Idiomas}{Español (nativo), Inglés (B2).}',
    '',
    '\\section{Proyectos}',
    '\\cvitem{Matex}{Plataforma gamificada para aprender LaTeX (TypeScript + React).}',
    '\\cvitem{Ayudantía}{Tutor de Análisis I durante 2023.}',
    '',
    '\\end{document}',
    '',
  ].join('\n'),
  matex: cvMatex,
} satisfies ExemplarInput

import type { Template } from '../types'
import { tesinaTplMatex } from './matexAsts'

/** Plantillas **multi-archivo**: scaffolds de proyectos ya modularizados. */
export const proyectos: readonly Template[] = [
  {
    id: 'tesina-modular',
    title: 'Tesina modular (multi-archivo)',
    category: 'Proyecto',
    description:
      'Scaffold de un trabajo largo ya dividido en archivos: el principal (main.tex) ensambla los capítulos (capitulos/*.tex) con \\include, más un refs.bib. Editá cada archivo desde el panel.',
    mainFile: 'main.tex',
    files: [
      {
        path: 'capitulos/introduccion.tex',
        content: [
          '\\chapter{Introducción}',
          '',
          'Presentá acá el tema, el contexto y los objetivos del trabajo.',
          'Para citar una fuente: \\cite{ejemplo}.',
          '',
        ].join('\n'),
      },
      {
        path: 'capitulos/desarrollo.tex',
        content: [
          '\\chapter{Desarrollo}',
          '',
          'El cuerpo del trabajo: secciones, ecuaciones, tablas y figuras.',
          '',
          '\\section{Una sección}',
          'Escribí acá tu contenido.',
          '',
        ].join('\n'),
      },
      {
        path: 'capitulos/conclusiones.tex',
        content: ['\\chapter{Conclusiones}', '', 'Resumí los resultados y cerrá el trabajo.', ''].join('\n'),
      },
      {
        path: 'refs.bib',
        content: [
          '@book{ejemplo, author={Apellido, Nombre}, title={Título del libro},',
          '  year={2020}, publisher={Editorial}}',
          '',
        ].join('\n'),
      },
    ],
    source: [
      '\\documentclass[11pt,a4paper]{report}',
      '\\usepackage[T1]{fontenc}',
      '\\usepackage{lmodern}',
      '\\usepackage[spanish,es-noshorthands]{babel}',
      '\\usepackage{microtype}',
      '\\usepackage[a4paper,margin=2.5cm]{geometry}',
      '\\usepackage{amsmath, amssymb, amsthm}',
      '\\usepackage[backend=biber, style=numeric-comp, sorting=none]{biblatex}',
      '\\addbibresource{refs.bib}',
      '\\usepackage[hidelinks]{hyperref}',
      '\\hypersetup{unicode, pdftitle={Tesina}, pdfauthor={Estudiante}}',
      '',
      '\\title{Título de la tesina}',
      '\\author{Tu nombre}',
      '\\date{\\today}',
      '',
      '\\begin{document}',
      '\\maketitle',
      '\\tableofcontents',
      '',
      '% Cada capítulo vive en su archivo (panel de Archivos). Editalos y agregá más.',
      '\\include{capitulos/introduccion}',
      '\\include{capitulos/desarrollo}',
      '\\include{capitulos/conclusiones}',
      '',
      '\\printbibliography[heading=bibintoc]',
      '',
      '\\end{document}',
      '',
    ].join('\n'),
    matex: tesinaTplMatex,
  },
]

/**
 * Catálogo de comandos y entornos LaTeX para el autocompletado del editor.
 * Curado a partir de lo que enseña el curso (las tablas `commands` de las
 * lecciones) + lo esencial. Cada entrada trae una descripción corta; las que
 * tienen `template` insertan un snippet con campos `${}` (Tab para saltar).
 */

export interface LatexCommand {
  /** Nombre con la barra, p. ej. `\\section`. */
  name: string
  /** Snippet de inserción (empieza con la barra). Si falta, inserta `name`. */
  template?: string
  detail: string
}

export interface LatexEnvironment {
  name: string
  /** Cuerpo tras `\begin{` (incluye el cierre `\end{...}`). */
  template: string
  detail: string
}

export const LATEX_COMMANDS: readonly LatexCommand[] = [
  // ── Preámbulo ──
  { name: '\\documentclass', template: '\\documentclass{${article}}', detail: 'tipo de documento' },
  { name: '\\usepackage', template: '\\usepackage{${}}', detail: 'cargar un paquete' },
  { name: '\\title', template: '\\title{${}}', detail: 'título del documento' },
  { name: '\\author', template: '\\author{${}}', detail: 'autor/es' },
  { name: '\\date', template: '\\date{${\\today}}', detail: 'fecha' },
  { name: '\\maketitle', detail: 'imprime la portada' },
  { name: '\\newcommand', template: '\\newcommand{${\\cmd}}{${}}', detail: 'definir una macro' },
  { name: '\\renewcommand', template: '\\renewcommand{${\\cmd}}{${}}', detail: 'redefinir una macro' },
  { name: '\\newtheorem', template: '\\newtheorem{${teorema}}{${Teorema}}', detail: 'definir un entorno de teorema' },
  { name: '\\addbibresource', template: '\\addbibresource{${refs.bib}}', detail: 'archivo de bibliografía (biblatex)' },

  // ── Entornos ──
  { name: '\\begin', template: '\\begin{${}}', detail: 'abrir un entorno' },
  { name: '\\end', template: '\\end{${}}', detail: 'cerrar un entorno' },

  // ── Estructura ──
  { name: '\\part', template: '\\part{${}}', detail: 'parte' },
  { name: '\\chapter', template: '\\chapter{${}}', detail: 'capítulo (report/book)' },
  { name: '\\section', template: '\\section{${}}', detail: 'sección' },
  { name: '\\subsection', template: '\\subsection{${}}', detail: 'subsección' },
  { name: '\\subsubsection', template: '\\subsubsection{${}}', detail: 'subsubsección' },
  { name: '\\paragraph', template: '\\paragraph{${}}', detail: 'párrafo con título' },
  { name: '\\appendix', detail: 'a partir de acá, apéndices A, B, C…' },
  { name: '\\tableofcontents', detail: 'índice general' },
  { name: '\\listoffigures', detail: 'índice de figuras' },
  { name: '\\listoftables', detail: 'índice de tablas' },

  // ── Texto y énfasis ──
  { name: '\\textbf', template: '\\textbf{${}}', detail: 'negrita' },
  { name: '\\emph', template: '\\emph{${}}', detail: 'énfasis (recomendado)' },
  { name: '\\textit', template: '\\textit{${}}', detail: 'cursiva' },
  { name: '\\texttt', template: '\\texttt{${}}', detail: 'monoespaciada' },
  { name: '\\textsc', template: '\\textsc{${}}', detail: 'versalitas' },
  { name: '\\underline', template: '\\underline{${}}', detail: 'subrayado' },
  { name: '\\footnote', template: '\\footnote{${}}', detail: 'nota al pie' },
  { name: '\\item', detail: 'elemento de lista' },
  { name: '\\item[]', template: '\\item[${}] ', detail: 'elemento con etiqueta' },

  // ── Referencias, enlaces, citas ──
  { name: '\\label', template: '\\label{${}}', detail: 'marca para referenciar' },
  { name: '\\ref', template: '\\ref{${}}', detail: 'referencia por número' },
  { name: '\\eqref', template: '\\eqref{${}}', detail: 'referencia a ecuación (amsmath)' },
  { name: '\\cref', template: '\\cref{${}}', detail: 'referencia con tipo (cleveref)' },
  { name: '\\cite', template: '\\cite{${}}', detail: 'cita' },
  { name: '\\textcite', template: '\\textcite{${}}', detail: 'cita en el texto (biblatex)' },
  { name: '\\parencite', template: '\\parencite{${}}', detail: 'cita entre paréntesis (biblatex)' },
  { name: '\\printbibliography', detail: 'imprime la bibliografía (biblatex)' },
  { name: '\\href', template: '\\href{${url}}{${texto}}', detail: 'enlace con texto' },
  { name: '\\url', template: '\\url{${}}', detail: 'URL como enlace' },

  // ── Figuras, tablas, gráficos ──
  { name: '\\includegraphics', template: '\\includegraphics[width=0.6\\linewidth]{${}}', detail: 'insertar imagen' },
  { name: '\\caption', template: '\\caption{${}}', detail: 'leyenda' },
  { name: '\\centering', detail: 'centra el contenido' },
  { name: '\\toprule', detail: 'regla superior (booktabs)' },
  { name: '\\midrule', detail: 'regla media (booktabs)' },
  { name: '\\bottomrule', detail: 'regla inferior (booktabs)' },
  { name: '\\multicolumn', template: '\\multicolumn{${2}}{${c}}{${}}', detail: 'celda que abarca columnas' },
  { name: '\\multirow', template: '\\multirow{${2}}{*}{${}}', detail: 'celda que abarca filas' },
  { name: '\\addplot', template: '\\addplot[domain=${-3:3}]{${x^2}};', detail: 'graficar (pgfplots)' },
  { name: '\\input', template: '\\input{${}}', detail: 'insertar archivo' },
  { name: '\\include', template: '\\include{${}}', detail: 'incluir capítulo (con salto de página)' },
  { name: '\\lstinputlisting', template: '\\lstinputlisting{${}}', detail: 'insertar archivo de código' },

  // ── Matemática (amsmath) ──
  { name: '\\frac', template: '\\frac{${}}{${}}', detail: 'fracción' },
  { name: '\\dfrac', template: '\\dfrac{${}}{${}}', detail: 'fracción grande' },
  { name: '\\sqrt', template: '\\sqrt{${}}', detail: 'raíz cuadrada' },
  { name: '\\sum', template: '\\sum_{${}}^{${}}', detail: 'sumatoria' },
  { name: '\\prod', template: '\\prod_{${}}^{${}}', detail: 'productoria' },
  { name: '\\int', template: '\\int_{${}}^{${}}', detail: 'integral' },
  { name: '\\lim', template: '\\lim_{${}}', detail: 'límite' },
  { name: '\\text', template: '\\text{${}}', detail: 'texto dentro del modo math' },
  { name: '\\left', detail: 'delimitador izquierdo que escala' },
  { name: '\\right', detail: 'delimitador derecho que escala' },
  { name: '\\mathbb', template: '\\mathbb{${R}}', detail: 'conjuntos de pizarra ℝ, ℕ…' },
  { name: '\\mathcal', template: '\\mathcal{${}}', detail: 'letras caligráficas' },
  { name: '\\operatorname', template: '\\operatorname{${}}', detail: 'operador con nombre propio' },
  { name: '\\infty', detail: 'infinito ∞' },
  { name: '\\cdot', detail: 'punto de multiplicación ·' },
  { name: '\\times', detail: 'producto ×' },
  { name: '\\leq', detail: 'menor o igual ≤' },
  { name: '\\geq', detail: 'mayor o igual ≥' },
  { name: '\\neq', detail: 'distinto ≠' },
  { name: '\\to', detail: 'flecha →' },
  { name: '\\in', detail: 'pertenece ∈' },
  { name: '\\subset', detail: 'subconjunto ⊂' },
  { name: '\\partial', detail: 'derivada parcial ∂' },
  { name: '\\nabla', detail: 'nabla ∇' },
  { name: '\\sin', detail: 'seno' },
  { name: '\\cos', detail: 'coseno' },
  { name: '\\log', detail: 'logaritmo' },
  { name: '\\qquad', detail: 'espacio horizontal grande' },

  // ── Griego ──
  { name: '\\alpha', detail: 'α' },
  { name: '\\beta', detail: 'β' },
  { name: '\\gamma', detail: 'γ' },
  { name: '\\delta', detail: 'δ' },
  { name: '\\epsilon', detail: 'ε' },
  { name: '\\theta', detail: 'θ' },
  { name: '\\lambda', detail: 'λ' },
  { name: '\\mu', detail: 'μ' },
  { name: '\\pi', detail: 'π' },
  { name: '\\sigma', detail: 'σ' },
  { name: '\\phi', detail: 'φ' },
  { name: '\\omega', detail: 'ω' },
  { name: '\\Delta', detail: 'Δ' },
  { name: '\\Sigma', detail: 'Σ' },
  { name: '\\Omega', detail: 'Ω' },
]

export const LATEX_ENVIRONMENTS: readonly LatexEnvironment[] = [
  { name: 'itemize', template: 'itemize}\n\t\\item ${}\n\\end{itemize}', detail: 'lista con viñetas' },
  { name: 'enumerate', template: 'enumerate}\n\t\\item ${}\n\\end{enumerate}', detail: 'lista numerada' },
  { name: 'description', template: 'description}\n\t\\item[${}] ${}\n\\end{description}', detail: 'lista término–definición' },
  { name: 'equation', template: 'equation}\n\t${}\n\\end{equation}', detail: 'ecuación numerada' },
  { name: 'align', template: 'align}\n\t${} &= ${} \\\\\n\\end{align}', detail: 'ecuaciones alineadas' },
  { name: 'align*', template: 'align*}\n\t${} &= ${} \\\\\n\\end{align*}', detail: 'alineadas, sin numerar' },
  { name: 'gather', template: 'gather}\n\t${}\n\\end{gather}', detail: 'ecuaciones centradas' },
  { name: 'cases', template: 'cases}\n\t${} & \\text{si } ${} \\\\\n\\end{cases}', detail: 'definición por casos' },
  { name: 'matrix', template: 'matrix}\n\t${} & ${} \\\\\n\\end{matrix}', detail: 'matriz sin delimitadores' },
  { name: 'pmatrix', template: 'pmatrix}\n\t${} & ${} \\\\\n\\end{pmatrix}', detail: 'matriz con paréntesis' },
  { name: 'bmatrix', template: 'bmatrix}\n\t${} & ${} \\\\\n\\end{bmatrix}', detail: 'matriz con corchetes' },
  { name: 'figure', template: 'figure}[h]\n\t\\centering\n\t${}\n\t\\caption{${}}\n\\end{figure}', detail: 'figura flotante' },
  { name: 'table', template: 'table}[h]\n\t\\centering\n\t${}\n\t\\caption{${}}\n\\end{table}', detail: 'tabla flotante' },
  { name: 'tabular', template: 'tabular}{${lr}}\n\t\\toprule\n\t${} \\\\\n\t\\bottomrule\n\\end{tabular}', detail: 'tabla' },
  { name: 'tabularx', template: 'tabularx}{\\linewidth}{${l X}}\n\t${} \\\\\n\\end{tabularx}', detail: 'tabla de ancho fijo' },
  { name: 'theorem', template: 'theorem}\n\t${}\n\\end{theorem}', detail: 'teorema (amsthm)' },
  { name: 'proof', template: 'proof}\n\t${}\n\\end{proof}', detail: 'demostración (amsthm)' },
  { name: 'lstlisting', template: 'lstlisting}[language=${Python}]\n${}\n\\end{lstlisting}', detail: 'bloque de código (listings)' },
  { name: 'verbatim', template: 'verbatim}\n${}\n\\end{verbatim}', detail: 'texto literal' },
  { name: 'center', template: 'center}\n\t${}\n\\end{center}', detail: 'centrado' },
  { name: 'quote', template: 'quote}\n\t${}\n\\end{quote}', detail: 'cita en bloque' },
  { name: 'abstract', template: 'abstract}\n\t${}\n\\end{abstract}', detail: 'resumen' },
  { name: 'frame', template: 'frame}{${}}\n\t${}\n\\end{frame}', detail: 'diapositiva (beamer)' },
  { name: 'columns', template: 'columns}\n\t\\begin{column}{0.5\\textwidth}\n\t\t${}\n\t\\end{column}\n\\end{columns}', detail: 'columnas (beamer)' },
  { name: 'thebibliography', template: 'thebibliography}{9}\n\t\\bibitem{${clave}} ${}\n\\end{thebibliography}', detail: 'bibliografía autocontenida' },
]

export interface LatexPackage {
  name: string
  detail: string
}

/**
 * Paquetes de uso frecuente, para autocompletar dentro de `\usepackage{...}`.
 * Curados según lo que enseña el curso y el canon (`estandares.tex`).
 */
export const LATEX_PACKAGES: readonly LatexPackage[] = [
  // Piso / idioma / tipografía
  { name: 'fontenc', detail: 'codificación de fuente ([T1])' },
  { name: 'lmodern', detail: 'fuentes vectoriales Latin Modern' },
  { name: 'babel', detail: 'idioma ([spanish,es-noshorthands])' },
  { name: 'microtype', detail: 'pulido tipográfico' },
  { name: 'csquotes', detail: 'comillas por idioma (\\enquote)' },
  { name: 'inputenc', detail: 'codificación de entrada (redundante desde 2018)' },
  { name: 'fontspec', detail: 'fuentes del sistema (XeLaTeX/LuaLaTeX)' },
  // Matemática
  { name: 'amsmath', detail: 'matemática (entornos, espaciado)' },
  { name: 'amssymb', detail: 'símbolos (\\mathbb, \\leq…)' },
  { name: 'amsthm', detail: 'teoremas y demostraciones' },
  { name: 'mathtools', detail: 'superconjunto de amsmath' },
  { name: 'siunitx', detail: 'números y unidades (\\num, \\qty)' },
  { name: 'bm', detail: 'negrita matemática (vectores)' },
  // Tablas
  { name: 'booktabs', detail: 'tablas de calidad (\\toprule…)' },
  { name: 'tabularx', detail: 'columnas de ancho automático' },
  { name: 'longtable', detail: 'tablas que cruzan páginas' },
  { name: 'multirow', detail: 'celdas que abarcan filas' },
  { name: 'array', detail: 'tipos de columna a medida' },
  // Gráficos
  { name: 'graphicx', detail: '\\includegraphics' },
  { name: 'tikz', detail: 'gráficos vectoriales' },
  { name: 'pgfplots', detail: 'graficar funciones/datos' },
  { name: 'caption', detail: 'estilo de leyendas' },
  { name: 'subcaption', detail: 'subfiguras' },
  { name: 'float', detail: 'opción [H] de posición' },
  { name: 'xcolor', detail: 'color' },
  // Diseño de página
  { name: 'geometry', detail: 'márgenes y papel' },
  { name: 'setspace', detail: 'interlineado' },
  { name: 'parskip', detail: 'párrafos con espacio, sin sangría' },
  { name: 'enumitem', detail: 'listas a medida' },
  { name: 'fancyhdr', detail: 'encabezados y pies' },
  { name: 'titlesec', detail: 'formato de títulos' },
  // Cajas / código
  { name: 'tcolorbox', detail: 'cajas con color y título' },
  { name: 'mdframed', detail: 'marcos que cortan página' },
  { name: 'listings', detail: 'mostrar código' },
  { name: 'minted', detail: 'código resaltado (requiere shell-escape)' },
  // Referencias / bibliografía / índices
  { name: 'hyperref', detail: 'enlaces y metadatos (casi último)' },
  { name: 'cleveref', detail: 'referencias con tipo (después de hyperref)' },
  { name: 'biblatex', detail: 'bibliografía moderna (con biber)' },
  { name: 'natbib', detail: 'bibliografía clásica (BibTeX)' },
  { name: 'makeidx', detail: 'índice alfabético' },
  { name: 'glossaries', detail: 'glosarios y acrónimos' },
  // Diagnóstico
  { name: 'nag', detail: 'avisa comandos obsoletos ([l2tabu,orthodox])' },
  { name: 'todonotes', detail: '\\todo{...} y \\listoftodos' },
]

/**
 * Strip MathLive-internal \placeholder{} commands before passing latex to KaTeX.
 * \placeholder{} is MathLive's tab-stop marker and is not valid KaTeX.
 * We replace with \Box (□) so the formula still renders visually meaningful.
 */
export function renderableLatex(latex: string): string {
  return latex.replace(/\\placeholder\{[^}]*\}/g, '\\Box')
}

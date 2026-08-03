/**
 * Construye un PDF mínimo y válido (ASCII) a partir de líneas de texto.
 *
 * Es una utilidad **pura** usada por el `MockCompiler` para que el preview
 * muestre algo real sin un backend de LaTeX. Calcula los offsets de la tabla
 * `xref` a partir de las longitudes, así que el PDF es correcto y abre en PDF.js.
 *
 * Restricción: el texto debe ser ASCII (offsets calculados con longitud de
 * string). Suficiente para un mock; el backend real produce PDFs de verdad.
 */
function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

export function buildMinimalPdf(lines: readonly string[]): Uint8Array {
  const safeLines = lines.length > 0 ? lines : ['']
  const content =
    'BT /F1 14 Tf 50 780 Td 18 TL\n' +
    safeLines
      .map((line, index) => `${index === 0 ? '' : 'T* '}(${escapePdfText(line)}) Tj`)
      .join('\n') +
    '\nET'

  const bodyObjects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  const header = '%PDF-1.4\n'
  const offsets: number[] = []
  let body = ''
  bodyObjects.forEach((object, index) => {
    offsets.push(header.length + body.length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })

  const xrefStart = header.length + body.length
  const size = bodyObjects.length + 1
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    xref += `${offset.toString().padStart(10, '0')} 00000 n \n`
  }

  const trailer =
    `trailer\n<< /Size ${size} /Root 1 0 R >>\n` + `startxref\n${xrefStart}\n%%EOF`

  return new TextEncoder().encode(header + body + xref + trailer)
}

/** Dispara la descarga de un PDF (bytes) con el nombre dado. */
export function downloadPdf(pdf: Uint8Array, filename: string): void {
  const name = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`
  const blob = new Blob([pdf as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

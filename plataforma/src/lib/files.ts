/** Utilidades para subir y descargar archivos del navegador (texto y binarios). */

/** Extensiones que tratamos como **texto** (el resto va como binario base64). */
const TEXT_EXTENSIONS = new Set([
  'tex', 'sty', 'cls', 'bib', 'dat', 'csv', 'txt', 'md', 'tikz', 'def', 'clo', 'bbx', 'cbx', 'log',
  'mtex', 'json',
])

/** ¿La ruta corresponde a un archivo de **texto** (vs. binario)? */
export function isTextPath(path: string): boolean {
  return TEXT_EXTENSIONS.has(path.split('.').pop()?.toLowerCase() ?? '')
}

export interface UploadedFile {
  path: string
  content: string
  encoding: 'utf8' | 'base64'
}

/** Lee un `File` del navegador como texto o como binario (base64) según su extensión. */
export async function readUploadedFile(file: File): Promise<UploadedFile> {
  if (isTextPath(file.name)) {
    return { path: file.name, content: await file.text(), encoding: 'utf8' }
  }
  return { path: file.name, content: arrayBufferToBase64(await file.arrayBuffer()), encoding: 'base64' }
}

/** Dispara la descarga de un Blob con el nombre dado. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Dispara la descarga de un archivo (texto utf8 o binario base64) con su nombre. */
export function downloadFile(name: string, content: string, encoding: 'utf8' | 'base64' = 'utf8'): void {
  const blob =
    encoding === 'base64'
      ? new Blob([base64ToBytes(content) as BlobPart])
      : new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name.split('/').pop() || name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

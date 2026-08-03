import JSZip from 'jszip'
import type { ProjectFile } from '@/features/documents/types'
import { isTextPath } from './files'

/** Empaqueta todos los archivos del proyecto en un `.zip` (texto y binarios). */
export async function buildProjectZip(files: readonly ProjectFile[]): Promise<Blob> {
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.path, file.content, { base64: file.encoding === 'base64' })
  }
  return zip.generateAsync({ type: 'blob' })
}

/** Lee un `.zip` y devuelve sus archivos + el archivo principal sugerido. */
export async function readProjectZip(file: Blob): Promise<{ files: ProjectFile[]; mainFile: string }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const files: ProjectFile[] = []
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue
    if (isTextPath(entry.name)) {
      files.push({ path: entry.name, content: await entry.async('string'), encoding: 'utf8' })
    } else {
      files.push({ path: entry.name, content: await entry.async('base64'), encoding: 'base64' })
    }
  }
  const mainFile =
    files.find((f) => f.path === 'main.tex')?.path ??
    files.find((f) => f.path.toLowerCase().endsWith('.tex'))?.path ??
    files[0]?.path ??
    'main.tex'
  return { files, mainFile }
}

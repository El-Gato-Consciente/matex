import type { LatexCompiler } from './LatexCompiler'
import { MockCompiler } from './MockCompiler'
import { RemoteCompiler } from './RemoteCompiler'

/**
 * Única decisión de qué backend de compilación usar (composición central).
 * Si `VITE_COMPILE_API_URL` está definido, usa el backend real (Docker + TeX
 * Live) vía `RemoteCompiler`; si no, el `MockCompiler` para desarrollo offline.
 * Cambiar de backend no toca ningún componente de UI.
 */
export function createCompiler(): LatexCompiler {
  const apiUrl = import.meta.env.VITE_COMPILE_API_URL
  return apiUrl ? new RemoteCompiler({ baseUrl: apiUrl }) : new MockCompiler()
}

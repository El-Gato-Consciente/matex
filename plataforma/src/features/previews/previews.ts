import { previewManifest } from './manifest.generated'
import { previewKey, type Preview, type PreviewKind } from './types'

/**
 * Preview de un documento, si lo tiene.
 *
 * **Devolver `undefined` es parte del diseño, no un caso de error.** El manifiesto se regenera
 * a mano (`npm run build:previews`, que necesita el compilador arriba), así que una plantilla
 * nueva vive sin preview hasta la próxima corrida. La UI muestra la tarjeta sin imagen y sigue
 * funcionando: las vistas previas son un adorno informativo, nunca un requisito para crear un
 * documento.
 */
export function previewFor(kind: PreviewKind, id: string): Preview | undefined {
  return previewManifest[previewKey(kind, id)]
}

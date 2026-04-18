import type { JSONContent } from '@tiptap/core'

/* ─────────────────────────────────────────────────────────────────
   LtxjDocument — envelope mínimo para el formato .ltxj

   content  → Tiptap getJSON() sin modificar; zero transformation
   version  → permite migraciones determinísticas entre fases
   profileId→ qué perfil/manifiesto usar al exportar
   normalizerMode / silencedRules → propiedades del documento,
               no de la sesión (siguen al archivo, no al usuario)
   ───────────────────────────────────────────────────────────────── */

export interface LtxjDocument {
  version:        1
  profileId:      string
  normalizerMode: 'strict' | 'mixed' | 'suggestion'
  silencedRules:  string[]
  metadata: {
    title:     string
    savedAt:   number
    createdAt: number
  }
  content: JSONContent
}

const DEFAULTS: Omit<LtxjDocument, 'content' | 'metadata'> = {
  version:        1,
  profileId:      'article-pro',
  normalizerMode: 'mixed',
  silencedRules:  [],
}

export function toStorage(
  content: JSONContent,
  prev?: Partial<LtxjDocument>,
): LtxjDocument {
  const now = Date.now()
  return {
    ...DEFAULTS,
    ...prev,
    version:  1,
    metadata: {
      title:     prev?.metadata?.title     ?? '',
      createdAt: prev?.metadata?.createdAt ?? now,
      savedAt:   now,
    },
    content,
  }
}

export function fromStorage(doc: LtxjDocument): JSONContent {
  return doc.content
}

/* Handles docs saved before the envelope was introduced (raw Tiptap JSON). */
export function migrate(raw: object): LtxjDocument {
  if ('version' in raw && (raw as LtxjDocument).version === 1) {
    return raw as LtxjDocument
  }
  // Legacy: raw Tiptap JSON — wrap it
  return toStorage(raw as JSONContent)
}

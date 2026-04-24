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
    title:       string
    author:      string
    email:       string
    date:        string
    institution: string
    abstract:    string
    keywords:    string
    language:    'es' | 'en'
    savedAt:     number
    createdAt:   number
  }
  content: JSONContent
}

const DEFAULTS: Omit<LtxjDocument, 'content' | 'metadata'> = {
  version:        1,
  profileId:      'article-pro',
  normalizerMode: 'mixed',
  silencedRules:  [],
}

/** Strips attrs that are only meaningful at runtime and must not be persisted. */
function stripTransientAttrs(content: JSONContent): JSONContent {
  const strip = (node: JSONContent): JSONContent => {
    const { activationToken: _, ...cleanAttrs } = (node.attrs ?? {}) as Record<string, unknown>
    return {
      ...node,
      attrs:   Object.keys(cleanAttrs).length > 0 ? cleanAttrs : undefined,
      content: node.content?.map(strip),
    }
  }
  return strip(content)
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
      title:       prev?.metadata?.title       ?? '',
      author:      prev?.metadata?.author      ?? '',
      email:       prev?.metadata?.email       ?? '',
      date:        prev?.metadata?.date        ?? '',
      institution: prev?.metadata?.institution ?? '',
      abstract:    prev?.metadata?.abstract    ?? '',
      keywords:    prev?.metadata?.keywords    ?? '',
      language:    prev?.metadata?.language    ?? 'es',
      createdAt:   prev?.metadata?.createdAt   ?? now,
      savedAt:     now,
    },
    content: stripTransientAttrs(content),
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

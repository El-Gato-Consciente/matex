import type { Node, Fragment } from '@tiptap/pm/model'

/* ─────────────────────────────────────────────────────────────────
   LatexSerializerRegistry

   Decouples extensions from TexSerializer: each extension registers
   its own LaTeX serializer here. TexSerializer looks up the registry
   at runtime — it never imports individual extension files.

   Dependency direction:
     Extension  →  Registry  ←  TexSerializer
   ───────────────────────────────────────────────────────────────── */

export interface LatexSerializerContext {
  doc: Node
  serializeFragment(fragment: Fragment): string
  serializeInline(fragment: Fragment): string
  serializeNode(node: Node): string
}

export type LatexNodeSerializer = (
  node: Node,
  ctx: LatexSerializerContext,
) => string

const _registry = new Map<string, LatexNodeSerializer>()

export function registerLatexSerializer(
  typeName: string,
  fn: LatexNodeSerializer,
): void {
  _registry.set(typeName, fn)
}

export function getLatexSerializer(
  typeName: string,
): LatexNodeSerializer | undefined {
  return _registry.get(typeName)
}

/* ─────────────────────────────────────────────────────────────────
   Formalia — Core math types
   Shared by EditorStore, Normalizer (Phase 3), and CoachPanel.
   ───────────────────────────────────────────────────────────────── */

export type TheoremEnvType =
  | 'theorem' | 'lemma' | 'proposition' | 'corollary'
  | 'definition' | 'remark' | 'example' | 'note'
  | 'exercise' | 'proof'

export interface NormalizerChange {
  ruleId:        string
  description:   string   // shown in Coach Panel
  justification: string
  before:        string   // LaTeX before transform
  after:         string   // LaTeX after transform
  reversible:    boolean
}

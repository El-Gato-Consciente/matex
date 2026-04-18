import { Extension, InputRule } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import type { TheoremEnvType } from '@core/math/types'

/* ─────────────────────────────────────────────────────────────────
   SlashCommands — input rules that convert a trigger typed on a
   blank line into a TheoremEnv block.

   Pattern (same as MathDisplay's $$ rule):
     tr.replaceWith(range.from - 1, range.to, node)

   range.from - 1  →  position before the paragraph open token
   range.to        →  position after the last matched character
                      (end of paragraph content when ^ and $ anchor the regex)

   Cursor lands at range.from + 1, which is inside the inner
   paragraph of the newly inserted TheoremEnv (after env-open
   token + para-open token).
   ───────────────────────────────────────────────────────────────── */

const COMMANDS: Array<{ regex: RegExp; envType: TheoremEnvType }> = [
  { regex: /^\/thm\s$/,   envType: 'theorem'     },
  { regex: /^\/def\s$/,   envType: 'definition'  },
  { regex: /^\/lem\s$/,   envType: 'lemma'       },
  { regex: /^\/prop\s$/,  envType: 'proposition' },
  { regex: /^\/cor\s$/,   envType: 'corollary'   },
  { regex: /^\/ex\s$/,    envType: 'example'     },
  { regex: /^\/exr\s$/,   envType: 'exercise'    },
  { regex: /^\/rmk\s$/,   envType: 'remark'      },
  { regex: /^\/note\s$/,  envType: 'note'        },
  { regex: /^\/proof\s$/, envType: 'proof'       },
]

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addInputRules() {
    return COMMANDS.map(({ regex, envType }) =>
      new InputRule({
        find: regex,
        handler: ({ state, range }) => {
          const { tr, schema } = state
          const envNode = schema.nodes['theoremEnv']!.create(
            { envType, label: '' },
            [
              schema.nodes['theoremEnvTitle']!.create(),
              schema.nodes['paragraph']!.create(),
            ],
          )
          // Replace the whole paragraph (open token + content) with the env.
          tr.replaceWith(range.from - 1, range.to, envNode)
          // Move cursor inside the inner paragraph.
          tr.setSelection(TextSelection.create(tr.doc, range.from + 1))
          tr.scrollIntoView()
        },
      }),
    )
  },
})

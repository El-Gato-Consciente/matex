import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const key = new PluginKey('sectionNumbering')

export const SectionNumbering = Extension.create({
  name: 'sectionNumbering',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        props: {
          decorations(state) {
            const decos: Decoration[] = []
            let h1c = 0, h2c = 0, h3c = 0

            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'heading') return
              const level = node.attrs['level'] as 1 | 2 | 3
              let num: string
              if      (level === 1) { h1c++; h2c = 0; h3c = 0; num = `${h1c}.` }
              else if (level === 2) { h2c++; h3c = 0;           num = `${h1c}.${h2c}` }
              else                  { h3c++;                     num = `${h1c}.${h2c}.${h3c}` }

              decos.push(Decoration.node(pos, pos + node.nodeSize, { 'data-num': num }))
            })

            return DecorationSet.create(state.doc, decos)
          },
        },
      }),
    ]
  },
})

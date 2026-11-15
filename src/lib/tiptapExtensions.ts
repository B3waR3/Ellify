import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
    fontFamily: {
      setFontFamily: (fontFamily: string) => ReturnType
      unsetFontFamily: () => ReturnType
    }
  }
}

export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})

export const NOTE_EDITOR_EXTENSIONS = [
  StarterKit,
  Underline,
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  Highlight.configure({ multicolor: true }),
  // TipTap 2.27 TextAlign uses .every() across node types, so setTextAlign fails
  // when the cursor is only in a paragraph (heading update returns false).
  TextAlign.extend({
    addCommands() {
      return {
        setTextAlign:
          (alignment: string) =>
          ({ commands }) => {
            if (!this.options.alignments.includes(alignment)) return false
            return this.options.types
              .map((type: string) => commands.updateAttributes(type, { textAlign: alignment }))
              .some((response: boolean) => response)
          },
        unsetTextAlign:
          () =>
          ({ commands }) =>
            this.options.types
              .map((type: string) => commands.resetAttributes(type, 'textAlign'))
              .some((response: boolean) => response),
        toggleTextAlign:
          (alignment: string) =>
          ({ editor, commands }) => {
            if (!this.options.alignments.includes(alignment)) return false
            if (editor.isActive({ textAlign: alignment })) {
              return commands.unsetTextAlign()
            }
            return commands.setTextAlign(alignment)
          },
      }
    },
    addGlobalAttributes() {
      return [
        {
          types: this.options.types,
          attributes: {
            textAlign: {
              default: this.options.defaultAlignment,
              parseHTML: (element: HTMLElement) => {
                const alignment = element.style.textAlign
                return this.options.alignments.includes(alignment)
                  ? alignment
                  : this.options.defaultAlignment
              },
              renderHTML: (attributes: { textAlign?: string | null }) => {
                if (!attributes.textAlign) return {}
                // Last line follows writing direction (right in RTL Hebrew).
                if (attributes.textAlign === 'justify') {
                  return {
                    style: 'text-align: justify; text-align-last: start',
                  }
                }
                return { style: `text-align: ${attributes.textAlign}` }
              },
            },
          },
        },
      ]
    },
  }).configure({
    types: ['heading', 'paragraph'],
    alignments: ['right', 'center', 'left', 'justify'],
    defaultAlignment: 'right',
  }),
  Placeholder.configure({ placeholder: 'התחילי לכתוב…' }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
]

export const FONT_FAMILIES = [
  { label: 'Heebo', value: 'Heebo, sans-serif' },
  { label: 'Manrope', value: 'Manrope, sans-serif' },
  { label: 'David', value: 'David, "Times New Roman", serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
]

export const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']

/** Normalize browser/CSS font-family strings so toolbar <select> values match. */
export function matchFontFamily(value: string | undefined | null): string {
  if (!value) return ''
  const compact = value.replace(/['"]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  const exact = FONT_FAMILIES.find((font) => font.value.replace(/['"]/g, '').toLowerCase() === compact)
  if (exact) return exact.value
  const byLabel = FONT_FAMILIES.find((font) => compact.startsWith(font.label.toLowerCase()))
  return byLabel?.value || ''
}

export function matchFontSize(value: string | undefined | null): string {
  if (!value) return ''
  const normalized = value.trim().toLowerCase()
  if (FONT_SIZES.includes(normalized)) return normalized
  const withPx = /^\d+$/.test(normalized) ? `${normalized}px` : normalized
  return FONT_SIZES.includes(withPx) ? withPx : ''
}

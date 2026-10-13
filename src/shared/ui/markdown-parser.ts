import 'background-only'
import { Lexer, type Token } from 'marked'

/** Marked 18 uses ES2022 built-ins that Android's PrimJS does not provide. */
function ensureMarkdownRuntime(): void {
  if (typeof Array.prototype.at !== 'function') {
    Object.defineProperty(Array.prototype, 'at', {
      configurable: true,
      writable: true,
      value: function at(this: ArrayLike<unknown>, index: number) {
        if (this == null) throw new TypeError('Array.at requires a receiver')
        const length = Math.min(
          Math.max(Math.trunc(+this.length) || 0, 0),
          9007199254740991,
        )
        const relative = Math.trunc(+index) || 0
        const position = relative < 0 ? length + relative : relative
        return position < 0 || position >= length ? undefined : this[position]
      },
    })
  }
  if (typeof Object.hasOwn !== 'function') {
    Object.defineProperty(Object, 'hasOwn', {
      configurable: true,
      writable: true,
      value: (object: object, key: PropertyKey) =>
        Object.prototype.hasOwnProperty.call(object, key),
    })
  }
}

/** Marked's regex rules require the background JS engine, not Lepus bytecode. */
export function parseMarkdown(content: string): Token[] | null {
  try {
    ensureMarkdownRuntime()
    return Lexer.lex(content, { gfm: true })
  } catch {
    return null
  }
}

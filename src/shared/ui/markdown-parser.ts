import 'background-only'
import { Lexer, type Token } from 'marked'

/** Marked's regex rules require the background JS engine, not Lepus bytecode. */
export function parseMarkdown(content: string): Token[] | null {
  try {
    return Lexer.lex(content, { gfm: true })
  } catch {
    return null
  }
}

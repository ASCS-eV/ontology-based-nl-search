/**
 * RDF literal-lexical escaping — the single primitive every emitter uses when
 * it embeds a string value inside a double-quoted RDF literal.
 *
 * SPARQL and Turtle define the double-quoted literal identically, which is why
 * one function serves both:
 *
 *     [SPARQL11] STRING_LITERAL2      ::= '"' ([^#x22#x5C#xA#xD] | ECHAR | UCHAR)* '"'
 *     [TURTLE]   STRING_LITERAL_QUOTE ::= '"' ([^#x22#x5C#xA#xD] | ECHAR | UCHAR)* '"'
 *     ECHAR ::= '\' [tbnrf"'\]
 *     UCHAR ::= '\u' HEX HEX HEX HEX | '\U' HEX HEX HEX HEX HEX HEX HEX HEX
 *
 * Both grammars forbid exactly four raw characters — `"` (U+0022), `\`
 * (U+005C), LF (U+000A) and CR (U+000D) — and both accept the same `ECHAR` /
 * `UCHAR` escapes. Anything a query emitter may write, a Turtle emitter may
 * write, so the two must not drift.
 *
 * Beyond the four mandatory escapes this also emits the remaining
 * `U+0000`–`U+001F` control characters as `\uHHHH`. Neither grammar requires
 * that — a raw U+0007 round-trips through a conforming parser — but a control
 * byte embedded in a query string, a serialized graph, or a log line is an
 * interop hazard for the tooling downstream of us, and escaping it costs
 * nothing. The single quote `'` is escaped for the same reason: the value stays
 * safe should it ever be reused inside a `STRING_LITERAL1` (`'…'`) context,
 * which both grammars permit.
 *
 * Escaping is the inner line of defense against injection: the SPARQL policy
 * gate rejects malformed queries after the fact, while this ensures the strings
 * the compiler and the RDF lowering emit are well-formed in the first place.
 *
 * @see https://www.w3.org/TR/sparql11-query/#rString — [SPARQL11] §19.8
 * @see https://www.w3.org/TR/turtle/#grammar-production-STRING_LITERAL_QUOTE — [TURTLE] §6.5
 */

/**
 * Escape `value` for embedding inside a double-quoted RDF literal (SPARQL
 * `STRING_LITERAL2` / Turtle `STRING_LITERAL_QUOTE`).
 *
 * The returned string carries no delimiters — the caller wraps it in `"…"`.
 */
export function escapeRdfLiteral(value: string): string {
  let out = ''
  for (const ch of value) {
    const code = ch.codePointAt(0)!
    if (ch === '\\') {
      out += '\\\\'
    } else if (ch === '"') {
      out += '\\"'
    } else if (ch === "'") {
      out += "\\'"
    } else if (ch === '\n') {
      out += '\\n'
    } else if (ch === '\r') {
      out += '\\r'
    } else if (ch === '\t') {
      out += '\\t'
    } else if (code < 0x20) {
      // Remaining U+0000–U+001F control characters.
      out += '\\u' + code.toString(16).padStart(4, '0').toUpperCase()
    } else {
      out += ch
    }
  }
  return out
}

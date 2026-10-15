/**
 * Compact display of IRIs embedded in UI text.
 *
 * Interpretation terms and slot filter values carry full IRIs (e.g. a class
 * IRI an enum value resolved to). Showing the whole IRI buries the meaningful
 * part, so every absolute hierarchical IRI (`scheme://…`) is replaced by
 * its local name — the segment after the last `#` or `/`, as defined by
 * `extractLocalName`. Plain words, prefixed names and DIDs are left untouched.
 * The caller keeps the full value (tooltip, edit field, wire format).
 */
import { extractLocalName } from '@ontology-search/core/rdf/iri'

const ABSOLUTE_IRI = /\b[a-z][a-z0-9+.-]*:\/\/[^\s,;<>"'()[\]{}]+/gi

/** Local name of an IRI, or the whole IRI when it ends in a separator (empty local name). */
const localNameOrIri = (iri: string): string => extractLocalName(iri) || iri

/** Replace every absolute IRI in `text` by its local name. */
export function compactIri(text: string): string {
  return text.replace(ABSOLUTE_IRI, localNameOrIri)
}

/**
 * Prefer the domain the user actually named, when they named one.
 *
 * A property can be declared by several domains. When it is, the slot layer
 * keeps every domain that could answer — the safe default, because dropping
 * one silently hides matching assets. But it also means a query that names its
 * subject explicitly ("maps in France with autobahn") is answered from every
 * domain that happens to share the property, including ones the user just
 * ruled out by naming a different subject.
 *
 * The tie-break here uses the only subject vocabulary that is already
 * discovered from the shapes graph: the domain names themselves. A query token
 * that appears in one candidate's name and no other's is the user naming their
 * subject, and that candidate wins. Nothing about any particular ontology is
 * encoded — a graph whose domains are named differently gets the same
 * treatment, and a graph whose domain names never appear in user prose simply
 * never triggers a preference.
 *
 * Deliberately conservative in three ways: it never introduces a domain that
 * was not already a candidate, it requires a clear margin rather than a bare
 * maximum, and on any ambiguity it returns the input untouched. Widening a
 * query costs the user a scan through irrelevant results; narrowing it wrongly
 * costs them the result they wanted.
 */

/** Score for a domain-name token that equals a whole query token. */
const EXACT_TOKEN_SCORE = 3
/** Score for a domain-name token that contains, or is contained by, one. */
const PARTIAL_TOKEN_SCORE = 2
/**
 * How far ahead the winner must be. Two means a domain named outright
 * (or matched as part of a compound name) beats one that is not matched at
 * all, while two domains that both match stay together.
 */
const REQUIRED_MARGIN = 2
/** Shorter fragments match too much to be evidence of anything. */
const MIN_TOKEN_LENGTH = 3

/**
 * Words to their comparison form: lowercase, no punctuation, and a trailing
 * plural `s` removed so "maps" and "map" are the same token. Deliberately not
 * a real stemmer — anything cleverer would start encoding language rules that
 * the ontology, not this module, should own.
 */
export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < MIN_TOKEN_LENGTH) continue
    tokens.add(raw)
    if (raw.endsWith('s') && raw.length - 1 >= MIN_TOKEN_LENGTH) tokens.add(raw.slice(0, -1))
  }
  return tokens
}

/**
 * A domain name split into the parts a user might say: the whole name, and the
 * pieces around separators or camelCase boundaries. `environment-model` yields
 * `environment` and `model`; an all-lowercase compound like `hdmap` yields only
 * itself, and is reached through the substring rule below instead.
 */
export function domainTokens(domain: string): Set<string> {
  const tokens = new Set<string>()
  const normalized = domain.toLowerCase()
  if (normalized.length >= MIN_TOKEN_LENGTH) tokens.add(normalized)
  for (const part of domain.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/)) {
    const lower = part.toLowerCase()
    if (lower.length >= MIN_TOKEN_LENGTH) tokens.add(lower)
  }
  return tokens
}

/**
 * How strongly a query names this domain. Zero means the query says nothing
 * about it either way — the common case, and the reason this never collapses
 * a query that did not name its subject.
 */
export function scoreDomainAgainstQuery(domain: string, queryTokens: ReadonlySet<string>): number {
  let score = 0
  for (const token of domainTokens(domain)) {
    if (queryTokens.has(token)) {
      score += EXACT_TOKEN_SCORE
      continue
    }
    for (const queryToken of queryTokens) {
      if (token.includes(queryToken) || queryToken.includes(token)) {
        score += PARTIAL_TOKEN_SCORE
        break
      }
    }
  }
  return score
}

/**
 * Narrow `domains` to the one the query names, when exactly one is named
 * clearly enough. Returns the input unchanged in every other case — including
 * an empty or single-element list, a query that names none of them, and a tie.
 */
export function preferDomainsNamedInQuery(domains: string[], query: string): string[] {
  if (domains.length < 2) return domains

  const queryTokens = tokenize(query)
  if (queryTokens.size === 0) return domains

  const scored = domains
    .map((domain) => ({ domain, score: scoreDomainAgainstQuery(domain, queryTokens) }))
    .sort((a, b) => b.score - a.score)

  const [best, runnerUp] = scored
  if (!best || !runnerUp || best.score === 0) return domains
  if (best.score - runnerUp.score < REQUIRED_MARGIN) return domains

  return [best.domain]
}

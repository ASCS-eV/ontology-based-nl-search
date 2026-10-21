/**
 * Citation gate: a `[TAG] §N` comment must be checkable against the normative
 * text it names (CONTRIBUTING criterion #31).
 *
 * `docs/specs/references/README.md` registers every tag and, for a standard
 * stored verbatim, the file that holds its text. For every numbered citation
 * in the tracked sources the gate asserts that
 *
 *   1. its tag is registered;
 *   2. section N exists in that text, wherever the text numbers its sections
 *      (the JSON Schema drafts are stored without numbers, so citations of
 *      them cannot be checked here);
 *   3. a term written right next to the citation, as in "`sh:in` ([SHACL]
 *      §4.8.3)" or "[RDFS] §3.6 rdfs:label", cites the section that defines
 *      the term, or one enclosing it;
 *   4. a link into the same text on the same line
 *      (`https://www.w3.org/TR/shacl/#InConstraintComponent — [SHACL] §4.8.3`)
 *      cites the section the link points at, or one enclosing it.
 *
 * Which section defines a term or carries an anchor is read from the text's
 * own headings and table of contents, not from a list kept here.
 *
 * Pure (`readSpec`, `readRegistry`, `analyzeCitations`) so it is unit-testable;
 * the CLI reads the real registry and the tracked files.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REFERENCES = 'docs/specs/references'

/** A section number: `4.8.3`, or an appendix letter followed by numbers (`A.1`). */
const SECTION = String.raw`\d+(?:\.\d+)*|[A-Z](?:\.\d+)+`

/**
 * How a vendored text marks a section heading. The texts were converted from
 * HTML by different tools, so two Markdown forms occur:
 * `### 3.1 The Context[](#the-context)` and `### [2.1.8](#sec-Names)Names`.
 */
const MARKDOWN_HEADINGS = [
  new RegExp(String.raw`^#{1,6}\s+(${SECTION})\\?\.?\s+(.*)$`, 'gm'),
  new RegExp(String.raw`^#{1,6}\s+\[(${SECTION})\]\(#([^)\s"]+)[^)]*\)(.*)$`, 'gm'),
]

/**
 * An RFC kept as plain text starts a section with its number at the margin:
 * `15.5.5.  404 Not Found`. A Markdown text has numbered list items of the
 * same shape, so this form is read only from a text with no Markdown
 * section headings.
 */
const PLAIN_TEXT_HEADING = new RegExp(String.raw`^(${SECTION})\.\s{2,}(\S.*)$`, 'gm')

/**
 * A table-of-contents entry, with the number inside the link
 * (`[4.8.3 sh:in](#InConstraintComponent)`, `[2.9Fragments](#…)`) or before
 * it (`10.2 [VALUES: Providing inline data](#inline-data)`).
 */
const CONTENTS_ENTRIES = [
  new RegExp(String.raw`\[(${SECTION})(?:\\?\.)?(?=[^\d.])[^\]]*\]\(#([^)\s"]+)`, 'g'),
  new RegExp(String.raw`^\s*(${SECTION})\\?\.?\s+\**\[[^\]]*\]\(#([^)\s"]+)`, 'gm'),
]

/** The anchor a converted heading keeps at its end: `The Context[](#the-context)`. */
const TRAILING_ANCHOR = /\[\]\(#([^)\s"]+)\)\s*$/

/** A prefixed term as a spec heading or a comment writes it: `sh:in`, `rdfs:label`. */
const TERM = /\b([a-z][a-z0-9]*:[A-Za-z][A-Za-z0-9]*)\b/g

/** The source URL the attribution header of a vendored text records. */
const SOURCE = /^\s*Source:\s+(\S+)/m

/**
 * The sections of one vendored text, the terms its headings define, and the
 * section each anchor of the original document belongs to.
 *
 * A heading that names a prefixed term ("4.8.3 sh:in", "2.1.3.2 Class-based
 * Targets (sh:targetClass)") defines it; the first such heading wins, since a
 * later one that repeats a term only refers back to it.
 */
export function readSpec(text) {
  const sections = new Set()
  const definedIn = new Map()
  const anchors = new Map()
  const record = (number, title, anchor) => {
    sections.add(number)
    if (anchor && !anchors.has(anchor)) anchors.set(anchor, number)
    for (const [, term] of title.matchAll(TERM)) {
      if (!definedIn.has(term)) definedIn.set(term, number)
    }
  }
  const [trailing, leading] = MARKDOWN_HEADINGS
  for (const [, number, title] of text.matchAll(trailing)) {
    record(number, title, TRAILING_ANCHOR.exec(title)?.[1])
  }
  for (const [, number, anchor, title] of text.matchAll(leading)) record(number, title, anchor)
  if (sections.size === 0) {
    for (const [, number, title] of text.matchAll(PLAIN_TEXT_HEADING)) record(number, title)
  }
  for (const entries of CONTENTS_ENTRIES) {
    for (const [, number, anchor] of text.matchAll(entries)) {
      if (sections.has(number) && !anchors.has(anchor)) anchors.set(anchor, number)
    }
  }
  return { source: SOURCE.exec(text)?.[1] ?? null, sections, definedIn, anchors }
}

/**
 * Every registered tag, from each README table that has a `Tag` column. A
 * row's `File` cell, where the table has one, names the verbatim text.
 */
export function readRegistry(readme) {
  const tags = new Map()
  let columns = null
  for (const line of readme.split('\n')) {
    if (!line.startsWith('|')) {
      columns = null
      continue
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())
    if (!columns) {
      columns = cells
      continue
    }
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue
    const tagCell = cells[columns.indexOf('Tag')]
    if (tagCell === undefined) continue
    const file = /`([^`]+\.md)`/.exec(cells[columns.indexOf('File')] ?? '')?.[1]
    for (const [, tag] of tagCell.matchAll(/`\[([^\]`]+)\]`/g)) tags.set(tag, file ?? null)
  }
  return tags
}

/**
 * A numbered citation, either style the code base uses: `[TAG] §N` or
 * `[TAG §N]`, optionally followed by more sections of the same text
 * (`[SHACL] §2.1.3.2, §2.3`).
 */
const CITATION = new RegExp(
  String.raw`\[([A-Za-z][A-Za-z0-9-]*)(?:\]\s*§\s*|\s+§)(${SECTION})((?:\s*(?:,|and|\/)\s*§\s*(?:${SECTION}))*)\]?`,
  'g'
)

/** A term written immediately before a citation: "`sh:in` ([SHACL] …", "sh:in [SHACL …". */
const TERM_BEFORE = /`?([a-z][a-z0-9]*:[A-Za-z][A-Za-z0-9]*)`?\s*\(?$/
/** A term written immediately after one: "[RDFS] §3.6 rdfs:label". */
const TERM_AFTER = /^\)?\s*`?([a-z][a-z0-9]*:[A-Za-z][A-Za-z0-9]*)\b/
/** A link with a fragment: `https://www.w3.org/TR/shacl/#InConstraintComponent`. */
const LINK = /\bhttps?:\/\/[^\s#)>]+#([^\s)>"'`]+)/g

const withoutTrailingSlash = (url) => url.replace(/\/+$/, '')

/**
 * Check every numbered citation in `files` (`{ path, text }`) against the
 * registry (tag -> file or null) and the parsed texts (file -> `readSpec`).
 * Returns one message per violation, `path:line: …`.
 */
export function analyzeCitations(files, registry, specs) {
  const violations = []
  for (const { path, text } of files) {
    text.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(CITATION)) {
        const [whole, tag, first, rest] = match
        const where = `${path}:${index + 1}`
        if (!registry.has(tag)) {
          violations.push(`${where}: [${tag}] is not registered in ${REFERENCES}/README.md`)
          continue
        }
        const spec = specs.get(registry.get(tag))
        if (!spec || spec.sections.size === 0) continue
        const cited = [first, ...[...rest.matchAll(new RegExp(SECTION, 'g'))].map((m) => m[0])]
        for (const section of cited) {
          if (!spec.sections.has(section)) {
            violations.push(`${where}: [${tag}] §${section} does not exist`)
          }
        }
        const encloses = (target) =>
          cited.some((section) => target === section || target.startsWith(`${section}.`))
        const citedList = `§${cited.join(', §')}`

        const before = TERM_BEFORE.exec(line.slice(0, match.index))?.[1]
        const after = TERM_AFTER.exec(line.slice(match.index + whole.length))?.[1]
        for (const term of new Set([before, after])) {
          const defining = term && spec.definedIn.get(term)
          if (defining && !encloses(defining)) {
            violations.push(
              `${where}: ${term} is defined in [${tag}] §${defining}, cited as ${citedList}`
            )
          }
        }

        for (const link of line.matchAll(LINK)) {
          const document = link[0].slice(0, link[0].indexOf('#'))
          if (
            !spec.source ||
            withoutTrailingSlash(document) !== withoutTrailingSlash(spec.source)
          ) {
            continue
          }
          const target = spec.anchors.get(link[1])
          if (target && !encloses(target)) {
            violations.push(`${where}: #${link[1]} is [${tag}] §${target}, cited as ${citedList}`)
          }
        }
      }
    })
  }
  return violations
}

/** The tracked text files that may carry citations, outside the vendored texts. */
function trackedSources(root) {
  const listed = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  return listed
    .split('\0')
    .filter((path) => /\.(?:[cm]?[jt]sx?|md|ya?ml)$/.test(path) && !path.startsWith(REFERENCES))
    .map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') }))
}

/** Run the gate over the real repository. */
export function checkRepository(root = ROOT) {
  const registry = readRegistry(readFileSync(join(root, REFERENCES, 'README.md'), 'utf8'))
  const specs = new Map()
  for (const file of new Set(registry.values())) {
    if (file) specs.set(file, readSpec(readFileSync(join(root, REFERENCES, file), 'utf8')))
  }
  return { registry, specs, violations: analyzeCitations(trackedSources(root), registry, specs) }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { violations } = checkRepository()
  if (violations.length > 0) {
    console.error(`Citation gate: ${violations.length} violation(s)\n  ${violations.join('\n  ')}`)
    process.exit(1)
  }
  console.warn('Citation gate: every numbered citation resolves')
}

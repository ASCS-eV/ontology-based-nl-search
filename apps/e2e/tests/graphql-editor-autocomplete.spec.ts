import { expect, type Locator, type Page, test } from '@playwright/test'

/**
 * Real-browser guard for the GraphQL editor's schema-aware autocomplete and hover,
 * against the live `/vocabulary`-driven schema.
 *
 * The specific regression this guards: references used to be a permissive `JSON`
 * scalar, so completion went dead *inside* a reference. They are now typed fields
 * (`references { <domain> { … } }`), so completion works at every depth. See
 * `docs/adr/0002-field-based-recursive-references.md`.
 */

const POPUP = '.cm-tooltip-autocomplete'

interface Vocab {
  domains: string[]
  properties: {
    domain: string
    name: string
    label: string
    description: string
    type: string
    allowedValues?: string[]
  }[]
}

/**
 * Open the GraphQL editor (entry mode) and return its editor handle plus the
 * vocabulary the app loaded — captured from the app's own `/api/vocabulary`
 * fetch (which goes through the web dev-proxy), so the test reads exactly what
 * drives the schema. Autocomplete is inert until that fetch lands.
 */
async function openEditor(page: Page): Promise<{ content: Locator; vocab: Vocab }> {
  const vocabResponse = page.waitForResponse((r) => r.url().includes('/api/vocabulary') && r.ok(), {
    timeout: 30_000,
  })
  await page.goto('/')
  await page.getByRole('button', { name: /Start with GraphQL/i }).click()
  const vocab = (await (await vocabResponse).json()) as Vocab

  const content = page.locator('.cm-content')
  await expect(content).toBeVisible()
  return { content, vocab }
}

/**
 * Replace the editor contents with `doc` (caret left at its end) and open
 * completion there. `insertText` writes the whole string in one input event, so
 * CodeMirror's per-key bracket auto-close never fires — the caret position is
 * exactly `doc`'s end. `graphql-language-service` completes incomplete documents,
 * so `doc` is an unterminated prefix ending at the position under test.
 *
 * With `explicit` (default) the popup is opened via Ctrl-Space. With
 * `explicit: false` the test asserts the editor *auto-opens* it (the value-
 * position behavior), so `doc` must end at a trigger (`:`/`[`/`(`/`,`).
 */
async function completionsAt(
  page: Page,
  content: Locator,
  doc: string,
  { explicit = true }: { explicit?: boolean } = {}
): Promise<Locator> {
  await content.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  if (explicit) {
    await page.keyboard.insertText(doc)
    await page.keyboard.press('Control+Space')
  } else {
    // Auto-open path: type the final (trigger) char as a real keypress so the
    // editor's input listener fires; `insertText` the prefix verbatim so no
    // per-key bracket auto-close mangles it.
    await page.keyboard.insertText(doc.slice(0, -1))
    await page.keyboard.type(doc.slice(-1))
  }
  const popup = page.locator(POPUP)
  await expect(popup).toBeVisible()
  return popup
}

/**
 * An enum-encodable categorical property from the vocabulary — one whose values
 * are all valid, unreserved GraphQL Names (spec §2.9.6), since only those are
 * modelled as a GraphQL enum (and therefore autocompleted). Mirrors core's
 * `isGraphQLEnumName` so the test picks exactly what the schema enum-encodes.
 */
function anEnumProperty(vocab: Vocab): { domain: string; name: string; allowedValues: string[] } {
  const isName = (v: string) =>
    /^[_A-Za-z][_0-9A-Za-z]*$/.test(v) && !['true', 'false', 'null'].includes(v)
  const domains = new Set(vocab.domains)
  const prop = vocab.properties.find(
    (p) =>
      p.type === 'enum' &&
      domains.has(p.domain) && // attributed to a real domain (not a cross-cutting one)
      (p.allowedValues?.length ?? 0) > 0 &&
      p.allowedValues!.every(isName)
  )
  expect(prop, 'vocabulary should expose at least one enum-encodable property').toBeTruthy()
  return { domain: prop!.domain, name: prop!.name, allowedValues: prop!.allowedValues! }
}

/** The suggested option *labels* (cm6 renders label and detail separately). */
async function labels(popup: Locator): Promise<string[]> {
  return (await popup.locator('.cm-completionLabel').allInnerTexts()).map((t) => t.trim())
}

/**
 * Mirror the schema/serializer's GraphQL Name sanitization (spec §2.1.9): the
 * schema field for a domain/property is the sanitized name, while `/vocabulary`
 * reports the raw name (e.g. `environment-model` -> `environment_model`).
 */
function gqlName(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9_]/g, '_')
  return /^[0-9]/.test(safe) ? `_${safe}` : safe || '_field'
}

async function tokenRectangle(content: Locator, token: string) {
  return content.evaluate((root, requestedToken) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const offset = node.data.indexOf(requestedToken)
      if (offset < 0) continue
      const range = document.createRange()
      range.setStart(node, offset)
      range.setEnd(node, offset + requestedToken.length)
      const rect = range.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }
    return null
  }, token)
}

test.describe('GraphQL editor autocomplete (real browser)', () => {
  test('references are typed at every depth (the JSON-scalar dead zone is gone)', async ({
    page,
  }) => {
    const { content } = await openEditor(page)

    // Top-level field position: discover a domain name dynamically so the test
    // names no ontology-specific identifier.
    const domain = (await labels(await completionsAt(page, content, 'query { '))).find(
      (l) => !l.startsWith('__')
    )
    expect(domain, 'vocabulary should expose at least one domain').toBeTruthy()

    // Inside `references { │ }` → the referenceable domains are suggested (the old
    // String-typed `domain` offered nothing here). Pick one to descend into.
    const refTarget = (
      await labels(await completionsAt(page, content, `query { ${domain} { references { `))
    ).find((l) => !l.startsWith('__'))
    expect(refTarget, 'references should suggest target domains').toBeTruthy()

    // Inside the referenced asset's own block → its fields. `_all` and the nested
    // `references` are schema-injected on every domain result type, so they prove
    // the referenced asset is fully typed (the old `JSON` scalar offered nothing)
    // and that references nest recursively.
    const refFields = await labels(
      await completionsAt(page, content, `query { ${domain} { references { ${refTarget} { `)
    )
    expect(refFields, `referenced asset should expose typed fields, got: ${refFields}`).toContain(
      '_all'
    )
    expect(refFields).toContain('references')
  })

  test('categorical values auto-open as (unquoted) enum members in value position', async ({
    page,
  }) => {
    const { content, vocab } = await openEditor(page)
    const { domain, name, allowedValues } = anEnumProperty(vocab)

    // Caret right after `values:` — the editor must AUTO-OPEN the list (no
    // Ctrl-Space). This is the fix for the "quoted value gets no completion"
    // trap: a closed `sh:in` vocabulary is a GraphQL enum, whose members are
    // unquoted Names (spec §2.9.6), so we surface them in value position rather
    // than let the user type a `"` (a string literal the enum field rejects).
    const popup = await completionsAt(
      page,
      content,
      `query { ${gqlName(domain)} { ${gqlName(name)}(values:`,
      { explicit: false }
    )

    const options = await labels(popup)
    // The global per-name enum is the union across domains, so assert the popup
    // surfaces at least one of this property's allowed values (not necessarily all).
    expect(
      options.some((o) => allowedValues.includes(o)),
      `enum members should auto-open in value position; allowed=${allowedValues} got=${options}`
    ).toBe(true)
  })

  test('ontology property hover shows a safe signature or description', async ({ page }) => {
    const { content, vocab } = await openEditor(page)
    const domains = new Set(vocab.domains)
    const property =
      vocab.properties.find(
        (candidate) =>
          domains.has(candidate.domain) &&
          (candidate.description.trim().length > 0 || candidate.label.trim().length > 0)
      ) ?? vocab.properties.find((candidate) => domains.has(candidate.domain))
    expect(property, 'vocabulary should expose a property on a discovered domain').toBeTruthy()

    const propertyName = gqlName(property!.name)
    const query = `query {\n  ${gqlName(property!.domain)} {\n    ${propertyName}\n  }\n}`
    await content.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await page.keyboard.insertText(query)

    const rectangle = await tokenRectangle(content, propertyName)
    expect(rectangle, `could not locate rendered property token ${propertyName}`).toBeTruthy()
    await page.mouse.move(rectangle!.x + rectangle!.width / 2, rectangle!.y + rectangle!.height / 2)

    const tooltip = page.locator('.cm-tooltip').filter({ has: page.locator('.cm-graphql-hover') })
    await expect(tooltip).toBeVisible({ timeout: 5_000 })
    const tooltipText = (await tooltip.innerText()).trim()
    const expectedFragments = [
      property!.description.trim(),
      property!.label.trim(),
      property!.name,
      propertyName,
    ].filter(Boolean)
    expect(
      expectedFragments.some((fragment) => tooltipText.includes(fragment)),
      `tooltip should include ontology or GraphQL field information; got: ${tooltipText}`
    ).toBe(true)
    expect(tooltipText).not.toContain('[object Object]')
    expect(tooltipText).not.toMatch(/<script\b|<img\b|<iframe\b/i)
  })
})

/**
 * The rule-identity gate.
 *
 * Every UID this package attributes a gap to must resolve somewhere: an `asam`
 * rule against the **pinned bundle rule lists** (`qc-bundles/*.bundle.json`,
 * generated from the bundles' own `checker_bundle_doc.md`), a `repo` rule
 * against this repo's own emanating entity. Otherwise a consumer of our gaps —
 * or of the `.xqar` report they are exported to — resolves the UID against
 * ASAM's catalog and finds nothing.
 *
 * The test reads the pinned lists only; refreshing them is the explicit,
 * reviewable `node qc-bundles/refresh.mjs`, never a network call from a test.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { QC_RULES, type QcRule, REPO_RULE_ENTITY } from '../qc-rules.js'

/** One pinned bundle manifest, as written by `qc-bundles/refresh.mjs`. */
interface BundleManifest {
  readonly bundle: string
  readonly repo: string
  readonly commit: string
  readonly source: string
  readonly sourceSha256: string
  readonly rules: readonly string[]
  readonly checkers: readonly { readonly name: string; readonly rules: readonly string[] }[]
}

const readManifest = (name: string): BundleManifest =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../qc-bundles/${name}.bundle.json`, import.meta.url)),
      'utf8'
    )
  ) as BundleManifest

const BUNDLES = [readManifest('qc-openscenarioxml'), readManifest('qc-opendrive')]
const PUBLISHED = new Set(BUNDLES.flatMap((b) => b.rules))
/** Widened to {@link QcRule} so the optional fields are visible to the gate. */
const RULES: readonly (readonly [string, QcRule])[] = Object.entries(QC_RULES)

/** `<entity>:<standard>:<definition-setting>:<rule-set>.<name>` (qc-framework). */
const UID_GRAMMAR = /^[a-z0-9.-]+:[a-z0-9]+:[0-9]+\.[0-9]+\.[0-9]+:[a-z0-9_]+\.[a-z0-9_.]+$/

describe('the pinned ASAM bundle rule lists', () => {
  it('are non-empty and pinned to a commit + source checksum', () => {
    for (const bundle of BUNDLES) {
      expect(bundle.rules.length, `${bundle.bundle} rules`).toBeGreaterThan(0)
      expect(bundle.commit, `${bundle.bundle} commit`).toMatch(/^[0-9a-f]{40}$/)
      expect(bundle.sourceSha256, `${bundle.bundle} checksum`).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('contain only ASAM-authored UIDs (they are ASAM bundles)', () => {
    for (const uid of PUBLISHED) expect(uid.startsWith('asam.net:'), uid).toBe(true)
  })

  it('are reachable from their checkers, so `.xqar` can name the checker that owns a rule', () => {
    for (const bundle of BUNDLES) {
      const fromCheckers = new Set(bundle.checkers.flatMap((c) => c.rules))
      expect([...bundle.rules].sort()).toEqual([...fromCheckers].sort())
    }
  })
})

describe('QC_RULES rule identities', () => {
  it.each(RULES)('%s has a well-formed UID', (_key, rule) => {
    expect(rule.uid).toMatch(UID_GRAMMAR)
  })

  it.each(RULES.filter(([, r]) => r.origin === 'asam'))(
    '%s is published by a pinned ASAM bundle',
    (key, rule) => {
      expect(
        PUBLISHED.has(rule.uid),
        `${key}: ${rule.uid} is declared origin:'asam' but no pinned bundle publishes it. ` +
          `Either it is a repo rule (origin:'repo', ${REPO_RULE_ENTITY} entity) or the pinned ` +
          `lists are stale (node qc-bundles/refresh.mjs).`
      ).toBe(true)
    }
  )

  it.each(RULES.filter(([, r]) => r.origin === 'repo'))(
    '%s does not claim ASAM authority',
    (key, rule) => {
      expect(rule.uid.startsWith(`${REPO_RULE_ENTITY}:`), `${key}: ${rule.uid}`).toBe(true)
      expect(
        PUBLISHED.has(rule.uid),
        `${key}: a repo rule must not collide with a published ASAM UID`
      ).toBe(false)
    }
  )

  it.each(RULES.filter(([, r]) => r.relatedAsamRule !== undefined))(
    '%s points at a real ASAM rule for orientation',
    (key, rule) => {
      expect(PUBLISHED.has(rule.relatedAsamRule!), `${key}: ${rule.relatedAsamRule}`).toBe(true)
    }
  )

  it('never invents an ASAM UID: no `asam.net` UID outside the pinned lists', () => {
    const invented = RULES.filter(
      ([, r]) => r.uid.startsWith('asam.net:') && !PUBLISHED.has(r.uid)
    ).map(([key, r]) => `${key} → ${r.uid}`)
    expect(invented).toEqual([])
  })

  it('has unique UIDs', () => {
    const uids = RULES.map(([, r]) => r.uid)
    expect(new Set(uids).size).toBe(uids.length)
  })
})

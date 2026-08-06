/**
 * Resolve a pinned upstream ontology by its IRI, through the OASIS XML catalog
 * the ontology package ships at `imports/catalog-v001.xml`.
 *
 * A file path inside a distribution is an implementation detail of that
 * distribution; the ontology IRI is the stable name. Upstream regenerates the
 * catalog whenever the layout moves — which it does: the v0.4.0 bump relocated
 * `imports/OpenScenario/OpenSCENARIO.xsd` to
 * `imports/openscenario/schema/OpenSCENARIO.xsd` and broke a consumer that had
 * hardcoded the old path. A consumer that asks the catalog is immune to that
 * class of change; one that joins path segments is not.
 *
 * [XMLCAT] OASIS XML Catalogs 1.1 §6.5.9 — `<uri name= uri=>` maps a URI to a
 * (catalog-relative) replacement. Only the `uri` entry type is used here; the
 * catalog upstream ships contains nothing else.
 * [RDF11] RDF 1.1 Concepts — the resolved documents are RDF graphs.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { OntologySourcesError } from '@ontology-search/core/errors'
import { XMLParser } from 'fast-xml-parser'

import { DEFAULT_ONTOLOGY_IMPORTS_PATH, getWorkspaceRoot } from './sources.js'

/** One `<uri name=… uri=…/>` entry, as `fast-xml-parser` yields it. */
interface CatalogUriEntry {
  '@_name'?: string
  '@_uri'?: string
}

/** The catalog file's own name, per the OASIS convention upstream follows. */
const CATALOG_FILENAME = 'catalog-v001.xml'

let cached: Map<string, string> | null = null

function catalogPath(): string {
  return join(getWorkspaceRoot(), ...DEFAULT_ONTOLOGY_IMPORTS_PATH, CATALOG_FILENAME)
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Parse the catalog into `ontology IRI → absolute path`.
 *
 * Catalog `uri` attributes are resolved against the catalog's own base — here
 * the `imports/` directory that contains it [XMLCAT] §4. That is asserted
 * rather than assumed: every entry must resolve to a file that exists, so a
 * distribution that moves a file without regenerating its catalog fails here
 * with a path, instead of somewhere downstream with a parse error.
 */
export function parseOntologyCatalog(xml: string, importsDir: string): Map<string, string> {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const doc = parser.parse(xml) as Record<string, unknown>
  const catalog = doc.catalog as Record<string, unknown> | undefined
  if (!catalog) {
    throw new OntologySourcesError(
      `${CATALOG_FILENAME} has no <catalog> root — the ontology cache is not an OASIS XML catalog.`
    )
  }

  const entries = new Map<string, string>()
  for (const entry of asArray(catalog.uri as CatalogUriEntry | CatalogUriEntry[] | undefined)) {
    const iri = entry['@_name']
    const relative = entry['@_uri']
    if (!iri || !relative) continue
    entries.set(iri, join(importsDir, relative))
  }

  if (entries.size === 0) {
    throw new OntologySourcesError(
      `${CATALOG_FILENAME} declares no <uri> entries — nothing upstream can be resolved by IRI.`
    )
  }
  return entries
}

/** The catalog, parsed once. The pinned cache is a build-time constant. */
function catalog(): Map<string, string> {
  if (cached) return cached
  const path = catalogPath()
  if (!existsSync(path)) {
    throw new OntologySourcesError(
      `The pinned ontology catalog is missing at ${path}. ` +
        `Run 'pnpm run fetch:ontology' to materialize the cache.`
    )
  }
  cached = parseOntologyCatalog(
    readFileSync(path, 'utf-8'),
    join(getWorkspaceRoot(), ...DEFAULT_ONTOLOGY_IMPORTS_PATH)
  )
  return cached
}

/**
 * Resolve an ontology IRI to the absolute path of its pinned document.
 *
 * Throws rather than returning undefined: every caller names an IRI it needs,
 * so an unresolvable one is a broken pin, not a branch to handle. The error
 * lists what the catalog does declare, because the usual cause is upstream
 * renaming or versioning the IRI.
 */
export function resolveOntologyPath(ontologyIri: string): string {
  const entries = catalog()
  const path = entries.get(ontologyIri)
  if (!path) {
    throw new OntologySourcesError(
      `No entry for <${ontologyIri}> in ${CATALOG_FILENAME}. ` +
        `The pinned catalog declares: ${[...entries.keys()].sort().join(', ')}`
    )
  }
  if (!existsSync(path)) {
    throw new OntologySourcesError(
      `${CATALOG_FILENAME} maps <${ontologyIri}> to ${path}, which does not exist. ` +
        `The distribution's layout and its catalog disagree — re-run 'pnpm run fetch:ontology'.`
    )
  }
  return path
}

/** Reset the parsed catalog. Test-only; the pinned cache is build-time constant. */
export function resetOntologyCatalogCache(): void {
  cached = null
}

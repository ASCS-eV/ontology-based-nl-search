import type { VocabularyResponse } from '@ontology-search/api-types'
import { enumPropertyMembers } from '@ontology-search/core/graphql/enum'

const RESERVED_NAMES = new Set(['_all', '_empty', 'references'])

export interface GraphQLNameMap {
  /** GraphQL domain field name -> raw ontology domain name. */
  domains: ReadonlyMap<string, string>
  /** Raw ontology domain name -> GraphQL domain field name. */
  domainFields: ReadonlyMap<string, string>
  /** Raw ontology domain name -> (GraphQL property field name -> raw property name). */
  propertiesByDomain: ReadonlyMap<string, ReadonlyMap<string, string>>
  /** Raw ontology domain name -> (raw property name -> GraphQL property field name). */
  propertyFieldsByDomain: ReadonlyMap<string, ReadonlyMap<string, string>>
}

export class GraphQLVocabularyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GraphQLVocabularyError'
  }
}

/** Convert an ontology term into a GraphQL Name (§2.1.9). */
export function sanitizeGraphQLName(name: string): string {
  let safe = name.replace(/[^A-Za-z0-9_]/g, '_')
  if (/^[0-9]/.test(safe)) safe = `_${safe}`
  return safe.length > 0 ? safe : '_field'
}

/** Build the reversible GraphQL-name projection and reject ambiguous vocabularies. */
export function buildGraphQLNameMap(vocabulary: VocabularyResponse): GraphQLNameMap {
  const domains = new Map<string, string>()
  const domainFields = new Map<string, string>()
  const propertiesByDomain = new Map<string, ReadonlyMap<string, string>>()
  const propertyFieldsByDomain = new Map<string, ReadonlyMap<string, string>>()
  const rawDomains = new Set<string>()

  for (const rawDomain of vocabulary.domains) {
    const safeDomain = checkedName(rawDomain, 'domain')
    if (rawDomains.has(rawDomain)) {
      throw new GraphQLVocabularyError(`Duplicate domain "${rawDomain}".`)
    }
    rawDomains.add(rawDomain)
    addUnique(domains, safeDomain, rawDomain, 'domain')
    domainFields.set(rawDomain, safeDomain)
  }

  const mutableProperties = new Map<string, Map<string, string>>()
  for (const rawDomain of vocabulary.domains) {
    mutableProperties.set(rawDomain, new Map())
  }

  for (const property of vocabulary.properties) {
    const domainProperties = mutableProperties.get(property.domain)
    if (!domainProperties) {
      throw new GraphQLVocabularyError(
        `Property "${property.name}" belongs to unknown domain "${property.domain}".`
      )
    }
    const safeProperty = checkedName(property.name, `property in domain "${property.domain}"`)
    addUnique(
      domainProperties,
      safeProperty,
      property.name,
      `property in domain "${property.domain}"`
    )
  }

  for (const [domain, properties] of mutableProperties) {
    propertiesByDomain.set(domain, properties)
    propertyFieldsByDomain.set(
      domain,
      new Map([...properties].map(([safeName, rawName]) => [rawName, safeName]))
    )
  }

  const enumTypeNames = new Map<string, string>()
  const enumMembers = enumPropertyMembers(
    vocabulary.properties.filter((property) => property.type === 'enum')
  )
  for (const rawProperty of enumMembers.keys()) {
    const typeName = `${sanitizeGraphQLName(rawProperty)}_Enum`
    addUnique(enumTypeNames, typeName, rawProperty, 'enum type')
  }

  return { domains, domainFields, propertiesByDomain, propertyFieldsByDomain }
}

function checkedName(rawName: string, kind: string): string {
  const safeName = sanitizeGraphQLName(rawName)
  if (safeName.startsWith('__')) {
    throw new GraphQLVocabularyError(
      `${capitalize(kind)} "${rawName}" maps to reserved GraphQL name "${safeName}".`
    )
  }
  if (RESERVED_NAMES.has(safeName)) {
    throw new GraphQLVocabularyError(
      `${capitalize(kind)} "${rawName}" maps to reserved DSL name "${safeName}".`
    )
  }
  return safeName
}

function addUnique(
  target: Map<string, string>,
  safeName: string,
  rawName: string,
  kind: string
): void {
  const existing = target.get(safeName)
  if (existing !== undefined) {
    throw new GraphQLVocabularyError(
      `${capitalize(kind)} names "${existing}" and "${rawName}" both map to GraphQL name "${safeName}".`
    )
  }
  target.set(safeName, rawName)
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1)
}

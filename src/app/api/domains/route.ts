import { NextResponse } from 'next/server'

import { buildDomainRegistry } from '@/lib/ontology/domain-registry'

/**
 * GET /api/domains — returns available ontology domains.
 * Used by the DomainSelector component.
 */
export async function GET() {
  try {
    const registry = await buildDomainRegistry()

    const domains = registry.domainNames.map((name) => {
      const desc = registry.domains.get(name)!
      return {
        name,
        version: desc.version,
        targetClass: desc.targetClass,
        hasGeoreference: desc.hasGeoreference,
        shapeCount: desc.shapes.length,
      }
    })

    return NextResponse.json({
      domains: registry.domainNames,
      details: domains,
    })
  } catch (error) {
    console.error('Domains API error:', error)
    return NextResponse.json({ domains: [], details: [] })
  }
}

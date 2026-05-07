import { NextResponse } from 'next/server'
import { getInitializedStore } from '@/lib/search/init'

export async function GET() {
  try {
    const store = await getInitializedStore()

    const countResult = await store.query(
      `PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
       SELECT (COUNT(DISTINCT ?asset) AS ?count) WHERE { ?asset a hdmap:HdMap }`
    )

    const count = parseInt(countResult.results.bindings[0]?.count?.value || '0', 10)

    return NextResponse.json({ totalAssets: count, ontology: 'hdmap v6' })
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json({ totalAssets: 0, ontology: 'hdmap v6' })
  }
}

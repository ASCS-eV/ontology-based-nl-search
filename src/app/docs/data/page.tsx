'use client'

import { useRouter } from 'next/navigation'

import { Mermaid } from '@/components/Mermaid'
import { Slide, SlideControls, SlideDeck, SlideProvider } from '@/components/slides'

const TOTAL_SLIDES = 4

export default function DataPresentation() {
  const router = useRouter()

  return (
    <SlideProvider totalSlides={TOTAL_SLIDES} onComplete={() => router.push('/docs/roadmap')}>
      <SlideDeck>
        <Slide index={0} variant="title">
          <h1 className="text-4xl font-bold text-gray-900">Data Model</h1>
          <p className="mt-4 text-lg text-gray-500">
            Sample datasets and the knowledge graph structure
          </p>
        </Slide>

        <Slide index={1}>
          <h2 className="text-3xl font-bold text-gray-900">Knowledge Graph</h2>
          <p className="mt-4 text-gray-600">
            The system loads RDF data into a SPARQL store (Oxigraph WASM or remote endpoint). Sample
            data demonstrates the full query pipeline.
          </p>
          <div className="mt-6">
            <Mermaid
              chart={`graph TD
    TTL["Turtle files<br/>(sample assets)"] -->|"loadTurtle()"| OX["Oxigraph Store"]
    ONT["Ontology TTL<br/>(SHACL shapes)"] -->|"loadTurtle()"| OX
    OX -->|"SPARQL SELECT"| RES["Query Results"]
    style OX fill:#dbeafe,stroke:#3b82f6
    style RES fill:#dcfce7,stroke:#22c55e`}
            />
          </div>
          <p className="mt-4 text-sm text-gray-500">
            In development: Oxigraph runs in-process via WASM — no external database needed. In
            production: connects to a remote SPARQL endpoint.
          </p>
        </Slide>

        <Slide index={2}>
          <h2 className="text-3xl font-bold text-gray-900">Sample Assets</h2>
          <p className="mt-4 text-gray-600">
            The demo includes representative HD map assets covering various combinations:
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="pb-2 font-medium text-gray-700">Property</th>
                  <th className="pb-2 font-medium text-gray-700">Example Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                <tr>
                  <td className="py-2">Road Types</td>
                  <td>motorway, urban, rural, intersection</td>
                </tr>
                <tr>
                  <td className="py-2">Format</td>
                  <td>ASAM OpenDRIVE 1.6, lanelet2</td>
                </tr>
                <tr>
                  <td className="py-2">Country</td>
                  <td>DE, US, JP</td>
                </tr>
                <tr>
                  <td className="py-2">Length</td>
                  <td>5–250 km</td>
                </tr>
                <tr>
                  <td className="py-2">Traffic Signs</td>
                  <td>0–500+</td>
                </tr>
                <tr>
                  <td className="py-2">License</td>
                  <td>MIT, Apache-2.0, proprietary</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Slide>

        <Slide index={3}>
          <h2 className="text-3xl font-bold text-gray-900">SPARQL Store Abstraction</h2>
          <p className="mt-4 text-gray-600">
            The SparqlStore interface decouples the application from any specific triplestore:
          </p>
          <div className="mt-6 rounded-lg bg-gray-900 p-4 text-sm text-gray-100 overflow-x-auto">
            <pre>{`interface SparqlStore {
  query(sparql: string): Promise<SparqlResults>
  update(sparql: string): Promise<void>
  loadTurtle(data: string, graphUri?: string): Promise<void>
  loadJsonLd(data: string, graphUri?: string): Promise<void>
  isReady(): Promise<boolean>
}`}</pre>
          </div>
          <div className="mt-4 space-y-2 text-sm text-gray-600">
            <p>
              <strong>OxigraphStore</strong> — WASM-based, runs in-process, zero infrastructure
            </p>
            <p>
              <strong>RemoteSparqlStore</strong> — HTTP client for any SPARQL 1.1 endpoint
            </p>
            <p>
              <strong>CachedSparqlStore</strong> — LRU query cache decorator (wraps either)
            </p>
          </div>
        </Slide>
      </SlideDeck>

      <SlideControls />
    </SlideProvider>
  )
}

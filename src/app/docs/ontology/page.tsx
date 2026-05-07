'use client'

import { useRouter } from 'next/navigation'

import { Mermaid } from '@/components/Mermaid'
import { Slide, SlideControls, SlideDeck, SlideProvider } from '@/components/slides'

const TOTAL_SLIDES = 4

export default function OntologyPresentation() {
  const router = useRouter()

  return (
    <SlideProvider totalSlides={TOTAL_SLIDES} onComplete={() => router.push('/docs/agent')}>
      <SlideDeck>
        <Slide index={0} variant="title">
          <h1 className="text-4xl font-bold text-gray-900">Ontology Model</h1>
          <p className="mt-4 text-lg text-gray-500">
            ENVITED-X: A modular ontology for simulation asset metadata
          </p>
        </Slide>

        <Slide index={1}>
          <h2 className="text-3xl font-bold text-gray-900">Domain Structure</h2>
          <p className="mt-4 text-gray-600">
            Each simulation asset type has its own domain ontology with a consistent structure:
            Asset → Specification → (Content, Format, Quality, Quantity, DataSource, Georeference).
          </p>
          <div className="mt-6">
            <Mermaid
              chart={`graph TD
    A["Asset (e.g., HDMap)"] --> DS["hasDomainSpecification"]
    DS --> C["hasContent<br/>(road types, lanes, ...)"]
    DS --> F["hasFormat<br/>(OpenDRIVE, lanelet2, ...)"]
    DS --> Q["hasQuantity<br/>(length, intersections, ...)"]
    DS --> QL["hasQuality<br/>(accuracy, source, ...)"]
    DS --> GR["hasGeoreference<br/>(country, region, ...)"]
    style A fill:#dbeafe,stroke:#3b82f6
    style DS fill:#f0f9ff,stroke:#798bb3`}
            />
          </div>
        </Slide>

        <Slide index={2}>
          <h2 className="text-3xl font-bold text-gray-900">SKOS Vocabularies</h2>
          <p className="mt-4 text-gray-600">
            Controlled vocabularies define the valid values for each property. These are what the
            concept matcher uses to ground user input.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 text-sm">
            {[
              { vocab: 'Road Types', examples: 'motorway, urban, rural, intersection' },
              { vocab: 'Lane Types', examples: 'driving, parking, sidewalk, biking' },
              { vocab: 'Formats', examples: 'ASAM OpenDRIVE, lanelet2, road5' },
              { vocab: 'Traffic Direction', examples: 'left-hand, right-hand' },
              { vocab: 'Data Sources', examples: 'lidar, camera, surveying' },
              { vocab: 'Countries', examples: 'DE, US, JP, CN (ISO 3166-1)' },
            ].map((item) => (
              <div key={item.vocab} className="rounded-lg border border-gray-200 p-3">
                <div className="font-medium text-gray-900">{item.vocab}</div>
                <div className="mt-1 text-gray-500">{item.examples}</div>
              </div>
            ))}
          </div>
        </Slide>

        <Slide index={3}>
          <h2 className="text-3xl font-bold text-gray-900">Multi-Domain Support</h2>
          <p className="mt-4 text-gray-600">
            The system supports 13 asset domains. Cross-domain queries are possible where domains
            reference each other (e.g., a scenario referencing an HD map).
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              'hdmap',
              'scenario',
              'environment-model',
              'simulation-model',
              'simulated-sensor',
              'surface-model',
              'ositrace',
              'survey',
              'vv-report',
              'service',
              'automotive-simulator',
              'leakage-test',
              'tzip21',
            ].map((domain) => (
              <span
                key={domain}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
              >
                {domain}
              </span>
            ))}
          </div>
          <div className="mt-6">
            <Mermaid
              chart={`graph LR
    SC["Scenario"] -->|"hasReferencedArtifacts"| HD["HD Map"]
    SC -->|"hasReferencedArtifacts"| EM["Environment Model"]
    style SC fill:#848ab7,stroke:#5a6f9f,color:#fff`}
            />
          </div>
        </Slide>
      </SlideDeck>

      <SlideControls />
    </SlideProvider>
  )
}

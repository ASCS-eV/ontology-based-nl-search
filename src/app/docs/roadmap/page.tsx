'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Slide, SlideControls, SlideDeck, SlideProvider } from '@/components/slides'

const TOTAL_SLIDES = 3

export default function RoadmapPresentation() {
  const router = useRouter()

  return (
    <SlideProvider totalSlides={TOTAL_SLIDES} onComplete={() => router.push('/')}>
      <SlideDeck>
        <Slide index={0} variant="title">
          <h1 className="text-4xl font-bold text-gray-900">Roadmap</h1>
          <p className="mt-4 text-lg text-gray-500">
            What&apos;s next for ontology-based NL search
          </p>
        </Slide>

        <Slide index={1}>
          <h2 className="text-3xl font-bold text-gray-900">Upcoming</h2>
          <div className="mt-6 space-y-4">
            {[
              {
                status: '🟢',
                title: 'Full Multi-Domain Support',
                desc: 'Query any of the 13 asset domains with the same interface',
              },
              {
                status: '🟡',
                title: 'Dependency Injection',
                desc: 'Replace global singletons with injectable services for better testability',
              },
              {
                status: '🟡',
                title: 'Typed SPARQL Results',
                desc: 'Discriminated unions for SelectResult | AskResult | ConstructResult',
              },
              {
                status: '⚪',
                title: 'Structured Observability',
                desc: 'OpenTelemetry traces, correlation IDs, LLM latency metrics',
              },
              {
                status: '⚪',
                title: 'Federated Queries',
                desc: 'Cross-endpoint queries across the ENVITED-X Data Space',
              },
              {
                status: '⚪',
                title: 'Conversational Refinement',
                desc: 'Multi-turn dialogue for iterative query building',
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 text-lg">{item.status}</span>
                <div>
                  <div className="font-medium text-gray-900">{item.title}</div>
                  <div className="text-sm text-gray-500">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Slide>

        <Slide index={2} variant="cta">
          <div className="space-y-8">
            <h2 className="text-4xl font-bold text-gray-900">Ready to explore?</h2>
            <p className="text-xl text-gray-500">
              Try the live search demo or contribute on GitHub.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3 text-lg font-medium text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
              >
                Launch Demo →
              </Link>
              <a
                href="https://github.com/ASCS-eV/ontology-based-nl-search"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 text-gray-700 transition-colors hover:bg-gray-50"
              >
                GitHub Repository
              </a>
            </div>
          </div>
        </Slide>
      </SlideDeck>

      <SlideControls />
    </SlideProvider>
  )
}

'use client'

import { useRouter } from 'next/navigation'

import { Mermaid } from '@/components/Mermaid'
import { Slide, SlideControls, SlideDeck, SlideProvider } from '@/components/slides'

const TOTAL_SLIDES = 4

export default function AgentPresentation() {
  const router = useRouter()

  return (
    <SlideProvider totalSlides={TOTAL_SLIDES} onComplete={() => router.push('/docs/data')}>
      <SlideDeck>
        <Slide index={0} variant="title">
          <h1 className="text-4xl font-bold text-gray-900">Agent Design</h1>
          <p className="mt-4 text-lg text-gray-500">
            Constrained tool-use pattern for reliable structured output
          </p>
        </Slide>

        <Slide index={1}>
          <h2 className="text-3xl font-bold text-gray-900">Single-Tool Agent</h2>
          <p className="mt-4 text-gray-600">
            The agent has exactly one tool:{' '}
            <code className="rounded bg-gray-100 px-1 text-sm">submit_slots</code>. This constrains
            the LLM to produce valid, typed search parameters.
          </p>
          <div className="mt-6">
            <Mermaid
              chart={`sequenceDiagram
    participant S as System
    participant L as LLM
    participant T as submit_slots

    S->>L: Context + vocabulary + query
    L->>T: submit_slots({ filters, ranges, location })
    T-->>S: Validated SearchSlots
    Note over S: Merge with pre-matched concepts
    Note over S: Compile to SPARQL`}
            />
          </div>
        </Slide>

        <Slide index={2}>
          <h2 className="text-3xl font-bold text-gray-900">Context Engineering</h2>
          <p className="mt-4 text-gray-600">
            The system prompt includes the ontology vocabulary so the LLM knows exactly what values
            are valid. Pre-matched concepts reduce hallucination.
          </p>
          <div className="mt-6 space-y-3 text-sm">
            <div className="rounded border border-gray-200 p-3">
              <div className="font-mono text-xs text-gray-400">System prompt includes:</div>
              <ul className="mt-2 space-y-1 text-gray-700">
                <li>✓ Domain vocabulary (all valid enum values)</li>
                <li>✓ Property descriptions and constraints</li>
                <li>✓ Pre-extracted concept matches (already grounded)</li>
                <li>✓ Instructions to use submit_slots tool</li>
              </ul>
            </div>
            <div className="rounded border border-green-200 bg-green-50 p-3">
              <div className="text-green-800">
                <strong>Step limit: 3</strong> — The agent must decide quickly. With pre-extraction,
                most queries need only 1 tool call.
              </div>
            </div>
          </div>
        </Slide>

        <Slide index={3}>
          <h2 className="text-3xl font-bold text-gray-900">Provider Flexibility</h2>
          <p className="mt-4 text-gray-600">
            The agent works with multiple LLM providers through the Vercel AI SDK:
          </p>
          <div className="mt-6 space-y-3">
            {[
              { provider: 'OpenAI', desc: 'GPT-4o / GPT-4o-mini — best quality, cloud-hosted' },
              {
                provider: 'Ollama',
                desc: 'Local models (Llama, Mistral) — privacy-first, no API costs',
              },
              {
                provider: 'GitHub Copilot',
                desc: 'Native Copilot SDK integration for enterprise contexts',
              },
            ].map((item) => (
              <div
                key={item.provider}
                className="flex items-start gap-3 rounded border border-gray-200 p-3"
              >
                <span className="w-32 flex-shrink-0 font-medium text-gray-900">
                  {item.provider}
                </span>
                <span className="text-sm text-gray-600">{item.desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Configured via the AI_PROVIDER environment variable. Same agent logic, different model
            backends.
          </p>
        </Slide>
      </SlideDeck>

      <SlideControls />
    </SlideProvider>
  )
}

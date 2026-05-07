'use client'

import { useRouter } from 'next/navigation'

import { Mermaid } from '@/components/Mermaid'
import { Slide, SlideControls, SlideDeck, SlideProvider } from '@/components/slides'

const TOTAL_SLIDES = 5

export default function FlowPresentation() {
  const router = useRouter()

  return (
    <SlideProvider totalSlides={TOTAL_SLIDES} onComplete={() => router.push('/docs/ontology')}>
      <SlideDeck>
        <Slide index={0} variant="title">
          <h1 className="text-4xl font-bold text-gray-900">Query Flow</h1>
          <p className="mt-4 text-lg text-gray-500">
            From &quot;motorway maps in Germany&quot; to SPARQL results in milliseconds
          </p>
        </Slide>

        <Slide index={1}>
          <h2 className="text-3xl font-bold text-gray-900">Step 1: Concept Matching</h2>
          <p className="mt-4 text-gray-600">
            Before the LLM runs, we extract known ontology concepts from the query using SKOS
            vocabulary matching. This provides grounding and context for the agent.
          </p>
          <div className="mt-6 rounded-lg bg-gray-50 p-4 font-mono text-sm">
            <div className="text-gray-500"># Input</div>
            <div className="text-gray-900">
              &quot;motorway HD maps in Germany with OpenDRIVE&quot;
            </div>
            <div className="mt-3 text-gray-500"># Matched concepts</div>
            <div className="text-green-700">
              roadTypes: &quot;motorway&quot; (confidence: high)
              <br />
              country: &quot;DE&quot; (confidence: high)
              <br />
              formatType: &quot;ASAM OpenDRIVE&quot; (confidence: high)
            </div>
          </div>
        </Slide>

        <Slide index={2}>
          <h2 className="text-3xl font-bold text-gray-900">Step 2: LLM Slot Filling</h2>
          <p className="mt-4 text-gray-600">
            The LLM agent receives pre-matched concepts and fills remaining slots. It uses a single
            tool — <code className="rounded bg-gray-100 px-1 text-sm">submit_slots</code> — to
            declare what it found.
          </p>
          <div className="mt-6">
            <Mermaid
              chart={`graph LR
    CM["Pre-matched<br/>concepts"] --> AG["LLM Agent"]
    AG -->|"submit_slots()"| SL["SearchSlots"]
    SL --> MG["Merge with<br/>pre-matches"]
    style CM fill:#dcfce7,stroke:#22c55e
    style AG fill:#848ab7,stroke:#5a6f9f,color:#fff
    style MG fill:#dbeafe,stroke:#3b82f6`}
            />
          </div>
          <p className="mt-4 text-sm text-gray-500">
            The agent runs with a step limit of 3 — it must decide quickly. Pre-extraction means it
            rarely needs more than one tool call.
          </p>
        </Slide>

        <Slide index={3}>
          <h2 className="text-3xl font-bold text-gray-900">Step 3: Compilation &amp; Execution</h2>
          <p className="mt-4 text-gray-600">
            Filled slots are compiled into SPARQL using the domain registry. The compiler resolves
            property IRIs, builds graph patterns, and generates filters.
          </p>
          <div className="mt-6 rounded-lg bg-gray-900 p-4 text-sm text-gray-100 overflow-x-auto">
            <pre>{`PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v4.0/>
PREFIX geo:   <https://w3id.org/ascs-ev/envited-x/georeference/v4.0/>

SELECT ?asset ?name ?roadTypes ?country
WHERE {
  ?asset a hdmap:HDMap ;
         hdmap:hasContent/hdmap:roadTypes ?roadTypes ;
         geo:hasGeoreference/geo:country ?country .
  FILTER(?roadTypes = "motorway")
  FILTER(?country = "DE")
}
LIMIT 500`}</pre>
          </div>
        </Slide>

        <Slide index={4}>
          <h2 className="text-3xl font-bold text-gray-900">Step 4: Streaming Response</h2>
          <p className="mt-4 text-gray-600">Results stream progressively via Server-Sent Events:</p>
          <div className="mt-6 space-y-2 text-sm">
            {[
              { event: 'status', desc: 'Phase indicator (interpreting → executing)' },
              { event: 'interpretation', desc: 'Mapped terms with confidence levels' },
              { event: 'gaps', desc: 'Concepts not found in ontology (with suggestions)' },
              { event: 'sparql', desc: 'Generated query for transparency' },
              { event: 'results', desc: 'Matching assets as structured rows' },
              { event: 'meta', desc: 'Timing, counts, request ID' },
            ].map((item) => (
              <div
                key={item.event}
                className="flex items-center gap-3 rounded border border-gray-100 p-2"
              >
                <code className="w-28 flex-shrink-0 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                  {item.event}
                </code>
                <span className="text-gray-600">{item.desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-gray-500">
            The UI renders each phase as it arrives — users see interpretation immediately while
            SPARQL execution happens in the background.
          </p>
        </Slide>
      </SlideDeck>

      <SlideControls />
    </SlideProvider>
  )
}

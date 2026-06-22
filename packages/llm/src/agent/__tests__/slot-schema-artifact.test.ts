/**
 * I3 (architecture-improvements plan): publish the `submit_slots` contract as a
 * standalone, versioned JSON Schema artifact.
 *
 * The slot interface is the system's central contract — the LLM fills it, the
 * compiler consumes it, and partners would target it. It is already grounded in
 * JSON Schema 2020-12 (the Vercel AI SDK serializes the Zod tool schema to JSON
 * Schema for the model). This test emits that schema to a checked-in artifact
 * via Zod 4's native `z.toJSONSchema` and guards it against drift: any change to
 * `slotSubmissionSchema` that is not reflected in the published artifact fails
 * CI. Regenerate intentionally with `pnpm --filter @ontology-search/llm test -u`.
 *
 * Standards: [JSON-SCHEMA-CORE] JSON Schema 2020-12
 * (docs/specs/references/json-schema-core.md). The emitted `$schema` is the
 * 2020-12 dialect IRI, so the artifact is independently validatable.
 */
import { z } from 'zod'

import { slotSubmissionSchema } from '../tools.js'

describe('submit_slots JSON Schema artifact', () => {
  it('matches the published JSON Schema 2020-12 contract', async () => {
    const jsonSchema = z.toJSONSchema(slotSubmissionSchema, { target: 'draft-2020-12' })

    // Sanity: the emitted artifact declares the 2020-12 dialect.
    expect(jsonSchema['$schema']).toBe('https://json-schema.org/draft/2020-12/schema')

    const serialized = JSON.stringify(jsonSchema, null, 2) + '\n'
    await expect(serialized).toMatchFileSnapshot('../../../schema/submit-slots.schema.json')
  })
})

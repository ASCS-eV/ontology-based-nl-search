# Agent Design

## Architecture

The LLM agent uses a **slot-filling** approach rather than direct SPARQL generation:

1. Agent receives query + ontology context
2. Agent calls `submit_slots` tool with structured data
3. Tool validates slots against domain schema
4. Compiler generates SPARQL deterministically

## Why Slot-Based?

| Direct SPARQL Generation     | Slot-Based Approach               |
| ---------------------------- | --------------------------------- |
| LLM can hallucinate queries  | Compiler produces verified SPARQL |
| Hard to validate correctness | Slots can be schema-validated     |
| Varies with prompt wording   | Deterministic compilation         |
| Difficult to refine          | Users can edit individual slots   |

## Tool Definition

The agent has a single tool: `submit_slots`

```typescript
{
  name: "submit_slots",
  description: "Submit structured search parameters",
  parameters: SearchSlotsSchema
}
```

## Ontology Context

The agent prompt includes:

- Domain descriptions and available properties
- Vocabulary values with their labels
- Glossary definitions for domain concepts
- Example queries with expected slot outputs

import inventoryJson from './candidates.json' with { type: 'json' }
import { type CandidateInventory, CandidateInventorySchema } from './types.js'

export const candidateInventory: CandidateInventory = CandidateInventorySchema.parse(inventoryJson)

export function getCandidate(id: string) {
  const candidate = candidateInventory.candidates.find((value) => value.id === id)
  if (!candidate) {
    throw new Error(
      `Unknown candidate "${id}". Available: ${candidateInventory.candidates
        .map((value) => value.id)
        .join(', ')}`
    )
  }
  return candidate
}

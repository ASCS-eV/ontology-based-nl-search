import type { z } from 'zod'

import type { GoldCase } from './types.js'
import type { ProfileNameSchema } from './types.js'

export type ProfileName = z.infer<typeof ProfileNameSchema>

export interface ProfilePlan {
  cases: GoldCase[]
  repetitions: number
  warmups: number
}

export function planProfile(
  profile: ProfileName,
  qualityCases: GoldCase[],
  protocolCases: GoldCase[]
): ProfilePlan {
  switch (profile) {
    case 'protocol':
      return { cases: protocolCases, repetitions: 3, warmups: 0 }
    case 'quality':
      return { cases: qualityCases, repetitions: 3, warmups: 0 }
    case 'warm-performance':
      return { cases: qualityCases, repetitions: 5, warmups: 2 }
    case 'cold-load':
      return { cases: qualityCases.slice(0, 1), repetitions: 1, warmups: 0 }
    case 'capacity':
      return { cases: [], repetitions: 1, warmups: 0 }
  }
}

/** Deterministic repetition-major round robin: every case once before repeats. */
export function roundRobinSamples(plan: ProfilePlan): Array<{
  gold: GoldCase
  repetition: number
  warmup: boolean
}> {
  const output: Array<{ gold: GoldCase; repetition: number; warmup: boolean }> = []
  for (let repetition = 1; repetition <= plan.warmups; repetition += 1) {
    for (const gold of plan.cases) output.push({ gold, repetition, warmup: true })
  }
  for (let repetition = 1; repetition <= plan.repetitions; repetition += 1) {
    for (const gold of plan.cases) output.push({ gold, repetition, warmup: false })
  }
  return output
}

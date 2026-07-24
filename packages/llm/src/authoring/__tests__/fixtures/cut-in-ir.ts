import type { AuthoringIR } from '@ontology-search/authoring-ir'

/**
 * A realistic cut-in {@link AuthoringIR} — the generic, SHACL-keyed scene the
 * LLM would fill: an ego plus two neighbours, initial speeds and teleports, and
 * a single lane-change maneuver. Used to drive the deterministic scene pipeline
 * (semantic gate → lower → structural gate) against the real WASM engine, no LLM
 * in the loop.
 */
export function cutInIR(): AuthoringIR {
  return {
    archetype: 'cut-in',
    roadNetwork: { logicFile: 'german_highway_short.xodr' },
    parameters: { owner: 'A2' },
    entities: [
      { ref: 'Ego', type: 'Vehicle', properties: { name: 'HAF', vehicleCategory: 'car' } },
      { ref: 'A1', type: 'Vehicle', properties: { name: 'Default_Car', vehicleCategory: 'car' } },
      { ref: 'A2', type: 'Vehicle', properties: { name: 'Default_Car', vehicleCategory: 'car' } },
    ],
    actions: [
      { actor: 'Ego', kind: 'SpeedAction', properties: { speed: '27.778' } },
      {
        actor: 'Ego',
        kind: 'TeleportAction',
        properties: { roadId: '37', laneId: '-3', s: '500', offset: '0.5' },
      },
      { actor: 'A1', kind: 'SpeedAction', properties: { speed: '27.778' } },
      {
        actor: 'A1',
        kind: 'TeleportAction',
        properties: { dLane: '0', ds: '84' },
        references: { relativeTo: 'Ego' },
      },
      { actor: 'A2', kind: 'SpeedAction', properties: { speed: '30.556' } },
      {
        actor: 'A2',
        kind: 'TeleportAction',
        properties: { dLane: '-1', ds: '-100' },
        references: { relativeTo: 'Ego' },
      },
      {
        actor: 'A2',
        kind: 'LaneChangeAction',
        properties: {
          startTime: '2',
          targetLaneOffset: '0',
          dynamicsShape: 'cubic',
          dynamicsDimension: 'distance',
          dynamicsValue: '54.8',
          targetValue: '0',
        },
        references: { relativeTo: 'Ego' },
      },
    ],
  }
}

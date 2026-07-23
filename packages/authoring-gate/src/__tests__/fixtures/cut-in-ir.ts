import type { AuthoringIR } from '@ontology-search/authoring-ir'

/**
 * A realistic cut-in {@link AuthoringIR} used to exercise the semantic gate: an
 * ego plus two neighbours, an absolute teleport carrying a cross-file `roadId`,
 * relative teleports, and a lane-change. Valid by construction — all references
 * resolve, all names unique — so the gate returns zero gaps; the tests tamper a
 * deep clone to make each check fire.
 */
export function cutInIR(): AuthoringIR {
  return {
    archetype: 'cut-in',
    roadNetwork: { logicFile: 'Databases/AB_RQ31_Straight.xodr' },
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
        properties: { roadId: '1', laneId: '-3', s: '1000', offset: '0.5' },
      },
      { actor: 'A1', kind: 'SpeedAction', properties: { speed: '27.778' } },
      {
        actor: 'A2',
        kind: 'LaneChangeAction',
        properties: { targetLaneOffset: '0', dynamicsValue: '54.8' },
        references: { relativeTo: 'Ego', entityRef: '$owner' },
      },
    ],
  }
}

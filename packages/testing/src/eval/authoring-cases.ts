/**
 * Authoring eval cases and their recorded submissions.
 *
 * FIXTURE DATA, not production code — naming the OpenSCENARIO classes and
 * properties here is what grounds the eval. Each case states the fields a
 * correct scene must carry and the concepts the model must report as gaps;
 * `RECORDED_SUBMISSIONS` holds one submission per case for the deterministic
 * mode, written in the shape the `submit_scene` tool takes.
 */
import type { SceneSubmissionParams } from '@ontology-search/llm/authoring'

import type { AuthoringCase } from './authoring-eval.js'

export const AUTHORING_EVAL_CASES: AuthoringCase[] = [
  {
    name: 'cut-in on a three-lane motorway',
    request:
      'A cut-in on a three-lane motorway: the ego car drives at 25 m/s in the inner lane; ' +
      'a second car behind it in the outer lane drives at the same speed and cuts in ' +
      'in front of the ego car after 2 seconds.',
    archetype: 'cut-in',
    fields: {
      'entities.count': '2',
      'entities.types': 'Vehicle,Vehicle',
      'entity.Ego.vehicleCategory': 'car',
      'action.Ego.SpeedAction.speed': '25',
      'action.CutIn.SpeedAction.speed': '25',
      'action.CutIn.LaneChangeAction.startTime': '2',
      'action.CutIn.LaneChangeAction.references.relativeTo': 'Ego',
    },
    gaps: [],
    valid: true,
    gating: true,
  },
  {
    name: 'traffic light the scene cannot express',
    request:
      'One car drives at 10 m/s towards a junction whose traffic light turns red after 5 seconds.',
    fields: {
      'entities.count': '1',
      'action.Ego.SpeedAction.speed': '10',
    },
    gaps: ['traffic light'],
    valid: true,
    gating: true,
  },
  {
    name: 'ambiguous: two cars somewhere',
    request: 'Two cars on a road.',
    fields: { 'entities.count': '2' },
    gaps: [],
    gating: false,
  },
]

const interpretation = (summary: string): SceneSubmissionParams['interpretation'] => ({
  summary,
  mappedTerms: [],
})

export const RECORDED_SUBMISSIONS: Record<string, SceneSubmissionParams> = {
  'cut-in on a three-lane motorway': {
    scene: {
      archetype: 'cut-in',
      entities: [
        { ref: 'Ego', type: 'Vehicle', properties: { vehicleCategory: 'car' } },
        { ref: 'CutIn', type: 'Vehicle', properties: { vehicleCategory: 'car' } },
      ],
      actions: [
        {
          actor: 'Ego',
          kind: 'TeleportAction',
          properties: { roadId: '37', laneId: '-3', s: '100', offset: '0' },
        },
        { actor: 'Ego', kind: 'SpeedAction', properties: { speed: '25' } },
        {
          actor: 'CutIn',
          kind: 'TeleportAction',
          properties: { roadId: '37', laneId: '-4', s: '150', offset: '0' },
        },
        { actor: 'CutIn', kind: 'SpeedAction', properties: { speed: '25' } },
        {
          actor: 'CutIn',
          kind: 'LaneChangeAction',
          properties: {
            targetLaneOffset: '-1',
            dynamicsShape: 'linear',
            dynamicsDimension: 'time',
            dynamicsValue: '3',
            startTime: '2',
          },
          references: { relativeTo: 'Ego' },
        },
      ],
      stopTime: 10,
    },
    interpretation: interpretation(
      'A cut-in on a motorway: the ego car at 25 m/s, a second car cuts in after 2 s.'
    ),
    gaps: [],
  },
  'traffic light the scene cannot express': {
    scene: {
      entities: [{ ref: 'Ego', type: 'Vehicle', properties: { vehicleCategory: 'car' } }],
      actions: [
        {
          actor: 'Ego',
          kind: 'TeleportAction',
          properties: { roadId: '37', laneId: '-3', s: '100', offset: '0' },
        },
        { actor: 'Ego', kind: 'SpeedAction', properties: { speed: '10' } },
      ],
      stopTime: 10,
    },
    interpretation: interpretation('One car at 10 m/s.'),
    gaps: [
      {
        term: 'traffic light',
        reason: 'The scene IR has no traffic signal state, so the red phase cannot be expressed.',
      },
    ],
  },
  'ambiguous: two cars somewhere': {
    scene: {
      entities: [
        { ref: 'Ego', type: 'Vehicle', properties: { vehicleCategory: 'car' } },
        { ref: 'Other', type: 'Vehicle', properties: { vehicleCategory: 'car' } },
      ],
      actions: [
        {
          actor: 'Ego',
          kind: 'TeleportAction',
          properties: { roadId: '37', laneId: '-3', s: '100', offset: '0' },
        },
        {
          actor: 'Other',
          kind: 'TeleportAction',
          properties: { roadId: '37', laneId: '-4', s: '150', offset: '0' },
        },
      ],
    },
    interpretation: interpretation('Two cars on the road.'),
    gaps: [],
  },
}

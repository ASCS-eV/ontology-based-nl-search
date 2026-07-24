import type { AuthoringIR, SceneAction, SceneEntity } from '@ontology-search/authoring-ir'

interface SceneSummaryProps {
  scene: AuthoringIR
}

/** Render a property map generically — no ontology-specific keys are hardcoded,
 *  so the summary stays schema-agnostic (it works for any IR the engine emits). */
function PropertyList({ properties }: { properties: Record<string, string | string[]> }) {
  const entries = Object.entries(properties)
  if (entries.length === 0) return null
  return (
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {entries.map(([key, value]) => (
        <span key={key} className="contents">
          <dt className="font-mono text-gray-400">{key}</dt>
          <dd className="text-gray-700 break-words">
            {Array.isArray(value) ? value.join(', ') : value}
          </dd>
        </span>
      ))}
    </dl>
  )
}

function EntityCard({ entity }: { entity: SceneEntity }) {
  return (
    <div className="px-3 py-2 border border-gray-200 rounded-lg bg-white">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-800 text-sm">{entity.ref}</span>
        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-mono">
          {entity.type}
        </span>
      </div>
      <PropertyList properties={entity.properties} />
    </div>
  )
}

function ActionCard({ action }: { action: SceneAction }) {
  const refs = action.references ? Object.entries(action.references) : []
  return (
    <div className="px-3 py-2 border border-gray-200 rounded-lg bg-white">
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-xs font-mono">
          {action.kind}
        </span>
        <span className="text-xs text-gray-400">actor</span>
        <span className="font-medium text-gray-800 text-sm">{action.actor}</span>
        {refs.map(([name, target]) => (
          <span key={name} className="text-xs text-gray-500">
            {name} → <span className="font-medium text-gray-700">{target}</span>
          </span>
        ))}
      </div>
      <PropertyList properties={action.properties} />
    </div>
  )
}

/**
 * A read-only, schema-agnostic overview of the authored scene IR: its road
 * network, parameters, entities and actions. This is the structured companion
 * to the `.xosc` preview — it visualizes *what was authored* without hand-rolling
 * a geometry renderer. Geometry-accurate visual playback is intentionally left
 * to the esmini WebAssembly engine (`esminiJS` `get_road_geometry()` + a
 * three.js viewer), the maintained upstream path, rather than reinvented here.
 */
export function SceneSummary({ scene }: SceneSummaryProps) {
  const params = scene.parameters ? Object.entries(scene.parameters) : []
  return (
    <div className="w-full space-y-4" role="region" aria-label="Authored scene overview">
      {scene.roadNetwork?.logicFile && (
        <p className="text-xs text-gray-500">
          Road network:{' '}
          <code className="font-mono text-gray-700">{scene.roadNetwork.logicFile}</code>
        </p>
      )}

      {params.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Parameters
          </h3>
          <div className="flex flex-wrap gap-2">
            {params.map(([name, value]) => (
              <code
                key={name}
                className="px-2 py-1 rounded bg-gray-50 border border-gray-200 text-xs font-mono text-gray-700"
              >
                {name} = {value}
              </code>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Entities ({scene.entities.length})
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {scene.entities.map((entity) => (
            <EntityCard key={entity.ref} entity={entity} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Actions ({scene.actions.length})
        </h3>
        <div className="space-y-2">
          {scene.actions.map((action, i) => (
            <ActionCard key={i} action={action} />
          ))}
        </div>
      </div>
    </div>
  )
}

import {
  actionPath,
  type AuthoringIR,
  entityPath,
  type IrValuePath,
  type LoweringDefault,
  type SceneAction,
  type SceneAssumption,
  type SceneEntity,
} from '@ontology-search/authoring-ir'

interface SceneSummaryProps {
  scene: AuthoringIR
  /** Values the model chose without the user stating them, by IR value path. */
  assumptions?: readonly SceneAssumption[]
  /** Values the lowering filled in because the scene carries none. */
  loweringDefaults?: readonly LoweringDefault[]
}

/** Where each marked value came from, looked up by IR value path. */
interface Provenance {
  assumed: ReadonlyMap<IrValuePath, string>
  defaults: readonly LoweringDefault[]
}

/** Marks a value the model chose; the reason is the model's. */
function AssumedMark({ reason }: { reason: string }) {
  return (
    <span
      className="ml-1.5 px-1 rounded bg-amber-50 text-amber-700 text-[10px] uppercase tracking-wide"
      title={reason}
    >
      assumed
    </span>
  )
}

/** Marks a value the lowering filled in. */
function DefaultMark({ reason }: { reason: string }) {
  return (
    <span
      className="ml-1.5 px-1 rounded bg-gray-100 text-gray-500 text-[10px] uppercase tracking-wide"
      title={reason}
    >
      default
    </span>
  )
}

/**
 * Render a property map generically — no ontology-specific keys are hardcoded,
 * so the summary stays schema-agnostic (it works for any IR the engine emits).
 * A property the model assumed carries a mark; the values the lowering fills
 * for this element follow as their own marked rows.
 */
function PropertyList({
  properties,
  pathOf,
  provenance,
}: {
  properties: Record<string, string | string[]>
  pathOf: (property: string) => IrValuePath
  provenance: Provenance
}) {
  const entries = Object.entries(properties)
  const prefix = pathOf('')
  const defaults = provenance.defaults.filter(
    (d) => d.path.startsWith(prefix) && !(d.path.slice(prefix.length) in properties)
  )
  if (entries.length === 0 && defaults.length === 0) return null
  return (
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {entries.map(([key, value]) => {
        const reason = provenance.assumed.get(pathOf(key))
        return (
          <span key={key} className="contents">
            <dt className="font-mono text-gray-400">{key}</dt>
            <dd className="text-gray-700 break-words">
              {Array.isArray(value) ? value.join(', ') : value}
              {reason !== undefined && <AssumedMark reason={reason} />}
            </dd>
          </span>
        )
      })}
      {defaults.map((d) => (
        <span key={d.path} className="contents">
          <dt className="font-mono text-gray-300">{d.path.slice(prefix.length)}</dt>
          <dd className="text-gray-400 italic break-words">
            {d.value}
            <DefaultMark reason={d.reason} />
          </dd>
        </span>
      ))}
    </dl>
  )
}

function EntityCard({ entity, provenance }: { entity: SceneEntity; provenance: Provenance }) {
  const assumed = provenance.assumed.get(entityPath(entity.ref))
  const whole = provenance.defaults.filter((d) => d.path === entityPath(entity.ref))
  return (
    <div className="px-3 py-2 border border-gray-200 rounded-lg bg-white">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-800 text-sm">{entity.ref}</span>
        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-mono">
          {entity.type}
        </span>
        {assumed !== undefined && <AssumedMark reason={assumed} />}
      </div>
      <PropertyList
        properties={entity.properties}
        pathOf={(property) => `${entityPath(entity.ref)}.${property}`}
        provenance={provenance}
      />
      {whole.map((d) => (
        <p key={d.value} className="mt-1 text-xs text-gray-400 italic">
          {d.value}
          <DefaultMark reason={d.reason} />
        </p>
      ))}
    </div>
  )
}

function ActionCard({
  action,
  provenance,
}: {
  action: SceneAction
  /** Undefined for an action a path cannot name (not the first of its kind by its actor). */
  provenance: Provenance | undefined
}) {
  const refs = action.references ? Object.entries(action.references) : []
  const own = actionPath(action.actor, action.kind)
  const assumed = provenance?.assumed.get(own)
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
        {assumed !== undefined && <AssumedMark reason={assumed} />}
      </div>
      <PropertyList
        properties={action.properties}
        pathOf={(property) => `${own}.${property}`}
        provenance={provenance ?? { assumed: new Map(), defaults: [] }}
      />
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
export function SceneSummary({
  scene,
  assumptions = [],
  loweringDefaults = [],
}: SceneSummaryProps) {
  const params = scene.parameters ? Object.entries(scene.parameters) : []
  const provenance: Provenance = {
    assumed: new Map(assumptions.map((a) => [a.path, a.reason])),
    defaults: loweringDefaults,
  }
  const roadAssumed = provenance.assumed.get('roadNetwork.logicFile')
  const stopTimeAssumed = provenance.assumed.get('stopTime')
  const stopTimeDefault = loweringDefaults.find((d) => d.path === 'stopTime')
  // A path names the first action of a kind by an actor, so only that action
  // can carry marks.
  const seen = new Set<string>()
  const named = scene.actions.map((a) => {
    const path = actionPath(a.actor, a.kind)
    const first = !seen.has(path)
    seen.add(path)
    return first
  })
  return (
    <div className="w-full space-y-4" role="region" aria-label="Authored scene overview">
      {(assumptions.length > 0 || loweringDefaults.length > 0) && (
        <p className="text-xs text-gray-500">
          Values marked <AssumedMark reason="chosen by the model" /> were chosen by the model
          without being stated; values marked <DefaultMark reason="filled by the lowering" /> were
          filled in by the lowering. Hover a mark for the reason.
        </p>
      )}
      {scene.roadNetwork?.logicFile && (
        <p className="text-xs text-gray-500">
          Road network:{' '}
          <code className="font-mono text-gray-700">{scene.roadNetwork.logicFile}</code>
          {roadAssumed !== undefined && <AssumedMark reason={roadAssumed} />}
        </p>
      )}
      {(scene.stopTime !== undefined || stopTimeDefault) && (
        <p className="text-xs text-gray-500">
          Stop time:{' '}
          <code className="font-mono text-gray-700">
            {scene.stopTime ?? stopTimeDefault?.value} s
          </code>
          {stopTimeAssumed !== undefined && <AssumedMark reason={stopTimeAssumed} />}
          {scene.stopTime === undefined && stopTimeDefault && (
            <DefaultMark reason={stopTimeDefault.reason} />
          )}
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
                {provenance.assumed.has(`parameters.${name}`) && (
                  <AssumedMark reason={provenance.assumed.get(`parameters.${name}`)!} />
                )}
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
            <EntityCard key={entity.ref} entity={entity} provenance={provenance} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Actions ({scene.actions.length})
        </h3>
        <div className="space-y-2">
          {scene.actions.map((action, i) => (
            <ActionCard key={i} action={action} provenance={named[i] ? provenance : undefined} />
          ))}
        </div>
      </div>
    </div>
  )
}

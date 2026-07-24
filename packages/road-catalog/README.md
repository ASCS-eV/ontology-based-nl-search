# @ontology-search/road-catalog

A curated catalog of OpenDRIVE (`.xodr`) road networks, keyed by the `logicFile`
name a scenario's `<RoadNetwork><LogicFile>` references.

## Why

The authoring pipeline emits a `.xosc` that _names_ a road network but does not
produce road geometry. Three consumers need that geometry, and they must all use
**the same bytes** or they disagree about what the scenario means:

1. the **authoring gates** — the semantic cross-file `.xosc`↔`.xodr` check and the
   residual road-geometry gate bind the `.xodr` so they actually run (otherwise
   both are reported `skipped`);
2. the **self-test** — esmini headless + the ASAM qc-framework + the XSD schema
   check validate against the road;
3. the **browser scenario viewer** — mounts the road into the engine's file system
   to render and replay the scenario.

This package is the single source: `getRoad(logicFile)` returns the road bytes and
its topology to all three. _What you validate is what you see._

## What is vendored

One pinned, license-clean road from
[`Persival-GmbH/asam-openx-assets`](https://github.com/Persival-GmbH/asam-openx-assets)
(MPL-2.0), via the git submodule `submodules/asam-openx-assets`:

- `german_highway_short.xodr` — a German highway (right-hand traffic), two driving
  lanes per direction, no junctions.

Only the plain-text `.xodr` is used; the submodule's 3D media (Git LFS) is not
fetched. See `NOTICE` for attribution.

## Discovered, not hand-authored

`native/generate.mjs` parses each `.xodr` and **discovers** its topology (traffic
rule, roads, per-road length, drivable lanes, entry road) directly from the
geometry, then embeds the bytes + topology into the committed
`src/road-data.generated.ts`. No OpenDRIVE id is typed by hand, so the catalog can
never drift from the road the simulator loads.

```bash
pnpm --filter @ontology-search/road-catalog generate
```

CI never runs the generator — the generated module is committed, exactly like the
prebuilt WASM engines in this repo. Regenerate only when bumping the submodule pin,
then commit the regenerated module.

## API

| Export                        | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `ROADS`                       | All catalog roads.                                            |
| `getRoad(logicFile)`          | Resolve a road by `logicFile` (matched on the bare filename). |
| `defaultRoad()`               | The archetype road.                                           |
| `entrySegment(road)`          | The road's entry segment (default placement road).            |
| `travelSideLanes(road)`       | Drivable travel-side lanes, ordered inner→outer.              |
| `describeRoadForPrompt(road)` | Placement guidance derived from the topology, for the prompt. |

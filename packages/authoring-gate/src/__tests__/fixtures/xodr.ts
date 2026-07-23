/**
 * OpenDRIVE `.xodr` fixtures for the gates.
 *
 * `CONTINUOUS_XODR` is a valid road (id 1) whose planView joins line → spiral →
 * arc with continuous heading (G1) and curvature (G2). `DISCONTINUOUS_XODR` joins
 * line → arc directly with a heading jump, violating both. `NO_ROAD_ONE_XODR`
 * has a different road id so the cross-file reference (roadId "1") cannot resolve.
 */

/** Road id 1, geometrically continuous (line → clothoid → arc). */
export const CONTINUOUS_XODR = `<?xml version="1.0" encoding="UTF-8"?>
<OpenDRIVE>
  <road name="R1" length="180" id="1" junction="-1">
    <planView>
      <geometry s="0" x="0" y="0" hdg="0" length="100"><line/></geometry>
      <geometry s="100" x="100" y="0" hdg="0" length="50"><spiral curvStart="0" curvEnd="0.01"/></geometry>
      <geometry s="150" x="150" y="0" hdg="0.25" length="30"><arc curvature="0.01"/></geometry>
    </planView>
  </road>
</OpenDRIVE>`

/** Road id 1, geometrically discontinuous (line → arc, heading + curvature jump). */
export const DISCONTINUOUS_XODR = `<?xml version="1.0" encoding="UTF-8"?>
<OpenDRIVE>
  <road name="R1" length="150" id="1" junction="-1">
    <planView>
      <geometry s="0" x="0" y="0" hdg="0" length="100"><line/></geometry>
      <geometry s="100" x="100" y="0" hdg="0.5" length="50"><arc curvature="0.02"/></geometry>
    </planView>
  </road>
</OpenDRIVE>`

/** A valid road network that does NOT contain road id 1 (id 5 instead). */
export const NO_ROAD_ONE_XODR = `<?xml version="1.0" encoding="UTF-8"?>
<OpenDRIVE>
  <road name="R5" length="100" id="5" junction="-1">
    <planView>
      <geometry s="0" x="0" y="0" hdg="0" length="100"><line/></geometry>
    </planView>
  </road>
</OpenDRIVE>`

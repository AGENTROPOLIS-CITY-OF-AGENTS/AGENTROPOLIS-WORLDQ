// serialize.mjs - JSON scene serialization STUB only (no save/load yet).
// Returns a JSON object conforming to the PROVISIONAL v0.2.0 scene schema
// shape. Status is PROVISIONAL. MATH54 and POM54 semantics are PROVISIONAL.
// No em dashes in this file.
import { AGENT_STATE_NAMES } from "../../ecs/src/components.mjs";

export const SCENE_SCHEMA_VERSION = "0.2.0";
export const SCENE_STATUS = "PROVISIONAL";

export function serializeScene(world, district) {
  const histogram = {};
  for (const name of AGENT_STATE_NAMES) histogram[name] = 0;
  let count = 0;
  if (world) {
    world.forEachAlive(function (index) {
      count += 1;
      const name = AGENT_STATE_NAMES[world.agents.state[index]] || "UNKNOWN";
      histogram[name] = (histogram[name] || 0) + 1;
    });
  }
  const towers = [];
  if (district && Array.isArray(district.towers)) {
    for (const t of district.towers) {
      towers.push({ id: t.id, sign: t.sign, tag: t.tag || "", x: t.x, z: t.z, h: t.h, w: t.w, d: t.d, accent: t.accent, shape: t.shape || "" });
    }
  }
  return {
    schema_version: SCENE_SCHEMA_VERSION,
    status: SCENE_STATUS,
    mode: "development",
    geometry: "procedural",
    note: "PROVISIONAL v0.2.0 scene stub. No save or load yet. Geometry is procedural development mode, not final art.",
    towers: towers,
    agents: { count: count, stateHistogram: histogram },
  };
}

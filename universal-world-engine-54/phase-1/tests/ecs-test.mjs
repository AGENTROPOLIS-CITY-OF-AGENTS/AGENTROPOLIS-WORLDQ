// ecs-test.mjs - ECS core: spawn/iterate/destroy 100 entities, no leaks.
// P1.2 exit check: a test spawns 100 entities, iterates them, and
// destroys them with no leaks in the component arrays.
import { World } from "../ecs/src/world.mjs";
import {
  AGENT_STATE, ROLE, RISK_TIER, CAP, CAP_NAMES,
  capNamesFromMask, capMaskFromNames, agentIdString,
} from "../ecs/src/components.mjs";
import { SystemRunner } from "../ecs/src/systems.mjs";

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.error("FAIL:", label); }
  else console.log("ok:", label);
};

// Spawn 100, iterate in ascending order, destroy all.
{
  const w = new World(100);
  const ids = [];
  for (let i = 0; i < 100; i++) ids.push(w.createEntity());
  check(w.aliveCount === 100, "100 entities alive after spawn");
  check(ids[0] === 0 && ids[99] === 99, "ids allocated 0..99 in order");
  const seen = [];
  w.forEachAlive((id) => seen.push(id));
  check(seen.length === 100 && seen[0] === 0 && seen[99] === 99, "forEachAlive visits ascending 0..99");
  check(w.aliveIds().length === 100, "aliveIds lists 100");
  for (const id of ids) w.destroyEntity(id);
  check(w.aliveCount === 0, "aliveCount 0 after destroying all");
  // No leaks: component arrays zeroed on destroy.
  let leaked = 0;
  for (let i = 0; i < 100; i++) {
    if (w.agents.state[i] !== 0 || w.agents.balance[i] !== 0 || w.agents.capMask[i] !== 0) leaked++;
  }
  check(leaked === 0, "component arrays zeroed after destroy (" + leaked + " leaked)");
  // Reuse: freed ids come back via the free list.
  const a = w.createEntity();
  const b = w.createEntity();
  check(w.aliveCount === 2, "spawn after destroy works (aliveCount 2)");
  check(a !== b, "reused ids are distinct");
}

// Capacity: 101st spawn throws.
{
  const w = new World(100);
  for (let i = 0; i < 100; i++) w.createEntity();
  let threw = false;
  try { w.createEntity(); } catch { threw = true; }
  check(threw, "101st spawn throws at capacity 100");
  check(w.destroyEntity(999) === false, "destroy of out-of-range id returns false");
  check(w.isAlive(-1) === false && w.isAlive(100) === false, "isAlive false out of range");
}

// Capability mask round-trip (sorted order is load-bearing).
{
  check(JSON.stringify(capNamesFromMask(CAP.spend | CAP.read)) === '["spend","read"]', "cap names sorted");
  check(JSON.stringify(capNamesFromMask(31)) === JSON.stringify(CAP_NAMES), "full mask gives all caps sorted");
  check(capMaskFromNames(["settle", "spend"]) === (CAP.settle | CAP.spend), "mask from names");
  check(agentIdString(0) === "agent-000" && agentIdString(99) === "agent-099", "id strings zero-padded");
}

// State/role/tier enums.
{
  check(AGENT_STATE.NORMAL === 0 && AGENT_STATE.QUARANTINED === 2 && AGENT_STATE.REAUTHORIZED === 5, "state codes");
  check(ROLE.OWNER === 0 && ROLE.GUEST === 3, "role codes");
  check(RISK_TIER.LOW === 0 && RISK_TIER.CRITICAL === 3, "tier codes");
}

// SystemRunner: fixed order, all systems run per tick.
{
  const w = new World(10);
  const order = [];
  const runner = new SystemRunner();
  runner.add("first", () => order.push("first"));
  runner.add("second", () => order.push("second"));
  runner.add("third", () => order.push("third"));
  runner.run(w, 0, {});
  runner.run(w, 1, {});
  check(order.join(",") === "first,second,third,first,second,third", "systems run in registration order each tick");
  check(runner.names.join(",") === "first,second,third", "runner names listed");
}

if (failures) {
  console.error(`ecs-test: FAIL (${failures} failures)`);
  process.exit(1);
}
console.log("ecs-test: PASS");

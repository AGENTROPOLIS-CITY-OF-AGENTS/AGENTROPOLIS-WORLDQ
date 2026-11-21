// population.mjs - 100-agent seeded population + dependency graph, ECS port.
// Ported from 54T Stage B src/population.mjs (behavior 1:1). The one
// structural change is storage: agent state lives in the ECS World SoA
// (typed arrays in ecs/src/components.mjs), and the agent objects this
// module returns are live facades over that SoA (getters and setters),
// not a second copy of state. Static fields (role, tenant, district,
// capabilities, spendCap, expiryTick, dependency lists) are fixed at
// build time. The RENDER-ONLY pos/prev arrays are never read or written
// here.
//
// Graph rules (same as POM54, same as Stage B):
// - Ring edges for connectivity plus random edges to avg degree 3.
// - Redundant (backup) provider links are BACKUP capability links, not
//   required dependencies; each live backup can substitute for exactly
//   one failed required dependency; holding backups costs +1 latency.
// CASCADE-COUNTING RULE (POM54): cascade size counts DIRECT dependents
// only. Transitive second-order effects are NOT counted; dependents are
// not themselves marked dead by a cascade.
// Roles: OWNER (2), ADMIN (8), USER (70), GUEST (20), assigned
// deterministically by seeded shuffle. Tenants: tenant-0..3.
import { mulberry32, randInt, randPick } from "../../../engine/src/index.mjs";
import { World } from "../../../ecs/src/world.mjs";
import {
  AGENT_STATE,
  AGENT_STATE_NAMES,
  RISK_TIER,
  RISK_TIER_NAMES,
  ROLE,
  ROLE_NAMES,
  TENANTS,
  DISTRICTS,
  agentIdString,
  capMaskFromNames,
  capNamesFromMask,
} from "../../../ecs/src/components.mjs";

export const N_AGENTS = 100;
export const CAPS_POOL = ["spend", "read", "route", "verify", "settle"];
export { TENANTS, DISTRICTS };

// Entity index for an agent id string ("agent-042" -> 42). Id strings
// are zero-padded, so string order equals index order.
export function agentIndexFromId(agentId) {
  return Number(agentId.slice(agentId.lastIndexOf("-") + 1));
}

// Live facade over one entity's SoA row. Reads and writes go through
// the typed arrays; the facade holds no sim state of its own (static
// fields are passed in once at build time and never change).
function makeAgentFacade(world, index, statics) {
  const soa = world.agents;
  return {
    id: agentIdString(index),
    index,
    role: statics.role,
    tenant: statics.tenant,
    district: statics.district,
    capabilities: statics.capabilities,
    spendCap: statics.spendCap,
    expiryTick: statics.expiryTick,
    dependencies: statics.dependencies,
    dependents: statics.dependents,
    redundantProviders: statics.redundantProviders,
    get state() {
      return AGENT_STATE_NAMES[soa.state[index]];
    },
    set state(name) {
      soa.state[index] = AGENT_STATE[name];
    },
    get riskLevel() {
      return soa.riskLevel[index];
    },
    set riskLevel(v) {
      soa.riskLevel[index] = v;
    },
    get riskTier() {
      return RISK_TIER_NAMES[soa.riskTier[index]];
    },
    set riskTier(name) {
      soa.riskTier[index] = RISK_TIER[name];
    },
    get spent() {
      return soa.spent[index];
    },
    set spent(v) {
      soa.spent[index] = v;
    },
    get balance() {
      return soa.balance[index];
    },
    set balance(v) {
      soa.balance[index] = v;
    },
  };
}

export function buildPopulation(seed, nAgents = N_AGENTS, avgDegree = 3, redundancyLinks = 30) {
  const rng = mulberry32(seed);
  // Deterministic role assignment: shuffle ids, first 2 OWNER, next 8 ADMIN,
  // next 70 USER, last 20 GUEST.
  const order = Array.from({ length: nAgents }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const roleOf = new Map();
  order.forEach((id, k) => {
    roleOf.set(id, k < 2 ? "OWNER" : k < 10 ? "ADMIN" : k < 80 ? "USER" : "GUEST");
  });
  // Capability draws, one agent at a time, in index order.
  const capsOf = [];
  for (let i = 0; i < nAgents; i++) {
    const nCaps = 1 + randInt(rng, 3);
    const caps = new Set();
    while (caps.size < nCaps) caps.add(randPick(rng, CAPS_POOL));
    capsOf.push([...caps].sort());
  }
  // Graph: ring edges for connectivity plus random edges to avg degree 3.
  const ids = Array.from({ length: nAgents }, (_, i) => agentIdString(i));
  const edges = new Set();
  const key = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  for (let i = 0; i < nAgents; i++) edges.add(key(ids[i], ids[(i + 1) % nAgents]));
  const targetEdges = Math.floor((nAgents * avgDegree) / 2);
  let guard = 0;
  while (edges.size < targetEdges && guard++ < 10000) {
    const a = randPick(rng, ids);
    const b = randPick(rng, ids);
    if (a !== b) edges.add(key(a, b));
  }
  const dependencies = Array.from({ length: nAgents }, () => []);
  const dependents = Array.from({ length: nAgents }, () => []);
  for (const e of edges) {
    const [a, b] = e.split("|");
    // b depends on a; a gains dependent b. (Direction fixed by id order,
    // matching POM54 city.py: the lower id is the dependency.)
    dependencies[agentIndexFromId(b)].push(agentIndexFromId(a));
    dependents[agentIndexFromId(a)].push(agentIndexFromId(b));
  }
  // Redundancy links: BACKUP capability links, not required dependencies.
  const redundantProviders = Array.from({ length: nAgents }, () => []);
  let added = 0;
  guard = 0;
  while (added < redundancyLinks && guard++ < redundancyLinks * 50 + 100) {
    const a = randPick(rng, ids);
    const b = randPick(rng, ids);
    const bi = agentIndexFromId(b);
    const ai = agentIndexFromId(a);
    if (a !== b && !dependencies[bi].includes(ai) && !redundantProviders[bi].includes(ai)) {
      redundantProviders[bi].push(ai);
      added += 1;
    }
  }
  for (let i = 0; i < nAgents; i++) {
    dependencies[i].sort((x, y) => x - y);
    dependents[i].sort((x, y) => x - y);
    redundantProviders[i].sort((x, y) => x - y);
  }
  // Fill the ECS World SoA in index order.
  const world = new World(nAgents);
  const soa = world.agents;
  for (let i = 0; i < nAgents; i++) world.createEntity();
  for (let i = 0; i < nAgents; i++) {
    soa.state[i] = AGENT_STATE.NORMAL;
    soa.riskLevel[i] = 0;
    soa.riskTier[i] = RISK_TIER.LOW;
    soa.role[i] = ROLE[roleOf.get(i)];
    soa.tenant[i] = i % TENANTS.length;
    soa.district[i] = i % DISTRICTS.length;
    soa.capMask[i] = capMaskFromNames(capsOf[i]);
    soa.balance[i] = 50000; // integer cents
    soa.spent[i] = 0;
    soa.spendCap[i] = 10000; // integer cents
    soa.expiryTick[i] = 1000000;
    soa.dependencies[i] = Int32Array.from(dependencies[i]);
    soa.dependents[i] = Int32Array.from(dependents[i]);
    soa.redundantProviders[i] = Int32Array.from(redundantProviders[i]);
  }
  const agents = [];
  for (let i = 0; i < nAgents; i++) {
    agents.push(makeAgentFacade(world, i, {
      role: roleOf.get(i),
      tenant: TENANTS[i % TENANTS.length],
      district: DISTRICTS[i % DISTRICTS.length],
      capabilities: capsOf[i],
      spendCap: 10000,
      expiryTick: 1000000,
      dependencies: dependencies[i].map((d) => agentIdString(d)),
      dependents: dependents[i].map((d) => agentIdString(d)),
      redundantProviders: redundantProviders[i].map((d) => agentIdString(d)),
    }));
  }
  return { world, agents, edgeCount: edges.size, redundancyLinksAdded: added };
}

// True if every required dependency is effectively alive: alive itself,
// or each failed one covered by a distinct live redundant provider.
// `isAlive` takes an agent id string. Dead = quarantined or
// forensic-hold agents are treated as failed dependencies.
export function depsEffectivelyAlive(world, entityIndex, isAlive) {
  const soa = world.agents;
  const deps = soa.dependencies[entityIndex];
  let failed = 0;
  for (let k = 0; k < deps.length; k++) {
    if (!isAlive(agentIdString(deps[k]))) failed += 1;
  }
  if (failed === 0) return true;
  const backups = soa.redundantProviders[entityIndex];
  let liveBackups = 0;
  for (let k = 0; k < backups.length; k++) {
    if (isAlive(agentIdString(backups[k]))) liveBackups += 1;
  }
  return liveBackups >= failed;
}

// Cascade size for a failed agent: DIRECT dependents only (POM54 rule).
export function cascadeSize(world, failedId, isAlive) {
  const idx = agentIndexFromId(failedId);
  if (!Number.isInteger(idx) || idx < 0 || idx >= world.maxEntities || !world.isAlive(idx)) {
    throw new Error("cascadeSize: unknown agent " + failedId);
  }
  const soa = world.agents;
  const dependents = soa.dependents[idx];
  const affected = [];
  for (let k = 0; k < dependents.length; k++) {
    const d = dependents[k];
    if (!depsEffectivelyAlive(world, d, isAlive)) affected.push(agentIdString(d));
  }
  affected.sort();
  return { cascadeSize: affected.length, affected };
}

// Plain snapshot of every live agent, in index order, in the reference
// agent-object shape (id, index, role, tenant, district, capabilities,
// spendCap, spent, balance, expiryTick, dependencies, dependents,
// redundantProviders, state, riskLevel, riskTier). Values are read from
// the SoA at call time, so this is the end-of-run state.
export function snapshotAgents(world) {
  const soa = world.agents;
  const out = [];
  world.forEachAlive((i) => {
    out.push({
      id: agentIdString(i),
      index: i,
      role: ROLE_NAMES[soa.role[i]],
      tenant: TENANTS[soa.tenant[i]],
      district: DISTRICTS[soa.district[i]],
      capabilities: capNamesFromMask(soa.capMask[i]),
      spendCap: soa.spendCap[i],
      spent: soa.spent[i],
      balance: soa.balance[i],
      expiryTick: soa.expiryTick[i],
      dependencies: Array.from(soa.dependencies[i], (d) => agentIdString(d)),
      dependents: Array.from(soa.dependents[i], (d) => agentIdString(d)),
      redundantProviders: Array.from(soa.redundantProviders[i], (d) => agentIdString(d)),
      state: AGENT_STATE_NAMES[soa.state[i]],
      riskLevel: soa.riskLevel[i],
      riskTier: RISK_TIER_NAMES[soa.riskTier[i]],
    });
  });
  return out;
}

// components.mjs - ECS component definitions (typed-array SoA).
// Every agent's simulation state lives in typed arrays indexed by
// entity id (0..99). Agent id strings are derived from the index:
// agent-000 .. agent-099. Sorting by id string equals sorting by
// index (zero-padded), which is what the reference sim relies on.
//
// Storage rules:
// - Sim state (state, risk, role, tenant, district, capMask, balance,
//   spent, spendCap, expiryTick, dependencies, dependents,
//   redundantProviders) is the ONLY state the simulation reads/writes.
// - Render state (pos/prev arrays) is RENDER-ONLY: the renderer owns
//   it, the sim never reads it, and it never affects receipts.
// - Capabilities never change during a run; capMask is set at build.
// - Dependencies/dependents/redundantProviders are static after build
//   and stored as Int32Array of entity indices, sorted ascending
//   (identical order to the reference's sorted id-string arrays).

export const AGENT_STATE = {
  NORMAL: 0,
  SUSPECT: 1,
  QUARANTINED: 2,
  FORENSIC_HOLD: 3,
  REMEDIATED: 4,
  REAUTHORIZED: 5,
};
export const AGENT_STATE_NAMES = [
  "NORMAL", "SUSPECT", "QUARANTINED", "FORENSIC_HOLD", "REMEDIATED", "REAUTHORIZED",
];

export const ROLE = { OWNER: 0, ADMIN: 1, USER: 2, GUEST: 3 };
export const ROLE_NAMES = ["OWNER", "ADMIN", "USER", "GUEST"];

export const RISK_TIER = { LOW: 0, GUARDED: 1, ELEVATED: 2, CRITICAL: 3 };
export const RISK_TIER_NAMES = ["LOW", "GUARDED", "ELEVATED", "CRITICAL"];

// Capability bitmask. CAP_NAMES is in sorted order, matching the
// reference sim's sorted capability arrays (randPick draws over this
// order, so the order is load-bearing for determinism).
export const CAP = { spend: 1, read: 2, route: 4, verify: 8, settle: 16 };
export const CAP_NAMES = ["spend", "read", "route", "verify", "settle"];

export const TENANTS = ["tenant-0", "tenant-1", "tenant-2", "tenant-3"];
export const DISTRICTS = ["ATG", "DOCKING", "HERMES-CITY", "AQUADUCT"];

export function agentIdString(index) {
  return `agent-${String(index).padStart(3, "0")}`;
}

export function capNamesFromMask(mask) {
  const out = [];
  for (const name of CAP_NAMES) {
    if (mask & CAP[name]) out.push(name);
  }
  return out;
}

export function capMaskFromNames(names) {
  let mask = 0;
  for (const name of names) mask |= CAP[name] || 0;
  return mask;
}

export class AgentComponents {
  constructor(maxAgents) {
    this.max = maxAgents;
    // Simulation state.
    this.state = new Uint8Array(maxAgents); // AGENT_STATE
    this.riskLevel = new Uint8Array(maxAgents); // 0..15
    this.riskTier = new Uint8Array(maxAgents); // RISK_TIER
    this.role = new Uint8Array(maxAgents); // ROLE
    this.tenant = new Uint8Array(maxAgents); // index into TENANTS
    this.district = new Uint8Array(maxAgents); // index into DISTRICTS
    this.capMask = new Uint8Array(maxAgents); // CAP bitmask
    this.balance = new Int32Array(maxAgents); // integer cents
    this.spent = new Int32Array(maxAgents); // integer cents
    this.spendCap = new Int32Array(maxAgents); // integer cents
    this.expiryTick = new Int32Array(maxAgents);
    this.dependencies = new Array(maxAgents); // Int32Array, sorted ascending
    this.dependents = new Array(maxAgents); // Int32Array, sorted ascending
    this.redundantProviders = new Array(maxAgents); // Int32Array, sorted ascending
    for (let i = 0; i < maxAgents; i++) {
      this.dependencies[i] = new Int32Array(0);
      this.dependents[i] = new Int32Array(0);
      this.redundantProviders[i] = new Int32Array(0);
    }
    // Render-only state. Owned by the renderer; never read by the sim.
    this.posX = new Float32Array(maxAgents);
    this.posY = new Float32Array(maxAgents);
    this.posZ = new Float32Array(maxAgents);
    this.prevX = new Float32Array(maxAgents);
    this.prevY = new Float32Array(maxAgents);
    this.prevZ = new Float32Array(maxAgents);
  }

  clearEntity(index) {
    this.state[index] = AGENT_STATE.NORMAL;
    this.riskLevel[index] = 0;
    this.riskTier[index] = RISK_TIER.LOW;
    this.role[index] = ROLE.GUEST;
    this.tenant[index] = 0;
    this.district[index] = 0;
    this.capMask[index] = 0;
    this.balance[index] = 0;
    this.spent[index] = 0;
    this.spendCap[index] = 0;
    this.expiryTick[index] = 0;
    this.dependencies[index] = new Int32Array(0);
    this.dependents[index] = new Int32Array(0);
    this.redundantProviders[index] = new Int32Array(0);
    this.posX[index] = 0; this.posY[index] = 0; this.posZ[index] = 0;
    this.prevX[index] = 0; this.prevY[index] = 0; this.prevZ[index] = 0;
  }
}

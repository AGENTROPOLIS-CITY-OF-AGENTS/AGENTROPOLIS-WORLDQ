// index.mjs - Public API of the simulation/agents package (P1.3).
// The ECS port of the 54T Stage B 100-agent deterministic sim. All
// modules are environment-agnostic pure JS (no node: imports), so the
// same code runs in Node tests and the browser demo.
export {
  buildPopulation,
  depsEffectivelyAlive,
  cascadeSize,
  snapshotAgents,
  agentIndexFromId,
  N_AGENTS,
  CAPS_POOL,
  TENANTS,
  DISTRICTS,
} from "./population.mjs";
export { DENY_REASONS, stateHash, decideAction } from "./authz.mjs";
export {
  STATES,
  TRANSITIONS,
  ROLE_CAPABILITIES,
  decideTransition,
  requestTransition,
  isContained,
  isSettleBlocked,
} from "./state-machine.mjs";
export { SCENARIO_IDS, lytagateVerdict, buildScenarios } from "./scenarios.mjs";
export { SimulatedPayrail } from "./payrail.mjs";
export {
  canonicalIndependent,
  sha256HexIndependent,
  receiptHashIndependent,
  verifyChainIndependent,
  verifyAllIndependent,
  tamperTest,
} from "./verify.mjs";
export {
  CONFIG_ID,
  DEFAULT_TICKS,
  DEFAULT_TASKS_PER_TICK,
  FALSE_POSITIVE_BOUND_PER_RUN,
  STAGE_B_THRESHOLDS,
  BalancesView,
  buildCapabilitiesMap,
  runSimulation,
  createSim,
} from "./engine.mjs";
export { SIM_CONFIG_ID, DEFAULT_SIM_CONFIG } from "../../../engine/src/index.mjs";

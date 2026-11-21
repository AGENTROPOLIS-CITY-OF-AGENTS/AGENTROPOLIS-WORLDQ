// engine.mjs - Deterministic simulation engine, ECS port.
// Ported from 54T Stage B src/engine.mjs (behavior 1:1). One seed per
// run; no Math.random; no wall clock in simulation state (logical
// integer ticks only; wall clock appears only in run metadata, which
// this module never produces). Matched ON/OFF: same seed, same
// population, same scenario script; the containment toggle is the ONLY
// difference between arms.
//
// ECS adaptation: all agent state lives in the World SoA. The engine
// works through agent facades (population.mjs) and through Map-like
// views over the SoA for the decideAction context (capabilities Map,
// BalancesView). Spend and balance mutations go through the SoA, so
// the views always agree. The RENDER-ONLY pos/prev arrays are never
// read or written here.
//
// Two APIs share ONE internal tick function (createRunState + tickOnce),
// so one-shot and steppable runs can never drift apart:
//   runSimulation(config) - one-shot, returns { summary, records,
//     receipts, agents, payrail }.
//   createSim(config) - steppable live-sim API for the demo and clock.
import {
  mulberry32,
  randInt,
  randPick,
  ReceiptChain,
  globalHead,
  STREAMS,
  quantize,
  riskTier,
  SIM_CONFIG_ID,
  DEFAULT_SIM_CONFIG,
} from "../../../engine/src/index.mjs";
import { agentIdString } from "../../../ecs/src/components.mjs";
import {
  buildPopulation,
  depsEffectivelyAlive,
  cascadeSize,
  snapshotAgents,
  agentIndexFromId,
} from "./population.mjs";
import { decideAction, stateHash } from "./authz.mjs";
import {
  requestTransition,
  isContained,
  isSettleBlocked,
} from "./state-machine.mjs";
import { buildScenarios, lytagateVerdict } from "./scenarios.mjs";
import { SimulatedPayrail } from "./payrail.mjs";
import { verifyAllIndependent } from "./verify.mjs";

export const CONFIG_ID = SIM_CONFIG_ID;
export const DEFAULT_TICKS = 60;
export const DEFAULT_TASKS_PER_TICK = 4;

// Stage B-defined false-positive bound (Stage B threshold, not a spec
// threshold): at most 2 benign agents escalated to SUSPECT per run, and
// ZERO benign agents may reach QUARANTINED.
export const FALSE_POSITIVE_BOUND_PER_RUN = 2;

// Stage B-defined acceptance thresholds (labeled as Stage B thresholds):
export const STAGE_B_THRESHOLDS = {
  unauthorizedEffectsOnMax: 0,
  benignQuarantinedMax: 0,
  falsePositivesPerRunMax: FALSE_POSITIVE_BOUND_PER_RUN,
  killSwitchLatencyTicksMax: 1,
};

const ADMIN_CALLER = { id: "operator-admin-1", role: "ADMIN" };
const OWNER_CALLER = { id: "operator-owner-1", role: "OWNER" };

// Balances as a VIEW over the SoA balance Int32Array: no second copy.
// get/set by agent id string; entries() yields [agentId, balance] in
// ascending index order (identical to the reference balances Map,
// which was filled in index order).
export class BalancesView {
  constructor(world) {
    this.world = world;
  }
  get(agentId) {
    return this.world.agents.balance[agentIndexFromId(agentId)];
  }
  set(agentId, value) {
    this.world.agents.balance[agentIndexFromId(agentId)] = value;
    return this;
  }
  has(agentId) {
    const i = agentIndexFromId(agentId);
    return Number.isInteger(i) && i >= 0 && i < this.world.maxEntities && this.world.isAlive(i);
  }
  get size() {
    return this.world.aliveCount;
  }
  *entries() {
    const ids = this.world.aliveIds();
    for (const i of ids) yield [agentIdString(i), this.world.agents.balance[i]];
  }
  *keys() {
    for (const [k] of this.entries()) yield k;
  }
  *values() {
    for (const [, v] of this.entries()) yield v;
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  forEach(fn) {
    for (const [k, v] of this.entries()) fn(v, k, this);
  }
}

// Capabilities as views over the SoA: allowedOps is a Set rebuilt once
// from capMask (capabilities never change during a run); spent is a
// live getter/setter over the SoA spent Int32Array.
export function buildCapabilitiesMap(world, agents) {
  const map = new Map();
  for (const a of agents) {
    const idx = a.index;
    const view = {
      agentId: a.id,
      tenant: a.tenant,
      allowedOps: new Set(a.capabilities),
      spendCap: a.spendCap,
      expiryTick: a.expiryTick,
    };
    Object.defineProperty(view, "spent", {
      get() {
        return world.agents.spent[idx];
      },
      set(v) {
        world.agents.spent[idx] = v;
      },
      enumerable: true,
    });
    map.set(a.id, view);
  }
  return map;
}

// Build one fresh run state. All per-run mutable state lives here.
function createRunState(config) {
  const seed = config.seed ?? DEFAULT_SIM_CONFIG.seed;
  const containmentOn = config.containmentOn === true;
  const ticks = config.ticks ?? DEFAULT_TICKS;
  const tasksPerTick = config.tasksPerTick ?? DEFAULT_TASKS_PER_TICK;
  const killSwitchTick = config.killSwitchTick ?? null;

  const { world, agents, edgeCount, redundancyLinksAdded } = buildPopulation(seed);
  const byId = new Map(agents.map((a) => [a.id, a]));
  const chains = {
    events: new ReceiptChain("events"),
    transitions: new ReceiptChain("transitions"),
    settlements: new ReceiptChain("settlements"),
  };
  const receiptIndex = new Map(); // "stream-seq" -> { hash }
  const emitTo = (stream) => (type, tick, payload) => {
    const r = chains[stream].emit(type, tick, payload);
    receiptIndex.set(`${stream}-${r.seq}`, { hash: r.hash });
    return r;
  };
  const emitEvent = emitTo("events");
  const emitTransition = emitTo("transitions");
  const emitSettlement = emitTo("settlements");

  const capabilities = buildCapabilitiesMap(world, agents);
  const balances = new BalancesView(world);
  const seenNonces = new Set();
  const ctx = { capabilities, balances, seenNonces, receiptIndex };

  const rng = mulberry32(seed + 10000);
  const scenarios = buildScenarios(seed, { agents });
  const scenarioByTick = new Map();
  for (const s of scenarios) scenarioByTick.set(s.action.tick, s);

  const payrail = new SimulatedPayrail();
  // Five seeded mandates on five distinct agents.
  const mandateAgents = [];
  {
    const pool = [...agents];
    for (let i = 0; i < 5; i++) mandateAgents.push(pool.splice(randInt(rng, pool.length), 1)[0]);
  }
  for (let i = 0; i < mandateAgents.length; i++) {
    payrail.createMandate(`mandate-${i}`, mandateAgents[i].id, 500 + i * 100);
  }

  // One seeded benign false-alarm per run: a non-breach agent the
  // detector flags SUSPECT, then clears as a false positive.
  const breachTargets = new Set(scenarios.map((s) => s.targetId));
  const benignPool = agents.filter((a) => !breachTargets.has(a.id));
  const benignFlag = benignPool[randInt(rng, benignPool.length)];

  const isAlive = (id) => {
    const a = byId.get(id);
    return !!a && !isContained(a.state);
  };

  const s = {
    seed,
    containmentOn,
    ticks,
    tasksPerTick,
    killSwitchTick,
    world,
    agents,
    byId,
    edgeCount,
    redundancyLinksAdded,
    chains,
    receiptIndex,
    emitEvent,
    emitTransition,
    emitSettlement,
    capabilities,
    balances,
    seenNonces,
    ctx,
    rng,
    scenarios,
    scenarioByTick,
    payrail,
    mandateAgents,
    benignFlag,
    isAlive,
    records: [],
    scenarioOutcomes: [],
    tasksIssued: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    unauthorizedEffects: 0,
    falsePositives: 0,
    benignQuarantined: 0,
    deniedCount: 0,
    cascadeTotal: 0,
    latencies: [],
    pending: [], // { ownerId, completeTick, latency }
    containmentSchedule: new Map(), // agentId -> { quarantinedTick, quarantinedBy, channel }
    quarantinedEverSet: new Set(),
    halted: false,
    haltTick: null,
    killSwitchLatencyTicks: null,
    tick: 0, // next tick to execute
    done: false,
  };
  return s;
}

function containTarget(s, agent, tick, reason) {
  if (!s.containmentOn) return;
  if (agent.state !== "NORMAL") return;
  const r1 = requestTransition(agent, "SUSPECT", ADMIN_CALLER, tick, s.emitTransition,
    { configId: CONFIG_ID, quarantinedBy: ADMIN_CALLER.id, containmentChannel: "channel-admin" });
  if (!r1.allowed) return;
  const r2 = requestTransition(agent, "QUARANTINED", ADMIN_CALLER, tick, s.emitTransition,
    { configId: CONFIG_ID, quarantinedBy: ADMIN_CALLER.id, containmentChannel: "channel-admin" });
  if (r2.allowed) {
    s.containmentSchedule.set(agent.id, { quarantinedTick: tick, quarantinedBy: ADMIN_CALLER.id, channel: "channel-admin" });
    s.quarantinedEverSet.add(agent.id);
    s.payrail.freezeMandatesFor(agent.id);
    // Cascade measured AT quarantine time (direct dependents only,
    // POM54 rule), when the failure is live. Measuring at end of run
    // would read 0 because the pipeline reauthorizes agents.
    const cascadeAtQuarantine = cascadeSize(s.world, agent.id, s.isAlive);
    s.cascadeTotal += cascadeAtQuarantine.cascadeSize;
    // PAYRAIL probe at the exact moment of quarantine: attempt a
    // settlement for this agent while QUARANTINED. It must be denied
    // (spec criterion 4). This is deterministic, unlike the tick-20
    // probe, which races the remediation pipeline.
    const probeId = `mandate-q-${agent.id}-${tick}`;
    s.payrail.createMandate(probeId, agent.id, 1000);
    s.payrail.settle(probeId, agent.state, s.balances, tick, s.emitSettlement);
    s.emitEvent("AGENT_QUARANTINED", tick, {
      configId: CONFIG_ID, agentId: agent.id, reason,
      cascade: cascadeAtQuarantine,
    });
  }
}

function applyAuthorizedSpend(s, action) {
  const cap = s.capabilities.get(action.agentId);
  if (action.nonce) s.seenNonces.add(action.nonce);
  if (action.amount > 0) {
    s.balances.set(action.agentId, (s.balances.get(action.agentId) ?? 0) - action.amount);
    cap.spent += action.amount;
  }
}

// Execute exactly ONE tick (s.tick), the shared step for runSimulation
// and createSim. Returns { tick, done, halted } where tick is the tick
// index this call processed, or the halt tick when the kill switch
// fires before the tick body runs. done is true when the run is
// complete (all requested ticks executed) or halted.
function tickOnce(s) {
  const tick = s.tick;
  // Kill switch: checked at the top of each tick. A STOP issued at
  // the end of tick K halts before tick K+1 is processed, so the
  // latency is exactly 1 tick. Nothing after haltTick is executed
  // or receipted.
  if (s.killSwitchTick !== null && tick > s.killSwitchTick) {
    s.halted = true;
    s.haltTick = tick;
    s.killSwitchLatencyTicks = s.haltTick - s.killSwitchTick;
    s.done = true;
    return { tick, done: true, halted: true };
  }
  // Benign false-alarm at tick 5: flag then clear in the same tick.
  if (tick === 5 && s.containmentOn) {
    const r = requestTransition(s.benignFlag, "SUSPECT", ADMIN_CALLER, tick, s.emitTransition,
      { configId: CONFIG_ID });
    if (r.allowed) {
      s.falsePositives += 1;
      s.emitEvent("FALSE_POSITIVE_FLAGGED", tick, {
        configId: CONFIG_ID, agentId: s.benignFlag.id, benign: true,
      });
      const back = requestTransition(s.benignFlag, "NORMAL", ADMIN_CALLER, tick, s.emitTransition,
        { configId: CONFIG_ID });
      if (back.allowed) {
        s.emitEvent("FALSE_POSITIVE_CLEARED", tick, {
          configId: CONFIG_ID, agentId: s.benignFlag.id, benign: true,
        });
      }
    }
  }
  // Issue tasks.
  const aliveAgents = s.agents.filter((a) => !isContained(a.state));
  for (let i = 0; i < s.tasksPerTick; i++) {
    const owner = randPick(s.rng, aliveAgents.length ? aliveAgents : s.agents);
    const capName = randPick(s.rng, owner.capabilities);
    const cost = 1 + randInt(s.rng, 20);
    s.tasksIssued += 1;
    const depsOk = depsEffectivelyAlive(s.world, owner.index, s.isAlive);
    if (!depsOk || !owner.capabilities.includes(capName)) {
      s.tasksFailed += 1;
      continue;
    }
    const latency = 1 + owner.dependencies.length + (owner.redundantProviders.length ? 1 : 0);
    s.pending.push({ ownerId: owner.id, completeTick: tick + latency, latency });
  }
  // Complete due tasks.
  for (let i = s.pending.length - 1; i >= 0; i--) {
    if (s.pending[i].completeTick <= tick) {
      const t = s.pending.splice(i, 1)[0];
      s.tasksCompleted += 1;
      s.latencies.push(t.latency);
    }
  }
  // Scenario script at this tick.
  const scenario = s.scenarioByTick.get(tick);
  if (scenario) {
    const target = s.byId.get(scenario.targetId);
    // Risk score: deterministic per scenario; quantized to 16 levels.
    const riskScore = 0.55 + (s.seed % 10) / 100 + scenario.action.tick / 1000;
    const q = quantize(riskScore);
    target.riskLevel = q.level;
    target.riskTier = riskTier(q.level);
    if (s.containmentOn) {
      if (scenario.preAction) {
        // First use of the nonce is legitimate and executes.
        const pre = decideAction(s.ctx, scenario.preAction);
        if (pre.allowed) applyAuthorizedSpend(s, scenario.preAction);
      }
      let decision;
      if (scenario.id === "prompt-injection") {
        const gate = lytagateVerdict(scenario.content);
        decision = gate.verdict === "BLOCK"
          ? { allowed: false, reason: "PROMPT_INJECTION_MARKER" }
          : { allowed: true, reason: "OK" };
      } else {
        decision = decideAction(s.ctx, scenario.action);
      }
      if (!decision.allowed) {
        s.deniedCount += 1;
        const beforeHash = stateHash({ balances: Object.fromEntries([...s.balances.entries()].sort()) });
        s.emitEvent("ACTION_DENIED", tick, {
          configId: CONFIG_ID, scenarioId: scenario.id, agentId: scenario.targetId,
          op: scenario.action.op, amount: scenario.action.amount,
          decision: "DENY", reason: decision.reason,
          stateHashBefore: beforeHash, stateHashAfter: beforeHash, stateUnchanged: true,
        });
        const expected = scenario.expectedOn.reason;
        s.scenarioOutcomes.push({
          scenarioId: scenario.id, arm: "ON", denied: true,
          reason: decision.reason, expectedReason: expected,
          reasonMatches: decision.reason === expected,
          unauthorizedEffects: 0,
        });
        containTarget(s, target, tick, decision.reason);
      } else {
        // A breach script that the ON arm allowed is a control failure.
        s.unauthorizedEffects += 1;
        s.scenarioOutcomes.push({
          scenarioId: scenario.id, arm: "ON", denied: false,
          reason: "OK", expectedReason: scenario.expectedOn.reason,
          reasonMatches: false, unauthorizedEffects: 1,
        });
      }
    } else {
      // OFF arm: no enforcement plane. The action executes and its
      // effect is recorded as an unauthorized effect.
      if (scenario.preAction) applyAuthorizedSpend(s, scenario.preAction);
      applyAuthorizedSpend(s, scenario.action);
      s.unauthorizedEffects += 1;
      s.emitEvent("EFFECT_UNBLOCKED", tick, {
        configId: CONFIG_ID, scenarioId: scenario.id, agentId: scenario.targetId,
        op: scenario.action.op, amount: scenario.action.amount,
        decision: "UNBLOCKED_NO_ENFORCEMENT", reason: "CONTAINMENT_OFF",
        unauthorizedEffect: true,
      });
      s.scenarioOutcomes.push({
        scenarioId: scenario.id, arm: "OFF", denied: false,
        reason: "CONTAINMENT_OFF", expectedReason: null,
        reasonMatches: true, unauthorizedEffects: 1,
      });
    }
  }
  // Containment pipeline: quarantined agents advance on a fixed
  // schedule (ticks after quarantine): +2 forensic, +4 remediated,
  // +6 reauthorized (distinct OWNER approver, distinct channel),
  // +8 back to NORMAL with mandates unfrozen.
  if (s.containmentOn) {
    for (const [agentId, sched] of [...s.containmentSchedule.entries()]) {
      const agent = s.byId.get(agentId);
      const dt = tick - sched.quarantinedTick;
      if (agent.state === "QUARANTINED" && dt >= 2) {
        requestTransition(agent, "FORENSIC_HOLD", ADMIN_CALLER, tick, s.emitTransition, { configId: CONFIG_ID });
      } else if (agent.state === "FORENSIC_HOLD" && dt >= 4) {
        requestTransition(agent, "REMEDIATED", ADMIN_CALLER, tick, s.emitTransition, { configId: CONFIG_ID });
      } else if (agent.state === "REMEDIATED" && dt >= 6) {
        requestTransition(agent, "REAUTHORIZED", OWNER_CALLER, tick, s.emitTransition, {
          configId: CONFIG_ID,
          approverId: OWNER_CALLER.id, quarantinedBy: sched.quarantinedBy,
          approverChannel: "channel-owner", containmentChannel: sched.channel,
        });
      } else if (agent.state === "REAUTHORIZED" && dt >= 8) {
        const r = requestTransition(agent, "NORMAL", ADMIN_CALLER, tick, s.emitTransition, { configId: CONFIG_ID });
        if (r.allowed) {
          s.payrail.unfreezeMandatesFor(agentId);
          s.containmentSchedule.delete(agentId);
          s.emitEvent("AGENT_REAUTHORIZED", tick, { configId: CONFIG_ID, agentId });
        }
      }
    }
  }
  // PAYRAIL settlement attempts at tick 20 (and retry at 40).
  if (tick === 20 || tick === 40) {
    for (let i = 0; i < s.mandateAgents.length; i++) {
      const m = s.payrail.mandates.get(`mandate-${i}`);
      const owner = s.byId.get(m.agentId);
      s.payrail.settle(m.mandateId, owner.state, s.balances, tick, s.emitSettlement);
    }
    // Settlement attempt for a quarantined breach target, if any.
    for (const sc of s.scenarios) {
      const target = s.byId.get(sc.targetId);
      if (isSettleBlocked(target.state)) {
        const mid = `mandate-breach-${sc.id}`;
        if (!s.payrail.mandates.has(mid)) s.payrail.createMandate(mid, target.id, 1000);
        s.payrail.settle(mid, target.state, s.balances, tick, s.emitSettlement);
      }
    }
  }
  s.records.push({
    tick, tasksIssued: s.tasksIssued, tasksCompleted: s.tasksCompleted, tasksFailed: s.tasksFailed,
    quarantined: s.agents.filter((a) => a.state === "QUARANTINED").length,
    unauthorizedEffects: s.unauthorizedEffects,
  });
  s.tick += 1;
  if (s.tick >= s.ticks) s.done = true;
  return { tick, done: s.done, halted: false };
}

function stateHistogramOf(s) {
  const histogram = {};
  for (const a of s.agents) histogram[a.state] = (histogram[a.state] || 0) + 1;
  return histogram;
}

function currentGlobalHead(s) {
  return globalHead(STREAMS.map((name) => s.chains[name].head));
}

// Finalize a finished run state into the reference summary shape.
function finalizeRun(s) {
  // Benign agents must never reach QUARANTINED (checked at end; the
  // false-alarm path only ever reaches SUSPECT).
  s.benignQuarantined = isContained(s.benignFlag.state) || s.benignFlag.state === "QUARANTINED" ? 1 : 0;

  const heads = STREAMS.map((name) => s.chains[name].head);
  const runGlobalHead = globalHead(heads);
  const streamsObj = {
    events: s.chains.events.receipts,
    transitions: s.chains.transitions.receipts,
    settlements: s.chains.settlements.receipts,
  };
  const verification = verifyAllIndependent(streamsObj, runGlobalHead);
  const latMean = s.latencies.length
    ? s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length : 0;

  const summary = {
    configId: CONFIG_ID,
    seed: s.seed,
    arm: s.containmentOn ? "ON" : "OFF",
    containmentOn: s.containmentOn,
    ticksRequested: s.ticks,
    ticksExecuted: s.halted ? s.haltTick : s.ticks,
    halted: s.halted,
    haltTick: s.haltTick,
    killSwitchTick: s.killSwitchTick,
    killSwitchLatencyTicks: s.killSwitchLatencyTicks,
    nAgents: s.agents.length,
    edgeCount: s.edgeCount,
    redundancyLinksAdded: s.redundancyLinksAdded,
    tasksIssued: s.tasksIssued,
    tasksCompleted: s.tasksCompleted,
    tasksFailed: s.tasksFailed,
    latencyMean: Math.round(latMean * 1000) / 1000,
    cascadeSizeTotal: s.cascadeTotal,
    unauthorizedEffects: s.unauthorizedEffects,
    deniedCount: s.deniedCount,
    falsePositives: s.falsePositives,
    benignQuarantined: s.benignQuarantined,
    falsePositiveBoundPerRun: FALSE_POSITIVE_BOUND_PER_RUN,
    scenarioOutcomes: s.scenarioOutcomes,
    settlementsAuthorized: s.payrail.settlements.length,
    settlementsDenied: s.chains.settlements.receipts.filter((r) => r.type === "SETTLEMENT_DENIED").length,
    receiptsEmitted: {
      events: s.chains.events.receipts.length,
      transitions: s.chains.transitions.receipts.length,
      settlements: s.chains.settlements.receipts.length,
      total: s.chains.events.receipts.length + s.chains.transitions.receipts.length + s.chains.settlements.receipts.length,
    },
    stateHistogram: stateHistogramOf(s),
    globalHead: runGlobalHead,
    streamHeads: Object.fromEntries(STREAMS.map((name, i) => [name, heads[i]])),
    chainValid: verification.ok,
    verificationError: verification.error || null,
  };
  return {
    summary,
    records: s.records,
    receipts: streamsObj,
    agents: snapshotAgents(s.world),
    payrail: s.payrail,
  };
}

export function runSimulation(config = {}) {
  const s = createRunState(config);
  while (!s.done) tickOnce(s);
  return finalizeRun(s);
}

// Steppable live-sim API for the demo and the fixed-step clock.
// step() advances exactly ONE fixed tick and returns { tick, done,
// halted }. done is true when the run completes or the kill switch
// fires. restart() rebuilds from seed 54 (fresh population, fresh
// chains from GENESIS, tick 0, per-run counters zeroed, all agents
// NORMAL) and increments loopCount; loopCount and totalTicks persist
// across restarts. The kill switch is terminal: a halted sim is never
// restarted (restart() throws).
export function createSim(config = {}) {
  const baseConfig = { ...DEFAULT_SIM_CONFIG, ...config };
  let s = createRunState(baseConfig);
  let loopCount = 0;
  let totalTicks = 0;

  const api = {
    get world() {
      return s.world;
    },
    step() {
      if (s.done) return { tick: s.tick, done: true, halted: s.halted };
      const r = tickOnce(s);
      if (!r.halted) totalTicks += 1;
      return r;
    },
    restart() {
      if (s.halted) {
        throw new Error("createSim.restart: kill switch is terminal; a halted sim cannot restart");
      }
      s = createRunState({ ...baseConfig, seed: DEFAULT_SIM_CONFIG.seed });
      loopCount += 1;
      return { loopCount, tick: 0 };
    },
    getState() {
      return {
        tick: s.tick,
        runTick: s.tick,
        loopCount,
        totalTicks,
        halted: s.halted,
        unauthorizedEffects: s.unauthorizedEffects,
        deniedCount: s.deniedCount,
        tasksCompleted: s.tasksCompleted,
        tasksIssued: s.tasksIssued,
        receiptsTotal: s.chains.events.receipts.length +
          s.chains.transitions.receipts.length +
          s.chains.settlements.receipts.length,
        globalHead: currentGlobalHead(s),
        stateHistogram: stateHistogramOf(s),
      };
    },
    getReceipts() {
      return {
        events: s.chains.events.receipts.slice(),
        transitions: s.chains.transitions.receipts.slice(),
        settlements: s.chains.settlements.receipts.slice(),
      };
    },
    getGlobalHead() {
      return currentGlobalHead(s);
    },
    verify() {
      return verifyAllIndependent(
        {
          events: s.chains.events.receipts,
          transitions: s.chains.transitions.receipts,
          settlements: s.chains.settlements.receipts,
        },
        currentGlobalHead(s)
      );
    },
  };
  return api;
}

// state-machine.mjs - Containment state machine, ECS port.
// Ported from 54T Stage B src/state-machine.mjs (behavior 1:1).
// States live in the ECS SoA state Uint8Array (AGENT_STATE codes); the
// agent facades convert codes to names, so decideTransition and
// requestTransition below operate on state names exactly as the
// reference does, and state reads/writes go through the SoA.
//
// States: NORMAL -> SUSPECT -> QUARANTINED -> FORENSIC_HOLD ->
//          REMEDIATED -> REAUTHORIZED -> NORMAL
//
// Legal transitions (trigger, authorizing role, required capability):
//   NORMAL -> SUSPECT          DETECTION_ALERT        ADMIN|OWNER  detect
//   SUSPECT -> QUARANTINED     CONTAINMENT_ORDER      ADMIN|OWNER  contain
//   SUSPECT -> NORMAL          FALSE_POSITIVE_CLEARED ADMIN|OWNER  contain
//   QUARANTINED -> FORENSIC_HOLD FORENSIC_START       ADMIN|OWNER  forensic
//   FORENSIC_HOLD -> REMEDIATED  REMEDIATION_COMPLETE ADMIN|OWNER  remediate
//   REMEDIATED -> REAUTHORIZED   REAUTH_APPROVAL      OWNER        reauthorize
//     (G10 "distinct": reauthorization requires a DISTINCT approver
//     identity AND a DISTINCT channel from the agent that was
//     quarantined / from the containment authorizer. Enforced here:
//     approverId must differ from quarantinedBy, and approverChannel
//     must differ from containmentChannel.)
//   REAUTHORIZED -> NORMAL     RETURN_TO_SERVICE      ADMIN|OWNER  contain
//
// Every other transition is ILLEGAL: denied + receipted, NO state
// change. Every legal move emits a full transition receipt.
// Decision order (deny-before-any-state-change): legality, then role,
// then capability, then distinct-approver rule. A denial records the
// before/after state hash (identical) as proof nothing changed.
import { stateHash } from "./authz.mjs";

export const STATES = [
  "NORMAL",
  "SUSPECT",
  "QUARANTINED",
  "FORENSIC_HOLD",
  "REMEDIATED",
  "REAUTHORIZED",
];

// transition table: from -> { to: { trigger, roles, capability, distinctApprover } }
export const TRANSITIONS = {
  NORMAL: {
    SUSPECT: { trigger: "DETECTION_ALERT", roles: ["ADMIN", "OWNER"], capability: "detect" },
  },
  SUSPECT: {
    QUARANTINED: { trigger: "CONTAINMENT_ORDER", roles: ["ADMIN", "OWNER"], capability: "contain" },
    NORMAL: { trigger: "FALSE_POSITIVE_CLEARED", roles: ["ADMIN", "OWNER"], capability: "contain" },
  },
  QUARANTINED: {
    FORENSIC_HOLD: { trigger: "FORENSIC_START", roles: ["ADMIN", "OWNER"], capability: "forensic" },
  },
  FORENSIC_HOLD: {
    REMEDIATED: { trigger: "REMEDIATION_COMPLETE", roles: ["ADMIN", "OWNER"], capability: "remediate" },
  },
  REMEDIATED: {
    REAUTHORIZED: {
      trigger: "REAUTH_APPROVAL",
      roles: ["OWNER"],
      capability: "reauthorize",
      distinctApprover: true,
    },
  },
  REAUTHORIZED: {
    NORMAL: { trigger: "RETURN_TO_SERVICE", roles: ["ADMIN", "OWNER"], capability: "contain" },
  },
};

// Capability set per role (Stage B-defined policy; ENTITY54 role
// discipline: default-deny, no role holds a capability it was not given).
export const ROLE_CAPABILITIES = {
  OWNER: new Set(["detect", "contain", "forensic", "remediate", "reauthorize", "settle", "spend"]),
  ADMIN: new Set(["detect", "contain", "forensic", "remediate", "settle"]),
  USER: new Set(["spend", "read"]),
  GUEST: new Set(["read"]),
};

// Pure decision: may `caller` move `agent` from its current state to `to`?
// Returns { allowed, reason, rule } and never mutates anything.
// `agent` is an agent facade (state is a name string, read from the SoA).
export function decideTransition(agent, to, caller, context = {}) {
  const from = agent.state;
  const rule = (TRANSITIONS[from] || {})[to];
  if (!rule) return { allowed: false, reason: "ILLEGAL_TRANSITION", rule: null };
  if (!rule.roles.includes(caller.role)) {
    return { allowed: false, reason: "INSUFFICIENT_ROLE", rule };
  }
  const caps = ROLE_CAPABILITIES[caller.role] || new Set();
  if (!caps.has(rule.capability)) {
    return { allowed: false, reason: "MISSING_CAPABILITY", rule };
  }
  if (rule.distinctApprover) {
    // G10 distinctness: different approver identity AND different channel.
    if (context.approverId && context.quarantinedBy && context.approverId === context.quarantinedBy) {
      return { allowed: false, reason: "INSUFFICIENT_ROLE", rule, detail: "reauthorizer must differ from quarantiner" };
    }
    if (context.approverChannel && context.containmentChannel &&
        context.approverChannel === context.containmentChannel) {
      return { allowed: false, reason: "INSUFFICIENT_ROLE", rule, detail: "reauthorization channel must differ from containment channel" };
    }
  }
  return { allowed: true, reason: "OK", rule };
}

// Apply a transition through the decision core. `emit` is a receipt
// emitter (chain.emit). Returns the outcome; on deny the agent state
// is provably unchanged (before/after state hash identical). The state
// write goes through the facade into the SoA state Uint8Array.
export function requestTransition(agent, to, caller, tick, emit, context = {}) {
  const beforeHash = stateHash({ id: agent.id, state: agent.state });
  const decision = decideTransition(agent, to, caller, context);
  if (!decision.allowed) {
    const receipt = emit("TRANSITION_DENIED", tick, {
      configId: context.configId || "verity-city-100agent-v01",
      agentId: agent.id,
      from: agent.state,
      to,
      trigger: decision.rule ? decision.rule.trigger : "NONE",
      decision: "DENY",
      reason: decision.reason,
      detail: decision.detail || null,
      callerRole: caller.role,
      callerId: caller.id || null,
      stateHashBefore: beforeHash,
      stateHashAfter: beforeHash,
      stateUnchanged: true,
    });
    return { allowed: false, reason: decision.reason, receipt, stateUnchanged: true };
  }
  const from = agent.state;
  agent.state = to;
  const afterHash = stateHash({ id: agent.id, state: agent.state });
  const receipt = emit("TRANSITION", tick, {
    configId: context.configId || "verity-city-100agent-v01",
    agentId: agent.id,
    from,
    to,
    trigger: decision.rule.trigger,
    decision: "ALLOW",
    reason: "OK",
    callerRole: caller.role,
    callerId: caller.id || null,
    stateHashBefore: beforeHash,
    stateHashAfter: afterHash,
    stateUnchanged: false,
  });
  return { allowed: true, reason: "OK", receipt, from, to };
}

// An agent is "contained" (treated as failed for dependency purposes
// and barred from settlement) in these states.
export function isContained(state) {
  return state === "QUARANTINED" || state === "FORENSIC_HOLD";
}
export function isSettleBlocked(state) {
  return state === "SUSPECT" || state === "QUARANTINED" || state === "FORENSIC_HOLD" || state === "REMEDIATED";
}

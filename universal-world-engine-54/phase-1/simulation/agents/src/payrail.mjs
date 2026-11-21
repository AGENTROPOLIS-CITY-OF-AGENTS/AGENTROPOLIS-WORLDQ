// payrail.mjs - SIMULATED PAYRAIL settlement/mandate module, ECS port.
// Ported from 54T Stage B src/payrail.mjs (behavior 1:1). Simulated
// only. No real PAYRAIL interface exists in any located source
// (Stage A A11, NOT VERIFIED); this module models the mandate freeze /
// hold semantics the spec requires, in-process, with integer cents only.
//
// Acceptance criterion (spec criterion 4): NO quarantined mandate
// produces an authorized financial settlement. Enforcement: settle()
// denies when the mandate's agent is in SUSPECT, QUARANTINED,
// FORENSIC_HOLD, or REMEDIATED (isSettleBlocked). A denied settlement
// changes no balance and emits a DENIED receipt with identical
// before/after state hashes. Mandates are frozen (not deleted) when
// their agent is quarantined, and can only settle again after the
// agent returns to NORMAL via the full remediation chain.
//
// `balances` is the SoA-backed BalancesView from engine.mjs: settle()
// reads and writes balances only through that view, so the SoA balance
// Int32Array is the single source of truth.
import { stateHash } from "./authz.mjs";
import { isSettleBlocked } from "./state-machine.mjs";

export class SimulatedPayrail {
  constructor() {
    this.mandates = new Map(); // mandateId -> { mandateId, agentId, amount, state }
    this.settlements = []; // authorized settlements only
    this.seq = 0;
  }

  createMandate(mandateId, agentId, amountCents) {
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      throw new Error("payrail: amount must be a non-negative integer (cents)");
    }
    const m = { mandateId, agentId, amount: amountCents, state: "ACTIVE" };
    this.mandates.set(mandateId, m);
    return m;
  }

  freezeMandatesFor(agentId) {
    let frozen = 0;
    for (const m of this.mandates.values()) {
      if (m.agentId === agentId && m.state === "ACTIVE") {
        m.state = "FROZEN";
        frozen += 1;
      }
    }
    return frozen;
  }

  unfreezeMandatesFor(agentId) {
    let n = 0;
    for (const m of this.mandates.values()) {
      if (m.agentId === agentId && m.state === "FROZEN") {
        m.state = "ACTIVE";
        n += 1;
      }
    }
    return n;
  }

  // Attempt a settlement. `agentState` is the mandate owner's current
  // containment state (name string). Returns { authorized, reason, ... }.
  // Denial never changes a balance.
  settle(mandateId, agentState, balances, tick, emit) {
    const beforeHash = stateHash({ balances: Object.fromEntries([...balances.entries()].sort()) });
    const m = this.mandates.get(mandateId);
    if (!m) {
      return { authorized: false, reason: "UNKNOWN_MANDATE", stateUnchanged: true };
    }
    if (m.state === "FROZEN" || isSettleBlocked(agentState)) {
      const reason = m.state === "FROZEN" ? "QUARANTINED_MANDATE" : "QUARANTINED_MANDATE";
      if (emit) {
        emit("SETTLEMENT_DENIED", tick, {
          mandateId, agentId: m.agentId, amount: m.amount,
          agentState, decision: "DENY", reason,
          stateHashBefore: beforeHash, stateHashAfter: beforeHash, stateUnchanged: true,
        });
      }
      return { authorized: false, reason, stateUnchanged: true };
    }
    const balance = balances.get(m.agentId) ?? 0;
    if (balance < m.amount) {
      return { authorized: false, reason: "INSUFFICIENT_BALANCE", stateUnchanged: true };
    }
    balances.set(m.agentId, balance - m.amount);
    this.seq += 1;
    const settlement = { settlementId: `stl-${this.seq}`, mandateId, agentId: m.agentId, amount: m.amount, tick };
    this.settlements.push(settlement);
    const afterHash = stateHash({ balances: Object.fromEntries([...balances.entries()].sort()) });
    if (emit) {
      emit("SETTLEMENT", tick, {
        ...settlement, decision: "ALLOW", reason: "OK",
        stateHashBefore: beforeHash, stateHashAfter: afterHash, stateUnchanged: false,
      });
    }
    return { authorized: true, reason: "OK", settlement };
  }
}

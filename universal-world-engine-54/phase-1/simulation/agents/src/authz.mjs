// authz.mjs - Authorization decision core, ECS port.
// Ported from 54T Stage B src/authz.mjs (behavior 1:1). The one change
// is hashing: stateHash uses the shared engine pure-JS SHA-256 plus
// canonical JSON (engine/src/index.mjs) instead of node:crypto, so the
// same code runs in Node and the browser demo. Hash outputs are
// identical: same canonical bytes, same SHA-256.
//
// Named deny reasons (POM54 set, extended for containment):
// UNKNOWN_AGENT, OP_NOT_ALLOWED, EXPIRED_MANDATE, OVER_CAP,
// CROSS_TENANT, REPLAY, FORGED_RECEIPT, PRIVILEGE_ESCALATION,
// INSUFFICIENT_BALANCE, INVALID_AMOUNT, CONCURRENT_CONFLICT,
// ILLEGAL_TRANSITION, INSUFFICIENT_ROLE, MISSING_CAPABILITY,
// SPOOFED_PRINCIPAL, QUARANTINED_MANDATE, CONTAINMENT_OFF_BYPASS
// (informational: used only in OFF-arm records, never a deny).
import { canonical, sha256Hex } from "../../../engine/src/index.mjs";

export const DENY_REASONS = {
  OK: "authorized within capability",
  UNKNOWN_AGENT: "no capability record for agent",
  OP_NOT_ALLOWED: "operation not in agent capability set",
  EXPIRED_MANDATE: "capability expired at this tick",
  OVER_CAP: "spend would exceed spend cap",
  CROSS_TENANT: "target tenant does not match agent tenant",
  REPLAY: "request nonce already seen",
  FORGED_RECEIPT: "receipt hash chain does not verify",
  PRIVILEGE_ESCALATION: "agent claims a capability it does not hold",
  INSUFFICIENT_BALANCE: "balance insufficient for spend",
  INVALID_AMOUNT: "amount is not a non-negative int",
  CONCURRENT_CONFLICT: "concurrent conflicting update rejected",
  ILLEGAL_TRANSITION: "containment transition not in the legal table",
  INSUFFICIENT_ROLE: "caller role may not authorize this transition",
  MISSING_CAPABILITY: "caller lacks the capability for this transition",
  SPOOFED_PRINCIPAL: "claimed principal does not match asserted principal",
  QUARANTINED_MANDATE: "mandate belongs to a quarantined agent",
};

export function stateHash(state) {
  return sha256Hex(canonical(state));
}

// Pure action decision (POM54 aegis_decide shape, adapted to ticks and
// to the 100-agent population). `ctx` carries the model state the
// decision needs; nothing here mutates.
// action: { agentId, op, amount, targetTenant, tick, nonce,
//           claimedCapability, receiptRef, receiptHash, claimedPrincipal,
//           assertedPrincipal }
export function decideAction(ctx, action) {
  const cap = ctx.capabilities.get(action.agentId);
  if (!cap) return { allowed: false, reason: "UNKNOWN_AGENT" };
  if (action.claimedPrincipal !== undefined && action.assertedPrincipal !== undefined) {
    if (action.claimedPrincipal !== action.assertedPrincipal) {
      return { allowed: false, reason: "SPOOFED_PRINCIPAL" };
    }
  }
  if (!Number.isInteger(action.amount) || action.amount < 0) {
    return { allowed: false, reason: "INVALID_AMOUNT" };
  }
  if (action.claimedCapability !== undefined && action.claimedCapability !== null &&
      !cap.allowedOps.has(action.claimedCapability)) {
    return { allowed: false, reason: "PRIVILEGE_ESCALATION" };
  }
  if (!cap.allowedOps.has(action.op)) return { allowed: false, reason: "OP_NOT_ALLOWED" };
  if (action.tick > cap.expiryTick) return { allowed: false, reason: "EXPIRED_MANDATE" };
  if (action.targetTenant !== undefined && action.targetTenant !== null &&
      action.targetTenant !== cap.tenant) {
    return { allowed: false, reason: "CROSS_TENANT" };
  }
  if (action.nonce && ctx.seenNonces.has(action.nonce)) {
    return { allowed: false, reason: "REPLAY" };
  }
  if (action.receiptRef !== undefined && action.receiptRef !== null) {
    const ref = ctx.receiptIndex.get(action.receiptRef);
    if (!ref || ref.hash !== action.receiptHash) {
      return { allowed: false, reason: "FORGED_RECEIPT" };
    }
  }
  if (action.amount > 0 && cap.spent + action.amount > cap.spendCap) {
    return { allowed: false, reason: "OVER_CAP" };
  }
  if (action.amount > 0 && (ctx.balances.get(action.agentId) ?? 0) < action.amount) {
    return { allowed: false, reason: "INSUFFICIENT_BALANCE" };
  }
  return { allowed: true, reason: "OK" };
}

// receipts.mjs - SHA-256 hash-chained receipts, Quantum54 pattern.
// Ported verbatim (behavior) from 54T Stage B src/receipts.mjs, with
// one change: hashing uses the engine's pure-JS sha256 (./sha256.mjs)
// instead of node:crypto, so the same code runs in Node and the browser.
// Receipt: { seq, stream, type, tick, payload, prevHash, hash }
// hash = SHA-256 hex of canonical JSON of
//   { seq, stream, type, tick, payload, prevHash }
// seq is 1-based; prevHash is "GENESIS" for seq 1.
// One chain per stream ("events", "transitions", "settlements").
// Global head = SHA-256 of canonical JSON of the stream head hashes
// in fixed stream order.
import { sha256Hex } from "./sha256.mjs";
import { canonical } from "./canonical.mjs";

export function receiptHash({ seq, stream, type, tick, payload, prevHash }) {
  return sha256Hex(canonical({ seq, stream, type, tick, payload, prevHash }));
}

export const STREAMS = ["events", "transitions", "settlements"];

export class ReceiptChain {
  constructor(stream) {
    this.stream = stream;
    this.receipts = [];
    this.prevHash = "GENESIS";
  }
  emit(type, tick, payload) {
    const seq = this.receipts.length + 1;
    const receipt = {
      seq,
      stream: this.stream,
      type,
      tick,
      payload,
      prevHash: this.prevHash,
      hash: "",
    };
    receipt.hash = receiptHash(receipt);
    this.receipts.push(receipt);
    this.prevHash = receipt.hash;
    return receipt;
  }
  get head() {
    return this.receipts.length ? this.prevHash : "EMPTY";
  }
}

// Global head over stream heads in STREAMS order.
export function globalHead(headHashes) {
  return sha256Hex(canonical(headHashes));
}

// Verify a chain of receipts (same rules as the emitter).
// Returns { ok, headHash, error, checked }.
export function verifyChain(receipts) {
  let prevHash = "GENESIS";
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    if (r.seq !== i + 1) {
      return { ok: false, headHash: null, error: "seq break at index " + i, checked: i };
    }
    if (r.prevHash !== prevHash) {
      return { ok: false, headHash: null, error: "prevHash break at seq " + r.seq, checked: i };
    }
    const recomputed = receiptHash(r);
    if (recomputed !== r.hash) {
      return { ok: false, headHash: null, error: "hash mismatch at seq " + r.seq, checked: i };
    }
    prevHash = r.hash;
  }
  return { ok: true, headHash: receipts.length ? prevHash : "EMPTY", error: null, checked: receipts.length };
}

// verify.mjs - INDEPENDENT receipt verifier, ECS port.
// Ported from 54T Stage B src/verify.mjs (behavior 1:1). Deliberately
// re-implements canonical JSON and SHA-256 hashing here instead of
// importing the engine canonical/receipts modules, so a bug in the
// emitter cannot silently verify itself (Quantum54 pattern: verifier
// independent of src/). The SHA-256 below is a self-contained pure-JS
// implementation written for this file (no node: imports, so it runs in
// Node and the browser demo); it is cross-checked against the reference
// evidence by tests/determinism.mjs. Also provides the tamper test helper.
import { STREAMS } from "../../../engine/src/index.mjs";

// Independent canonical JSON (own implementation, same contract:
// key-sorted, no whitespace, throws on non-finite numbers).
export function canonicalIndependent(value) {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number") {
    if (!Number.isFinite(value)) throw new Error("canonicalIndependent: non-finite number");
    return JSON.stringify(value);
  }
  if (t === "string" || t === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) {
    let out = "[";
    for (let i = 0; i < value.length; i++) {
      if (i > 0) out += ",";
      out += canonicalIndependent(value[i]);
    }
    return out + "]";
  }
  if (t === "object") {
    const keys = Object.keys(value).sort();
    let out = "{";
    for (let i = 0; i < keys.length; i++) {
      if (i > 0) out += ",";
      out += JSON.stringify(keys[i]) + ":" + canonicalIndependent(value[keys[i]]);
    }
    return out + "}";
  }
  throw new Error("canonicalIndependent: unsupported type " + t);
}

// Self-contained pure-JS SHA-256 (FIPS 180-4), written for this file.
// Standard construction: 64 round constants, big-endian padding with a
// 64-bit length, 32-bit word schedule. No imports.
const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr32(x, n) {
  return (x >>> n) | (x << (32 - n));
}

export function sha256HexIndependent(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code < 0xdc00) {
      const next = text.charCodeAt(++i);
      const cp = 0x10000 + ((code - 0xd800) * 0x400) + (next - 0xdc00);
      bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // 64-bit big-endian length; inputs here are far below 2^32 bits.
  bytes.push(0, 0, 0, 0, (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);
  let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array(64);
  for (let off = 0; off < bytes.length; off += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = ((bytes[off + t * 4] << 24) | (bytes[off + t * 4 + 1] << 16) |
        (bytes[off + t * 4 + 2] << 8) | bytes[off + t * 4 + 3]) | 0;
    }
    for (let t = 16; t < 64; t++) {
      const s0 = (rotr32(w[t - 15], 7) ^ rotr32(w[t - 15], 18) ^ (w[t - 15] >>> 3)) | 0;
      const s1 = (rotr32(w[t - 2], 17) ^ rotr32(w[t - 2], 19) ^ (w[t - 2] >>> 10)) | 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];
    for (let t = 0; t < 64; t++) {
      const bigS1 = (rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25)) | 0;
      const ch = ((e & f) ^ (~e & g)) | 0;
      const temp1 = (hh + bigS1 + ch + K256[t] + w[t]) | 0;
      const bigS0 = (rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22)) | 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) | 0;
      const temp2 = (bigS0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h = [(h[0] + a) | 0, (h[1] + b) | 0, (h[2] + c) | 0, (h[3] + d) | 0,
      (h[4] + e) | 0, (h[5] + f) | 0, (h[6] + g) | 0, (h[7] + hh) | 0];
  }
  const hex = (x) => ("00000000" + (x >>> 0).toString(16)).slice(-8);
  return h.map(hex).join("");
}

export function receiptHashIndependent(r) {
  return sha256HexIndependent(
    canonicalIndependent({
      seq: r.seq,
      stream: r.stream,
      type: r.type,
      tick: r.tick,
      payload: r.payload,
      prevHash: r.prevHash,
    })
  );
}

// Verify one stream's receipts. Returns { ok, headHash, error, checked }.
export function verifyChainIndependent(receipts) {
  let prev = "GENESIS";
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    if (r.seq !== i + 1) return { ok: false, headHash: null, error: "seq break at index " + i, checked: i };
    if (r.prevHash !== prev) return { ok: false, headHash: null, error: "prevHash break at seq " + r.seq, checked: i };
    if (receiptHashIndependent(r) !== r.hash) {
      return { ok: false, headHash: null, error: "hash mismatch at seq " + r.seq, checked: i };
    }
    prev = r.hash;
  }
  return { ok: true, headHash: receipts.length ? prev : "EMPTY", error: null, checked: receipts.length };
}

// Verify all streams plus the global head.
// heads: { stream: headHash } in fixed order; globalHeadHex: expected.
// Stream order is the fixed STREAMS order (events, transitions,
// settlements), matching the emitter's globalHead call.
export function verifyAllIndependent(streams, globalHeadHex) {
  const heads = [];
  const perStream = {};
  for (const name of STREAMS) {
    const v = verifyChainIndependent(streams[name] || []);
    perStream[name] = v;
    if (!v.ok) return { ok: false, perStream, error: "stream " + name + ": " + v.error };
    heads.push(v.headHash);
  }
  const recomputed = sha256HexIndependent(canonicalIndependent(heads));
  if (recomputed !== globalHeadHex) {
    return { ok: false, perStream, error: "global head mismatch", recomputed, expected: globalHeadHex };
  }
  return { ok: true, perStream, headHash: recomputed };
}

// Tamper test: deep-copy receipts, mutate one payload field, verify must
// fail at exactly that receipt's seq. Returns { detected, failSeq }.
export function tamperTest(receipts, seqToMutate) {
  const copy = JSON.parse(JSON.stringify(receipts));
  const target = copy.find((r) => r.seq === seqToMutate);
  if (!target) return { detected: false, failSeq: null, error: "seq not found" };
  target.payload.tampered = true;
  const v = verifyChainIndependent(copy);
  return { detected: !v.ok, failSeq: v.error ? seqToMutate : null, error: v.error, checked: v.checked };
}

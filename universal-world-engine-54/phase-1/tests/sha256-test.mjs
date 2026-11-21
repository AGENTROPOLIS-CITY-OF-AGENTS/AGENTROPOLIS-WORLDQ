// sha256-test.mjs - Pure-JS SHA-256 vs node:crypto (cross-check).
// The engine's sha256 must match node:crypto on every input, because
// receipt hashes must be identical in Node tests and the browser demo.
import { sha256Hex } from "../engine/src/sha256.mjs";
import { canonical } from "../engine/src/canonical.mjs";
import { createHash } from "node:crypto";

const cases = [
  "",
  "abc",
  "The quick brown fox jumps over the lazy dog",
  "x".repeat(1000),
  '{"a":1,"b":[1,2,3]}',
  "café ☃",
  "0".repeat(64),
  JSON.stringify({ seq: 1, stream: "events", type: "T", tick: 0, payload: { a: 1 }, prevHash: "GENESIS" }),
];
let failures = 0;
for (const c of cases) {
  const mine = sha256Hex(c);
  const ref = createHash("sha256").update(c, "utf8").digest("hex");
  if (mine !== ref) {
    failures++;
    console.error("MISMATCH for input:", JSON.stringify(c.slice(0, 40)));
  }
}
// Canonical JSON spot checks.
if (canonical({ b: 1, a: [3, 2, { d: 4, c: 5 }] }) !== '{"a":[3,2,{"c":5,"d":4}],"b":1}') {
  failures++;
  console.error("canonical: key sorting mismatch");
}
if (canonical(null) !== "null" || canonical([1, "x", true]) !== '[1,"x",true]') {
  failures++;
  console.error("canonical: literal mismatch");
}
let threw = false;
try { canonical({ x: undefined }); } catch { threw = true; }
if (!threw) { failures++; console.error("canonical: did not throw on undefined"); }

if (failures) {
  console.error(`sha256-test: FAIL (${failures} failures)`);
  process.exit(1);
}
console.log(`sha256-test: PASS (${cases.length} hash vectors + canonical checks)`);

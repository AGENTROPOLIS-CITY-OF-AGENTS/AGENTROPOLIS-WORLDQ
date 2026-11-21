// no-imports.mjs - G1 dependency scan: the engine has zero imports
// from individual applications.
// Rule: every .mjs file under phase-1 EXCEPT tests/ and the demo build
// script may import ONLY via relative paths that stay inside the
// phase-1 tree. No absolute paths, no imports reaching outside
// phase-1, no npm bare specifiers, no node: builtins in engine/ecs/
// clock/render/debug/scene/replay/simulation code (Node-only code
// lives in tests/ and build scripts). The renderer takes THREE as a
// parameter (UMD global), never as an import.
// Exits non-zero and lists every violation.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED_NODE_DIRS = new Set(["tests"]); // only tests/ may use node: builtins
const SCAN_DIRS = ["engine", "ecs", "clock", "render", "debug", "scene", "replay", "simulation", "profiles"];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (p.endsWith(".mjs") || p.endsWith(".js")) out.push(p);
  }
  return out;
}

const violations = [];
for (const sub of SCAN_DIRS) {
  const dir = join(ROOT, sub);
  let files = [];
  try { files = walk(dir); } catch { continue; }
  for (const file of files) {
    const rel = relative(ROOT, file);
    const text = readFileSync(file, "utf8");
    // The vendored UMD three.js is not an engine module; skip it.
    if (file.endsWith("three-r149.js")) continue;
    // Node build scripts (build-*.mjs) run in Node by design; they may
    // use node: builtins. They are not engine modules.
    const isBuildScript = file.split(sep).pop().startsWith("build-");
    const imports = [...text.matchAll(/^\s*import\s[^;]*?from\s*["']([^"']+)["']/gm)]
      .map((m) => m[1]);
    const sideEffect = [...text.matchAll(/^\s*import\s*["']([^"']+)["']/gm)]
      .map((m) => m[1]);
    for (const spec of [...imports, ...sideEffect]) {
      if (spec.startsWith("node:")) {
        const topDir = rel.split(sep)[0];
        if (!ALLOWED_NODE_DIRS.has(topDir) && !isBuildScript) {
          violations.push(`${rel}: node: import in non-test code: ${spec}`);
        }
      } else if (!spec.startsWith(".")) {
        violations.push(`${rel}: non-relative import: ${spec}`);
      } else {
        const target = resolve(dirname(file), spec);
        const targetRel = relative(ROOT, target);
        if (targetRel.startsWith("..") || targetRel.startsWith("/")) {
          violations.push(`${rel}: import escapes phase-1 tree: ${spec}`);
        }
      }
    }
    // Dynamic import() with a non-relative specifier.
    for (const m of text.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) {
      if (!m[1].startsWith(".")) violations.push(`${rel}: dynamic import of non-relative specifier: ${m[1]}`);
    }
  }
}

if (violations.length) {
  console.error("no-imports: FAIL - zero application imports rule violated:");
  for (const v of violations) console.error("  - " + v);
  process.exit(1);
}
console.log("no-imports: PASS - zero imports from outside the phase-1 tree (engine/ecs/clock/render/debug/scene/replay/simulation/profiles scanned; three-r149.js vendored UMD skipped by design)");

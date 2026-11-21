// run-all.mjs - Shared test harness runner (Phase 1).
// Runs every Node test under tests/ except itself and the browser probe
// (tests/cdp-probe.mjs runs separately: it needs headless Chromium).
// Each test file exits 0 on PASS, non-zero on FAIL. This runner reports
// per-file PASS/FAIL and exits non-zero if any file fails.
// Usage: node tests/run-all.mjs
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(["run-all.mjs", "cdp-probe.mjs"]);
const files = readdirSync(TESTS_DIR)
  .filter((f) => f.endsWith(".mjs") && !SKIP.has(f))
  .sort();

if (!files.length) {
  console.error("run-all: no test files found");
  process.exit(1);
}

let failed = 0;
for (const f of files) {
  const res = spawnSync("node", [join(TESTS_DIR, f)], { stdio: "inherit" });
  if (res.status !== 0) {
    failed++;
    console.error(`run-all: ${f} FAILED (exit ${res.status})`);
  } else {
    console.log(`run-all: ${f} PASS`);
  }
}
console.log(`run-all: ${files.length - failed}/${files.length} test files PASS`);
process.exit(failed ? 1 : 0);

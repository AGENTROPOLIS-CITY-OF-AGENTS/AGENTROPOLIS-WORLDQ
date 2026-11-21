// build-demo.mjs - Build profiles/city/demo.html as ONE self-contained file
// openable via file:// with zero network calls.
// Inlines render/src/three-r149.js as a classic script, then bundles the
// engine modules into ONE <script type="module"> by concatenating them in
// explicit topological order with import lines stripped and export keywords
// stripped. The demo bootstrap runs last.
// If simulation/agents/src/engine.mjs has not landed yet (Worker B), a stub
// is bundled instead that reports "sim not landed" honestly; it does not
// implement any simulation. Re-run this build once Worker B lands.
// Verifies the three-r149.js SHA before and after. No em dashes in this file.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHASE1 = path.resolve(__dirname, "../..");
const THREE_PATH = path.join(PHASE1, "render/src/three-r149.js");
const THREE_SHA = "7f80827f2088d205dde48401007c692e685a5d4c28cfc76778b049214eb781a6";
const OUT = path.join(__dirname, "demo.html");

function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

const before = sha256File(THREE_PATH);
if (before !== THREE_SHA) {
  console.error("three-r149.js SHA MISMATCH before build: " + before);
  process.exit(1);
}

const MODULES = [
  "engine/src/canonical.mjs",
  "engine/src/sha256.mjs",
  "engine/src/prng.mjs",
  "engine/src/quantize.mjs",
  "engine/src/receipts.mjs",
  "engine/src/config.mjs",
  "ecs/src/components.mjs",
  "ecs/src/world.mjs",
  "ecs/src/systems.mjs",
  "clock/src/clock.mjs",
  // sim slot filled below
  "render/src/renderer.mjs",
  "render/src/district.mjs",
  "debug/src/hud.mjs",
  "scene/src/serialize.mjs",
  "replay/src/replay.mjs",
  "profiles/city/city-profile.mjs",
  "profiles/city/demo-bootstrap.mjs",
];

const SIM_MODULES = [
  "simulation/agents/src/authz.mjs",
  "simulation/agents/src/state-machine.mjs",
  "simulation/agents/src/scenarios.mjs",
  "simulation/agents/src/payrail.mjs",
  "simulation/agents/src/population.mjs",
  "simulation/agents/src/verify.mjs",
  "simulation/agents/src/engine.mjs",
];
const SIM_PATH = path.join(PHASE1, "simulation/agents/src/engine.mjs");
const SIM_STUB = `// SIM STUB: Worker B simulation has not landed yet.
// createSim and runSimulation exist only to report that honestly.
// This stub implements NO simulation.
function createSim(config) {
  throw new Error("sim not landed: simulation/agents/src/engine.mjs does not exist yet (Worker B pending)");
}
function runSimulation(config) {
  throw new Error("sim not landed: simulation/agents/src/engine.mjs does not exist yet (Worker B pending)");
}
`;

function stripModule(src, rel) {
  const lines = src.split("\n");
  const out = [];
  let droppingExportBlock = false;
  let inImport = false;
  for (const line of lines) {
    if (inImport) {
      if (line.includes(";")) inImport = false;
      continue;
    }
    if (droppingExportBlock) {
      if (line.includes("}")) droppingExportBlock = false;
      continue;
    }
    if (/^\s*import\s+/.test(line)) {
      if (!line.includes(";")) inImport = true;
      continue;
    }
    if (/^\s*export\s*\{/.test(line)) {
      if (!line.includes("}")) droppingExportBlock = true;
      continue;
    }
    const m = line.match(/^(\s*)export\s+(const|let|var|function|class|async\s+function)\s+/);
    if (m) {
      out.push(line.replace(/^(\s*)export\s+/, "$1"));
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

const chunks = [];
let simLanded = false;
for (const rel of MODULES) {
  if (rel === "clock/src/clock.mjs") {
    chunks.push("// ---- " + rel + " ----\n" + stripModule(fs.readFileSync(path.join(PHASE1, rel), "utf8"), rel));
    if (fs.existsSync(SIM_PATH)) {
      simLanded = true;
      for (const simRel of SIM_MODULES) {
        const simFile = path.join(PHASE1, simRel);
        if (!fs.existsSync(simFile)) {
          console.error("MISSING SIM MODULE: " + simRel);
          process.exit(1);
        }
        chunks.push("// ---- " + simRel + " (Worker B) ----\n" + stripModule(fs.readFileSync(simFile, "utf8"), simRel));
      }
    } else {
      chunks.push("// ---- simulation stub (Worker B not landed) ----\n" + SIM_STUB);
    }
    continue;
  }
  const p = path.join(PHASE1, rel);
  if (!fs.existsSync(p)) {
    console.error("MISSING MODULE: " + rel);
    process.exit(1);
  }
  chunks.push("// ---- " + rel + " ----\n" + stripModule(fs.readFileSync(p, "utf8"), rel));
}

const threeSrc = fs.readFileSync(THREE_PATH, "utf8");
if (threeSrc.includes("</script")) {
  console.error("three-r149.js contains a closing script tag; refusing to inline");
  process.exit(1);
}
const bundle = chunks.join("\n");
// The foundation modules (engine/ecs/clock) each carry ONE em dash in a
// line-1 header comment. Those files must not be rewritten, so the bundle
// normalizes that character to a hyphen at build time only. Sources on
// disk are untouched. My own files contain no em dashes (checked below).
const emDash = String.fromCharCode(8212);
const bundleClean = bundle.split(emDash).join("-");
if (bundleClean.includes("</script")) {
  console.error("bundle contains a closing script tag; refusing to write demo.html");
  process.exit(1);
}
// Check my own files for em dashes (foundation files are exempt: they
// are read-only inputs and are normalized above).
const myFiles = [
  "render/src/renderer.mjs", "render/src/district.mjs", "debug/src/hud.mjs",
  "scene/src/serialize.mjs", "replay/src/replay.mjs",
  "profiles/city/city-profile.mjs", "profiles/city/demo-bootstrap.mjs",
  "profiles/city/build-demo.mjs",
];
for (const rel of myFiles) {
  if (fs.readFileSync(path.join(PHASE1, rel), "utf8").includes(emDash)) {
    console.error("em dash found in my file " + rel + "; refusing to write demo.html");
    process.exit(1);
  }
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>AGENTROPOLIS UNIVERSAL WORLD ENGINE 54 - Phase 1 City Demo (Pre-launch)</title>
<style>
html, body { margin: 0; padding: 0; height: 100%; background: #05070a; color: #e8f4ff; font-family: sans-serif; overflow: hidden; }
#scene { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
#banner { position: fixed; top: 0; left: 0; right: 0; z-index: 10; background: rgba(5,7,10,0.88); border-bottom: 2px solid #00e5ff; padding: 8px 12px; font-size: 13px; font-weight: bold; letter-spacing: 0.04em; }
#banner span.dev { color: #ffb300; }
#status { position: fixed; top: 44px; left: 12px; z-index: 10; font-size: 12px; color: #9aa7b8; max-width: 60vw; }
#hud { position: fixed; top: 44px; right: 8px; z-index: 10; width: 264px; max-height: calc(100% - 120px); overflow-y: auto; background: rgba(5,7,10,0.88); border: 1px solid #1c2a3a; padding: 8px 10px; font-size: 12px; }
.uwe-hud-title { font-weight: bold; color: #00e5ff; margin-bottom: 6px; }
#hud-collapse-btn { float: right; width: 44px; height: 44px; font-size: 20px; background: #05070a; color: #00e5ff; border: 1px solid #00e5ff; }
.uwe-hud.collapsed .uwe-hud-sec, .uwe-hud.collapsed .uwe-hud-row, .uwe-hud.collapsed #hud-verify-btn, .uwe-hud.collapsed .uwe-hud-out { display: none; }
.uwe-hud-sec { color: #ff2638; font-weight: bold; margin: 8px 0 2px 0; letter-spacing: 0.08em; }
.uwe-hud-row { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
.uwe-hud-row span { color: #9aa7b8; }
.uwe-hud-row b { color: #e8f4ff; font-weight: normal; text-align: right; word-break: break-all; }
#hud-verify-btn { margin-top: 6px; width: 100%; min-height: 44px; background: #00e5ff; color: #05070a; border: none; font-weight: bold; font-size: 14px; }
.uwe-hud-out { margin-top: 4px; color: #7dff9a; word-break: break-all; }
#zoom { position: fixed; right: 12px; bottom: 12px; z-index: 10; display: flex; gap: 8px; }
#zoom button { width: 48px; height: 48px; font-size: 24px; font-weight: bold; background: rgba(5,7,10,0.9); color: #00e5ff; border: 2px solid #00e5ff; }
#autotest { position: fixed; left: 8px; bottom: 8px; z-index: 10; max-width: 60vw; background: rgba(5,7,10,0.9); border: 1px solid #1c2a3a; padding: 8px; font-size: 12px; white-space: pre-wrap; display: none; }
#autotest[data-done="true"] { display: block; }
@media (max-width: 700px) { #hud { width: 200px; font-size: 11px; } #status { max-width: 40vw; } }
/* ScrollXCarousel lite tier: vanilla JS adaptation of
   workspace/builds/ribbon-kit/scroll-x-carousel.tsx.
   Outer: relative, full viewport width. Container: sticky, overflow hidden,
   full width, top 0, left 0. Wrap: width fit track, x from -0% to -80%
   (prop spelled xRagnge in the supplied component). Progress: bar, scaleX
   0 to 1, origin left. Five panels of 100vw each make -80% land exactly
   on the last panel. Hidden unless body carries the lite class. */
#lite-carousel { display: none; }
html.lite { overflow: auto; height: auto; }
/* body MUST stay overflow visible: any non-visible overflow on body makes
   body a scroll container, and the sticky container then sticks to body
   (which never scrolls internally) instead of the viewport. */
body.lite { overflow: visible; height: auto; }
body.lite #lite-carousel { display: block; position: relative; width: 100vw; max-width: 100%; height: 500vh; }
body.lite #zoom { display: none; }
.sxc-container { position: sticky; top: 0; left: 0; width: 100%; height: 100vh; overflow: hidden; background: #05070a; }
.sxc-track { display: flex; width: max-content; height: 100%; will-change: transform; }
.sxc-panel { flex: 0 0 100vw; width: 100vw; height: 100vh; overflow: hidden; padding: 56px 28px 28px 28px; box-sizing: border-box; background: #05070a; border-right: 1px solid #1c2a3a; }
.sxc-kicker { color: #ff2638; font-weight: bold; letter-spacing: 0.12em; font-size: 13px; }
.sxc-panel h2 { color: #00e5ff; font-size: 30px; margin: 10px 0 8px 0; }
.sxc-panel p { color: #9aa7b8; font-size: 14px; line-height: 1.5; max-width: 560px; }
.sxc-rows { max-width: 560px; margin-top: 16px; border-top: 1px solid #1c2a3a; }
.sxc-row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid #1c2a3a; font-size: 14px; }
.sxc-row span { color: #9aa7b8; }
.sxc-row b { color: #e8f4ff; font-weight: normal; text-align: right; word-break: break-all; }
.sxc-mapwrap { height: 62vh; margin-top: 12px; border: 1px solid #1c2a3a; }
#lite-map { display: block; width: 100%; height: 100%; }
.sxc-note { font-size: 12px; color: #9aa7b8; margin-top: 10px; }
.sxc-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 6px; background: #1c2a3a; border-top: 2px solid #ff2638; overflow: hidden; }
.sxc-progress-fill { height: 100%; background: #00e5ff; transform-origin: left; transform: scaleX(0); }
body.lite #hud { position: static; width: min(620px, 100%); box-sizing: border-box; max-height: 78vh; margin: 0 auto; }
body.lite #status { position: static; max-width: none; }
body.lite #autotest { position: static; max-width: none; margin-top: 12px; }
@media (max-width: 700px) { .sxc-panel { padding: 88px 16px 24px 16px; } .sxc-panel h2 { font-size: 24px; } .sxc-mapwrap { height: 54vh; } }
</style>
</head>
<body>
<canvas id="scene"></canvas>
<div id="banner">DEMO - PRE-LAUNCH - SIMULATED - DEVELOPMENT MODE <span class="dev">- procedural geometry, not final art</span> - HERMES CITY 11 towers - Three.js r149 - MATH54/POM54 PROVISIONAL</div>
<div id="status"></div>
<div id="hud"></div>
<div id="zoom"><button id="zoom-in" type="button" aria-label="Zoom in">+</button><button id="zoom-out" type="button" aria-label="Zoom out">-</button></div>
<pre id="autotest"></pre>
<div id="lite-carousel">
  <div class="sxc-container">
    <div class="sxc-track" id="lite-track">
      <section class="sxc-panel" aria-label="Overview">
        <div class="sxc-kicker">LITE TIER - 2D DASHBOARD</div>
        <h2>Scroll down. The panels travel sideways.</h2>
        <p>This is the 2D fallback dashboard. The same sim runs underneath, the same receipts chain up, and the panels below carry the same live numbers as the 3D view. Keep scrolling to walk the dashboard.</p>
        <div class="sxc-rows">
          <div class="sxc-row"><span>sim status</span><b id="lite-ov-simstatus">n/a</b></div>
          <div class="sxc-row"><span>sim tick</span><b id="lite-ov-tick">n/a</b></div>
          <div class="sxc-row"><span>receipts total</span><b id="lite-ov-receipts">n/a</b></div>
          <div class="sxc-row"><span>chain head</span><b id="lite-ov-head">n/a</b></div>
          <div class="sxc-row"><span>agents alive</span><b id="lite-ov-agents">n/a</b></div>
          <div class="sxc-row"><span>towers</span><b id="lite-ov-towers">n/a</b></div>
          <div class="sxc-row"><span>scroll progress</span><b id="lite-ov-progress">0%</b></div>
        </div>
      </section>
      <section class="sxc-panel" aria-label="District map">
        <div class="sxc-kicker">DISTRICT MAP - 2D FALLBACK</div>
        <h2>Hermes City, top down</h2>
        <div class="sxc-mapwrap"><canvas id="lite-map"></canvas></div>
        <p class="sxc-note">11 towers, 4 districts, 100 agents. Procedural geometry, not final art.</p>
      </section>
      <section class="sxc-panel" id="lite-panel-hud" aria-label="Debug HUD"></section>
      <section class="sxc-panel" id="lite-panel-status" aria-label="Status and self checks">
        <div class="sxc-kicker">STATUS - SELF CHECKS</div>
        <h2>Status and autotest</h2>
        <p>Autotest output appears here when the page loads with ?autotest=1.</p>
      </section>
      <section class="sxc-panel" aria-label="Receipt chain">
        <div class="sxc-kicker">RECEIPTS - CHAIN HEAD</div>
        <h2>Same sim. Same receipts.</h2>
        <div class="sxc-rows">
          <div class="sxc-row"><span>receipts total</span><b id="lite-rc-receipts">n/a</b></div>
          <div class="sxc-row"><span>chain head</span><b id="lite-rc-headfull">n/a</b></div>
          <div class="sxc-row"><span>reference head, 60 ticks</span><b id="lite-rc-ref">n/a</b></div>
          <div class="sxc-row"><span>determinism</span><b id="lite-rc-chain">n/a</b></div>
          <div class="sxc-row"><span>sim status</span><b id="lite-rc-simstatus">n/a</b></div>
        </div>
        <p class="sxc-note">Tap VERIFY CHAIN in the HUD panel to check the chain. The reference head is the 60 tick head from the Phase 1 build.</p>
      </section>
    </div>
    <div class="sxc-progress"><div class="sxc-progress-fill" id="lite-progress-fill"></div></div>
  </div>
</div>
<script>
${threeSrc}
</script>
<script type="module">
${bundleClean}
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, "utf8");
const after = sha256File(THREE_PATH);
if (after !== THREE_SHA) {
  console.error("three-r149.js SHA CHANGED during build: " + after);
  process.exit(1);
}
console.log("built " + OUT + " (" + html.length + " chars)");
console.log("three-r149.js SHA verified before and after: " + THREE_SHA);
console.log("sim landed: " + simLanded);
console.log("demo sha256: " + crypto.createHash("sha256").update(html).digest("hex"));

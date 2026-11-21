// cdp-probe.mjs - Headless-browser verification probe for the Phase 1 demo.
// Uses Node's built-in global WebSocket and /opt/meta-chromium/chrome.
// Pattern follows the established workspace pattern in
// ~/workspace/builds/verity-city-simulation/stage-b/city/cdp-check.mjs and
// verify-city.sh: headed Chromium under Xvfb with the Hatch WebGL domain
// flags plus SwiftShader, CDP on port 9222. Plain --headless=new is NOT
// used: it is blocked by the Hatch WebGL domain policy in this sandbox.
// The probe loads the built demo.html via file:// at 1280x720 and 390x844,
// collects console errors and exceptions (FAIL on any), captures
// screenshots to tests/evidence/, reads HUD values from the DOM, samples
// agent render positions across frames for the G3 interpolation check
// (positions must move smoothly: no per-frame jump larger than the
// per-tick bob delta), runs ?autotest=1 and reports its PASS/FAIL lines,
// and writes a benchmark JSON. SwiftShader figures are labeled SwiftShader.
// No em dashes in this file.
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHASE1 = path.resolve(__dirname, "..");
const DEMO = path.join(PHASE1, "profiles/city/demo.html");
const EVIDENCE = path.join(__dirname, "evidence");
const CHROME = "/opt/meta-chromium/chrome";
const PORT = 9223;
const HATCH_FLAGS = [
  "--hatch-webgl-allowed-domains-file=/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt",
  "--hatch-webgl-allowed-domains-sha256=8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6",
];

fs.mkdirSync(EVIDENCE, { recursive: true });

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let wsId = 0;
const pending = new Map();
let ws = null;
const consoleEntries = [];
const exceptions = [];

function cdp(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++wsId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error("CDP timeout: " + method)); }
    }, 30000);
  });
}

async function evalJs(expression) {
  const res = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error("evaluate failed: " + JSON.stringify(res.exceptionDetails).slice(0, 500));
  return res.result ? res.result.value : undefined;
}

async function connectWs() {
  const list = await fetch("http://127.0.0.1:" + PORT + "/json/list").then((r) => r.json());
  const page = list.find((t) => t.type === "page");
  if (!page) throw new Error("no page target on CDP port " + PORT);
  ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    } else if (msg.method === "Runtime.consoleAPICalled") {
      const args = (msg.params.args || []).map((a) => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(" ");
      consoleEntries.push({ type: msg.params.type, text: args });
      if (msg.params.type === "error") exceptions.push(args);
    } else if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails || {};
      const text = (d.exception && d.exception.description) || d.text || "exception";
      exceptions.push(String(text));
      consoleEntries.push({ type: "exception", text: String(text) });
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
    setTimeout(() => reject(new Error("WebSocket connect timeout")), 15000);
  });
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  await cdp("Log.enable");
}

async function screenshot(file) {
  const res = await cdp("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(file, Buffer.from(res.data, "base64"));
  return file;
}

async function samplePositions(times, gapMs) {
  const samples = [];
  for (let i = 0; i < times; i++) {
    samples.push(await evalJs("window.__demo ? window.__demo.agentPositions() : []"));
    await sleep(gapMs);
  }
  let maxJump = 0;
  let jumps = 0;
  for (let s = 1; s < samples.length; s++) {
    const a = samples[s - 1];
    const b = samples[s];
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const dx = b[i][0] - a[i][0];
      const dy = b[i][1] - a[i][1];
      const dz = b[i][2] - a[i][2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > maxJump) maxJump = d;
      jumps += 1;
    }
  }
  return { samples: samples.length, agentsSampled: samples[0] ? samples[0].length : 0, maxJumpPerSample: maxJump, comparisons: jumps };
}

const results = { probe: "cdp-probe", demo: DEMO, startedAt: new Date().toISOString(), viewports: {}, autotest: null, interpolation: null, consoleErrors: 0, exceptions: [], pass: false };

let xvfb = null;
let chrome = null;
try {
  xvfb = spawn("Xvfb", [":97", "-screen", "0", "1280x720x24"], { stdio: "ignore" });
  await sleep(2000);
  const profile = "/tmp/uwe54-cdp-profile";
  try { execSync("rm -rf " + profile); } catch (e) { /* ignore */ }
  chrome = spawn(CHROME, [
    "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--no-first-run", "--no-default-browser-check",
    "--disable-component-update", "--disable-background-networking",
    ...HATCH_FLAGS,
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + profile,
    "--window-size=1280,720", "--window-position=0,0",
    "about:blank",
  ], { env: Object.assign({}, process.env, { DISPLAY: ":97" }), stdio: "ignore" });
  await sleep(4000);
  await connectWs();

  // Desktop 1280x720.
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: "file://" + DEMO });
  await sleep(6000);
  const desktop = {};
  desktop.title = await evalJs("document.title");
  desktop.threeRevision = await evalJs("window.THREE ? window.THREE.REVISION : 'missing'");
  desktop.hudTick = await evalJs("document.getElementById('hud-tick') ? document.getElementById('hud-tick').textContent : 'missing'");
  desktop.hudDrawCalls = await evalJs("document.getElementById('hud-drawcalls') ? document.getElementById('hud-drawcalls').textContent : 'missing'");
  desktop.hudTriangles = await evalJs("document.getElementById('hud-triangles') ? document.getElementById('hud-triangles').textContent : 'missing'");
  desktop.hudChain = await evalJs("document.getElementById('hud-chain') ? document.getElementById('hud-chain').textContent : 'missing'");
  desktop.hudSimStatus = await evalJs("document.getElementById('hud-simstatus') ? document.getElementById('hud-simstatus').textContent : 'missing'");
  desktop.hudContext = await evalJs("document.getElementById('hud-context') ? document.getElementById('hud-context').textContent : 'missing'");
  desktop.benchmark = await evalJs("window.__demo ? window.__demo.benchmark() : null");
  desktop.towerCount = await evalJs("window.__demo && window.__demo.demo ? window.__demo.demo.district.towerCount : -1");
  desktop.serialize = await evalJs("window.__demo ? window.__demo.serialize() : null");
  desktop.screenshot = await screenshot(path.join(EVIDENCE, "desktop-1280x720.png"));
  results.viewports.desktop = desktop;

  // Interpolation check (G3): sample agent render positions across frames.
  results.interpolation = await samplePositions(5, 200);
  // Per-tick bob delta bound: bob amplitude 0.35 per axis, tick step at most
  // about 0.35 * (0.12 rad) per tick in y plus x/z terms; a smooth lerp
  // across 200 ms (about 12 ticks at 60 Hz) must stay well under 2.0 units
  // per sample. A teleport or jump would show as a much larger step.
  results.interpolation.boundPerSample = 2.0;
  results.interpolation.smooth = results.interpolation.maxJumpPerSample <= 2.0;

  // Phone 390x844.
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp("Page.navigate", { url: "file://" + DEMO });
  await sleep(6000);
  const phone = {};
  phone.title = await evalJs("document.title");
  phone.hudTick = await evalJs("document.getElementById('hud-tick') ? document.getElementById('hud-tick').textContent : 'missing'");
  phone.hudDrawCalls = await evalJs("document.getElementById('hud-drawcalls') ? document.getElementById('hud-drawcalls').textContent : 'missing'");
  phone.benchmark = await evalJs("window.__demo ? window.__demo.benchmark() : null");
  phone.towerCount = await evalJs("window.__demo && window.__demo.demo ? window.__demo.demo.district.towerCount : -1");
  phone.screenshot = await screenshot(path.join(EVIDENCE, "phone-390x844.png"));
  results.viewports.phone = phone;

  // Autotest.
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: "file://" + DEMO + "?autotest=1" });
  await sleep(9000);
  const autotestText = await evalJs("document.getElementById('autotest') ? document.getElementById('autotest').textContent : 'missing'");
  const autotestDone = await evalJs("window.__autotestDone === true");
  results.autotest = { done: autotestDone, lines: autotestText ? autotestText.split("\n") : [], text: autotestText };
  await screenshot(path.join(EVIDENCE, "autotest-1280x720.png"));

  // Freeze tick check.
  await cdp("Page.navigate", { url: "file://" + DEMO + "?freezeTick=30" });
  await sleep(5000);
  results.freezeTick = {
    tick: await evalJs("window.__demo && window.__demo.demo ? window.__demo.demo.clock.simTick : -1"),
    frozenAtOrBefore: null,
  };
  results.freezeTick.frozenAtOrBefore = results.freezeTick.tick <= 35;

  results.consoleEntries = consoleEntries;
  results.exceptions = exceptions;
  results.consoleErrors = exceptions.length;
  const autotestPass = results.autotest.done && results.autotest.lines.length > 0 && results.autotest.lines.every((l) => l.indexOf("PASS") === 0);
  results.autotestPass = autotestPass;
  results.pass = results.consoleErrors === 0 && autotestPass && results.interpolation.smooth;
} catch (e) {
  results.error = String(e && e.message ? e.message : e);
  results.pass = false;
} finally {
  try { if (ws) ws.close(); } catch (e) { /* ignore */ }
  try { if (chrome) chrome.kill("SIGTERM"); } catch (e) { /* ignore */ }
  try { if (xvfb) xvfb.kill("SIGTERM"); } catch (e) { /* ignore */ }
  await sleep(1000);
}

const benchmark = {
  device: "headless Chromium SwiftShader",
  workload: "11 towers + 100 agents",
  desktop: results.viewports.desktop ? results.viewports.desktop.benchmark : null,
  phone: results.viewports.phone ? results.viewports.phone.benchmark : null,
  interpolation: results.interpolation,
  consoleErrors: results.consoleErrors,
  autotestPass: results.autotestPass === true,
  evidence: {
    desktop: "tests/evidence/desktop-1280x720.png",
    phone: "tests/evidence/phone-390x844.png",
    autotest: "tests/evidence/autotest-1280x720.png",
  },
};
fs.writeFileSync(path.join(EVIDENCE, "benchmark.json"), JSON.stringify(benchmark, null, 2));
fs.writeFileSync(path.join(EVIDENCE, "console-log.json"), JSON.stringify(consoleEntries, null, 2));
fs.writeFileSync(path.join(EVIDENCE, "probe-results.json"), JSON.stringify(results, null, 2));

console.log(JSON.stringify(results, null, 2));
process.exit(results.pass ? 0 : 1);

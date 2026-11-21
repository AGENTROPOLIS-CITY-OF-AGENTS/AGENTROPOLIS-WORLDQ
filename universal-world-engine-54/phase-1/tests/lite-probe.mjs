// lite-probe.mjs - Verification probe for the ScrollXCarousel lite tier.
// Loads profiles/city/demo.html? tier=lite in headed Chromium under Xvfb
// (same pattern as tests/cdp-probe.mjs), scrolls through the carousel at
// progress 0, 0.5 and 1, captures screenshots at desktop 1280x720 and
// phone 390x844, clicks VERIFY CHAIN in the HUD panel, and checks the
// default tier still hides the carousel. Writes screenshots and a results
// JSON to tests/evidence/. Fails on any console error or exception.
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
  let list = null;
  let lastErr = null;
  for (let i = 0; i < 30; i++) {
    try {
      list = await fetch("http://127.0.0.1:" + PORT + "/json/list").then((r) => r.json());
      break;
    } catch (e) { lastErr = e; await sleep(1000); }
  }
  if (!list) throw new Error("CDP list unreachable after 30 s: " + String(lastErr));
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

async function liteState() {
  return evalJs(`({
    liteReady: window.__liteReady === true,
    progress: window.__liteCarousel ? window.__liteCarousel.progress() : null,
    trackTransform: (document.getElementById('lite-track') || {}).style ? document.getElementById('lite-track').style.transform : 'missing',
    fillTransform: (document.getElementById('lite-progress-fill') || {}).style ? document.getElementById('lite-progress-fill').style.transform : 'missing',
    carouselDisplay: getComputedStyle(document.getElementById('lite-carousel')).display,
    containerTop: Math.round(document.querySelector('.sxc-container').getBoundingClientRect().top),
    scrollMax: document.documentElement.scrollHeight - window.innerHeight,
    scrollY: window.scrollY,
    hudTick: document.getElementById('hud-tick') ? document.getElementById('hud-tick').textContent : 'missing',
    hudReceipts: document.getElementById('hud-receipts') ? document.getElementById('hud-receipts').textContent : 'missing',
    hudHead: document.getElementById('hud-head') ? document.getElementById('hud-head').textContent : 'missing',
    hudChain: document.getElementById('hud-chain') ? document.getElementById('hud-chain').textContent : 'missing',
    ovTick: document.getElementById('lite-ov-tick') ? document.getElementById('lite-ov-tick').textContent : 'missing',
    ovReceipts: document.getElementById('lite-ov-receipts') ? document.getElementById('lite-ov-receipts').textContent : 'missing',
    ovProgress: document.getElementById('lite-ov-progress') ? document.getElementById('lite-ov-progress').textContent : 'missing',
    rcHeadFull: document.getElementById('lite-rc-headfull') ? document.getElementById('lite-rc-headfull').textContent : 'missing',
    rcRef: document.getElementById('lite-rc-ref') ? document.getElementById('lite-rc-ref').textContent : 'missing',
    mapDrawn: (function () { const c = document.getElementById('lite-map'); return c ? (c.width > 0 && c.height > 0) : false; })(),
    hudInPanel: (function () { const h = document.getElementById('hud'); return h && h.parentElement ? h.parentElement.id : 'missing'; })(),
    statusInPanel: (function () { const s = document.getElementById('status'); return s && s.parentElement ? s.parentElement.id : 'missing'; })(),
    autotestInPanel: (function () { const a = document.getElementById('autotest'); return a && a.parentElement ? a.parentElement.id : 'missing'; })()
  })`);
}

async function scrollToFraction(f) {
  await evalJs(`(function () { const max = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, Math.round(max * ${f})); return max; })()`);
  await sleep(800);
}

const results = { probe: "lite-probe", demo: DEMO, startedAt: new Date().toISOString(), desktop: {}, phone: {}, defaultTier: {}, autotestLite: {}, consoleErrors: 0, exceptions: [], pass: false };

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

  // Desktop 1280x720, lite tier, progress 0.
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: "file://" + DEMO + "?tier=lite" });
  await sleep(6000);
  results.desktop.p0 = await liteState();
  await screenshot(path.join(EVIDENCE, "lite-desktop-p0.png"));

  // Progress 0.5.
  await scrollToFraction(0.5);
  results.desktop.p50 = await liteState();
  await screenshot(path.join(EVIDENCE, "lite-desktop-p50.png"));

  // Progress 1.0.
  await scrollToFraction(1);
  results.desktop.p100 = await liteState();
  await screenshot(path.join(EVIDENCE, "lite-desktop-p100.png"));

  // VERIFY CHAIN from the HUD panel (button lives in panel 3, clicked via JS).
  await evalJs("document.getElementById('hud-verify-btn').click()");
  await sleep(1200);
  results.desktop.afterVerify = {
    hudChain: await evalJs("document.getElementById('hud-chain').textContent"),
    rcChain: await evalJs("document.getElementById('lite-rc-chain').textContent"),
    verifyOut: await evalJs("document.getElementById('hud-verify-out').textContent"),
  };
  await screenshot(path.join(EVIDENCE, "lite-desktop-p100-verified.png"));

  // Phone 390x844, lite tier.
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp("Page.navigate", { url: "file://" + DEMO + "?tier=lite" });
  await sleep(6000);
  results.phone.p0 = await liteState();
  await screenshot(path.join(EVIDENCE, "lite-phone-p0.png"));
  await scrollToFraction(0.5);
  results.phone.p50 = await liteState();
  await screenshot(path.join(EVIDENCE, "lite-phone-p50.png"));
  await scrollToFraction(1);
  results.phone.p100 = await liteState();
  await screenshot(path.join(EVIDENCE, "lite-phone-p100.png"));

  // Default tier sanity: carousel hidden, no lite activation.
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: "file://" + DEMO });
  await sleep(6000);
  results.defaultTier = {
    liteReady: await evalJs("window.__liteReady === true"),
    carouselDisplay: await evalJs("getComputedStyle(document.getElementById('lite-carousel')).display"),
    hudTick: await evalJs("document.getElementById('hud-tick') ? document.getElementById('hud-tick').textContent : 'missing'"),
    simStatus: await evalJs("document.getElementById('hud-simstatus') ? document.getElementById('hud-simstatus').textContent : 'missing'"),
  };
  await screenshot(path.join(EVIDENCE, "lite-default-tier-check.png"));

  // Lite + autotest: the 8 self-checks must still pass and land in panel 4.
  await cdp("Page.navigate", { url: "file://" + DEMO + "?tier=lite&autotest=1" });
  await sleep(9000);
  results.autotestLite = {
    done: await evalJs("window.__autotestDone === true"),
    pass: await evalJs("window.__autotestPass === true"),
    lines: await evalJs("document.getElementById('autotest') ? document.getElementById('autotest').textContent.split('\\n') : []"),
    autotestInPanel: await evalJs("document.getElementById('autotest').parentElement.id"),
  };
  await scrollToFraction(0.75);
  await screenshot(path.join(EVIDENCE, "lite-autotest.png"));

  results.consoleEntries = consoleEntries;
  results.exceptions = exceptions;
  results.consoleErrors = exceptions.length;
  const d = results.desktop;
  const p = results.phone;
  const near = (v, t) => typeof v === "number" && Math.abs(v - t) < 0.05;
  // Mirror equality is checked on the settled page (p50/p100), not at p0:
  // at p0 the HUD's first live update can land inside the last 250 ms
  // mirror window, so the mirror legitimately lags by one interval tick.
  const mirrorsSettled = (s) => s.ovTick === s.hudTick && s.ovReceipts === s.hudReceipts;
  results.checks = {
    desktopReady: d.p0.liteReady === true,
    desktopP0: near(d.p0.progress, 0) && d.p0.trackTransform === "translateX(0%)" && d.p0.fillTransform === "scaleX(0)" && d.p0.containerTop === 0,
    desktopP50: near(d.p50.progress, 0.5) && d.p50.trackTransform === "translateX(-40%)" && d.p50.fillTransform === "scaleX(0.5)" && d.p50.containerTop === 0,
    desktopP100: near(d.p100.progress, 1) && d.p100.trackTransform === "translateX(-80%)" && d.p100.fillTransform === "scaleX(1)" && d.p100.containerTop === 0,
    desktopMirrorsSettled: mirrorsSettled(d.p50) && mirrorsSettled(d.p100) && d.p100.rcRef === "1d7273a69786b45c50a4a57586d7f8c19598369556b5c13ba96479e158727339",
    desktopMapDrawn: d.p0.mapDrawn === true,
    desktopHudMoved: d.p0.hudInPanel === "lite-panel-hud" && d.p0.statusInPanel === "lite-panel-status" && d.p0.autotestInPanel === "lite-panel-status",
    desktopVerify: results.desktop.afterVerify.hudChain === "VALID" && results.desktop.afterVerify.rcChain === "VALID",
    phoneReady: p.p0.liteReady === true,
    phoneP50: near(p.p50.progress, 0.5) && p.p50.containerTop === 0,
    phoneP100: near(p.p100.progress, 1) && p.p100.trackTransform === "translateX(-80%)" && p.p100.containerTop === 0,
    defaultTierHidden: results.defaultTier.liteReady === false && results.defaultTier.carouselDisplay === "none",
    autotestLitePass: results.autotestLite.done === true && results.autotestLite.pass === true,
    zeroConsoleErrors: exceptions.length === 0,
  };
  results.pass = Object.values(results.checks).every(Boolean);
} catch (e) {
  results.error = String(e && e.message ? e.message : e);
  results.pass = false;
} finally {
  try { if (ws) ws.close(); } catch (e) { /* ignore */ }
  try { if (chrome) chrome.kill("SIGTERM"); } catch (e) { /* ignore */ }
  try { if (xvfb) xvfb.kill("SIGTERM"); } catch (e) { /* ignore */ }
  await sleep(1000);
}

fs.writeFileSync(path.join(EVIDENCE, "lite-probe-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
process.exit(results.pass ? 0 : 1);

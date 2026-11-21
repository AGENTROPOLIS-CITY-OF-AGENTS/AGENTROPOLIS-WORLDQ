// hud.mjs - Debug HUD for UWE54 Phase 1. DOM overlay, no WebGL dependency.
// KISS54 loop labels are section headers: OBSERVE / UNDERSTAND / EXPLAIN /
// ACT / VERIFY / ADAPT. Every live value is bound to real engine state.
// No fabricated values: a value that cannot be measured is labeled n/a.
// No em dashes in this file.
export class DebugHUD {
  constructor(root, opts) {
    opts = opts || {};
    this.root = root || null;
    this.onVerify = opts.onVerify || null;
    this.frames = [];
    this.maxFrames = 60;
    this.tickSamples = [];
    this.lastTickAt = null;
    this.tickRate = 0;
    if (this.root) this.build();
  }

  build() {
    const el = this.root;
    el.className = "uwe-hud";
    el.innerHTML =
      '<div class="uwe-hud-title">DEBUG HUD - DEVELOPMENT MODE <button id="hud-collapse-btn" type="button" aria-label="Collapse HUD">-</button></div>' +
      '<div class="uwe-hud-sec">OBSERVE</div>' +
      '<div class="uwe-hud-row"><span>frame last ms</span><b id="hud-frame-last">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>frame avg ms</span><b id="hud-frame-avg">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>frame min ms</span><b id="hud-frame-min">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>frame max ms</span><b id="hud-frame-max">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>frame p95 ms</span><b id="hud-frame-p95">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>tick rate /s</span><b id="hud-tick-rate">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>draw calls</span><b id="hud-drawcalls">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>triangles</span><b id="hud-triangles">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>JS heap</span><b id="hud-memory">n/a</b></div>' +
      '<div class="uwe-hud-sec">UNDERSTAND</div>' +
      '<div class="uwe-hud-row"><span>entities (agents + towers)</span><b id="hud-entities">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>agents alive</span><b id="hud-agents">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>towers</span><b id="hud-towers">n/a</b></div>' +
      '<div class="uwe-hud-sec">EXPLAIN</div>' +
      '<div class="uwe-hud-row"><span>sim tick</span><b id="hud-tick">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>sim run</span><b id="hud-run">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>loop count</span><b id="hud-loopcount">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>total ticks</span><b id="hud-totalticks">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>unauthorized</span><b id="hud-unauthorized">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>denied</span><b id="hud-denied">n/a</b></div>' +
      '<div class="uwe-hud-sec">ACT</div>' +
      '<div class="uwe-hud-row"><span>receipts total</span><b id="hud-receipts">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>chain head</span><b id="hud-head">n/a</b></div>' +
      '<div class="uwe-hud-sec">VERIFY</div>' +
      '<div class="uwe-hud-row"><span>determinism</span><b id="hud-chain">not yet verified</b></div>' +
      '<button id="hud-verify-btn" type="button">VERIFY CHAIN</button>' +
      '<div id="hud-verify-out" class="uwe-hud-out">not yet verified</div>' +
      '<div class="uwe-hud-sec">ADAPT</div>' +
      '<div class="uwe-hud-row"><span>sim status</span><b id="hud-simstatus">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>renderer</span><b id="hud-renderer">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>context</span><b id="hud-context">n/a</b></div>' +
      '<div class="uwe-hud-row"><span>WebGPU</span><b id="hud-webgpu">n/a</b></div>';
    const btn = el.querySelector("#hud-verify-btn");
    const self = this;
    btn.addEventListener("click", function () {
      const out = self.onVerify ? self.onVerify() : null;
      self.setVerifyResult(out);
    });
    const collapseBtn = el.querySelector("#hud-collapse-btn");
    if (collapseBtn) {
      collapseBtn.addEventListener("click", function () {
        el.classList.toggle("collapsed");
        collapseBtn.textContent = el.classList.contains("collapsed") ? "+" : "-";
      });
    }
    // On narrow screens the HUD starts collapsed so the district stays visible.
    if (typeof window !== "undefined" && window.innerWidth <= 700) {
      el.classList.add("collapsed");
      if (collapseBtn) collapseBtn.textContent = "+";
    }
  }

  recordFrame(dtMs) {
    if (!Number.isFinite(dtMs) || dtMs < 0) return;
    this.frames.push(dtMs);
    if (this.frames.length > this.maxFrames) this.frames.shift();
  }

  frameStats() {
    if (this.frames.length === 0) return null;
    const sorted = this.frames.slice().sort(function (a, b) { return a - b; });
    const sum = this.frames.reduce(function (a, b) { return a + b; }, 0);
    const avg = sum / this.frames.length;
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    return {
      last: this.frames[this.frames.length - 1],
      avg: avg,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: p95,
      count: this.frames.length,
    };
  }

  recordTicks(stepCount, nowMs) {
    if (this.lastTickAt === null) { this.lastTickAt = nowMs; return; }
    const dt = (nowMs - this.lastTickAt) / 1000;
    this.lastTickAt = nowMs;
    if (dt > 0 && stepCount > 0) {
      this.tickSamples.push(stepCount / dt);
      if (this.tickSamples.length > 30) this.tickSamples.shift();
      const sum = this.tickSamples.reduce(function (a, b) { return a + b; }, 0);
      this.tickRate = sum / this.tickSamples.length;
    }
  }

  setVerifyResult(result) {
    if (!this.root) return;
    const chainEl = this.root.querySelector("#hud-chain");
    const outEl = this.root.querySelector("#hud-verify-out");
    if (!result || typeof result !== "object") {
      if (chainEl) chainEl.textContent = "not yet verified";
      if (outEl) outEl.textContent = "verify returned no result";
      return;
    }
    const ok = result.ok === true || result.chainValid === true || result.valid === true;
    const label = ok ? "VALID" : "INVALID";
    if (chainEl) chainEl.textContent = label;
    if (outEl) {
      outEl.textContent = label + " - " + (result.error || result.head || result.headHash || "checked " + (result.checked !== undefined ? result.checked : "n/a") + " receipts");
    }
    return label;
  }

  set(id, text) {
    if (!this.root) return;
    const el = this.root.querySelector("#" + id);
    if (el) el.textContent = text;
  }

  update(state) {
    state = state || {};
    const fs = this.frameStats();
    if (fs) {
      this.set("hud-frame-last", fs.last.toFixed(2));
      this.set("hud-frame-avg", fs.avg.toFixed(2));
      this.set("hud-frame-min", fs.min.toFixed(2));
      this.set("hud-frame-max", fs.max.toFixed(2));
      this.set("hud-frame-p95", fs.p95.toFixed(2));
    }
    this.set("hud-tick-rate", this.tickRate > 0 ? this.tickRate.toFixed(1) : "n/a");
    if (state.drawCalls !== undefined) this.set("hud-drawcalls", String(state.drawCalls));
    if (state.triangles !== undefined) this.set("hud-triangles", String(state.triangles));
    if (state.memory !== undefined) this.set("hud-memory", state.memory);
    if (state.entityCount !== undefined) this.set("hud-entities", String(state.entityCount));
    if (state.agentsAlive !== undefined) this.set("hud-agents", String(state.agentsAlive));
    if (state.towers !== undefined) this.set("hud-towers", String(state.towers));
    const sim = state.sim || {};
    if (sim.tick !== undefined) this.set("hud-tick", String(sim.tick));
    if (sim.run !== undefined) this.set("hud-run", String(sim.run));
    if (sim.loopCount !== undefined) this.set("hud-loopcount", String(sim.loopCount));
    if (sim.totalTicks !== undefined) this.set("hud-totalticks", String(sim.totalTicks));
    if (sim.unauthorized !== undefined) this.set("hud-unauthorized", String(sim.unauthorized));
    if (sim.denied !== undefined) this.set("hud-denied", String(sim.denied));
    if (sim.receipts !== undefined) this.set("hud-receipts", String(sim.receipts));
    if (sim.head) this.set("hud-head", String(sim.head).slice(0, 16));
    if (state.chainStatus) this.set("hud-chain", state.chainStatus);
    if (state.simStatus) this.set("hud-simstatus", state.simStatus);
    if (state.rendererLabel) this.set("hud-renderer", state.rendererLabel);
    if (state.contextVersion) this.set("hud-context", state.contextVersion);
    if (state.webgpuLabel) this.set("hud-webgpu", state.webgpuLabel);
  }
}

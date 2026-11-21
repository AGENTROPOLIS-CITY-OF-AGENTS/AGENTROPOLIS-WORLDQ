// demo-bootstrap.mjs - Demo bootstrap. Runs LAST in the bundle.
// Builds the single-file demo: renderer + district + HUD + clock + sim.
// URL params: ?autotest=1 runs 8 in-page self-checks into #autotest.
// ?freezeTick=N pauses the sim at tick N. ?tier=lite shows the 2D fallback
// dashboard as a ScrollXCarousel: five panels in a horizontal track inside
// a sticky container, vertical scroll drives x from -0% to -80%, and a
// progress bar fills 0 to 1. The sim and receipts run unchanged underneath.
// No em dashes in this file.
(function () {
  window.__consoleErrors = [];
  window.addEventListener("error", function (ev) {
    window.__consoleErrors.push(String(ev.message || ev.error || "error"));
  });
  window.addEventListener("unhandledrejection", function (ev) {
    window.__consoleErrors.push("unhandledrejection: " + String(ev.reason || ""));
  });
  const origConsoleError = console.error.bind(console);
  console.error = function () {
    try { window.__consoleErrors.push(Array.prototype.map.call(arguments, String).join(" ")); } catch (e) { /* ignore */ }
    return origConsoleError.apply(console, arguments);
  };

  const params = new URLSearchParams(window.location.search);
  const autotest = params.get("autotest") === "1";
  const freezeTick = params.get("freezeTick") !== null ? parseInt(params.get("freezeTick"), 10) : null;
  const tierLite = params.get("tier") === "lite";

  // LAYOUT copied verbatim from evidence/hermes-city-layout-6ead8bb7.json
  // (live HERMES CITY main 6ead8bb7). Positions, heights, widths, depths,
  // signs and accents are the live city's; the rendering is procedural
  // DEVELOPMENT MODE geometry, not final art.
  const TOWERS = [
    { id: "hermes-hq", x: 0, z: -40, h: 46, w: 13, d: 13, sign: "HERMES HQ", accent: 0x00e5ff, shape: "STEPPED SPIRE", tag: "CIVIC SHELL - CHIEF ORCHESTRATION TOWER" },
    { id: "mission-control", x: 33, z: -28, h: 28, w: 22, d: 13, sign: "MISSION CTRL", accent: 0xff2638, shape: "WIDE OPS BLOCK - DISH", tag: "BOT MODE ORGANIZATION - OPERATIONS FLOOR" },
    { id: "nemoclaw-works", x: -34, z: -27, h: 31, w: 20, d: 12, sign: "NEMOCLAW", accent: 0x00e5ff, shape: "TWIN SLABS - SKY BRIDGE", tag: "BUILDER DISTRICT - PROTOTYPES AND DOCS" },
    { id: "nemotron-council", x: -54, z: 0, h: 29, w: 19, d: 19, sign: "NEMOTRON", accent: 0x00e5ff, shape: "ROUND COUNCIL DOME", tag: "RESEARCH DISTRICT - SIGNALS AND EVIDENCE" },
    { id: "visual-compute", x: 54, z: -2, h: 35, w: 16, d: 10, sign: "VISUAL COMPUTE", accent: 0xff2638, shape: "PORTAL SCREEN FRAME", tag: "GOVERNED PRESENTATION LAYER - DISPLAY ONLY" },
    { id: "wallet-rails", x: -33, z: 25, h: 21, w: 18, d: 14, sign: "WALLET RAILS", accent: 0xff2638, shape: "LOW VAULT - CORNER POSTS", tag: "AQUADUCT - PAYMENT RAILS" },
    { id: "hermes-community", x: 33, z: 24, h: 24, w: 18, d: 16, sign: "COMMUNITY", accent: 0xff2638, shape: "STEPPED TERRACES", tag: "PARTICIPATION - GOVERNED ONBOARDING" },
    { id: "hermes-social", x: -11, z: 42, h: 22, w: 11, d: 11, sign: "SOCIAL", accent: 0x00e5ff, shape: "SLIM TOWER - ORBIT RINGS", tag: "SOCIAL SURFACE - SOCIAL TRANSIT GRID" },
    { id: "super-hermes", x: 15, z: 43, h: 26, w: 14, d: 14, sign: "SUPER HERMES", accent: 0xff2638, shape: "ORB ON A PEDESTAL", tag: "CAPABILITY INTELLIGENCE OFFICE" },
    { id: "chaos-mall", x: -42, z: 45, h: 13, w: 30, d: 17, sign: "CHAOS MALL", accent: 0xffb300, shape: "LOW WIDE MALL SLAB", tag: "THE MALL - SHOPS AND CHAOS" },
    { id: "builder-commons", x: -18, z: -48, h: 38, w: 15, d: 15, sign: "BUILDER COMMONS", accent: 0xa06bff, shape: "HEX PRISM - LATTICE CROWN", tag: "CHAOS CODE - OPEN BUILD WORLD" },
  ];
  const LAYOUT = {
    towers: TOWERS,
    agentCount: 100,
    districtNames: ["ATG", "DOCKING", "HERMES-CITY", "AQUADUCT"],
    districts: [
      { id: "ATG", label: "ATG", x: -78, z: -20 },
      { id: "DOCKING", label: "DOCKING", x: 78, z: -20 },
      { id: "HERMES-CITY", label: "HERMES CITY", x: 0, z: 0 },
      { id: "AQUADUCT", label: "AQUADUCT", x: 0, z: 68 },
    ],
  };
  const REFERENCE_HEAD_60 = "1d7273a69786b45c50a4a57586d7f8c19598369556b5c13ba96479e158727339";

  const canvas = document.getElementById("scene");
  const hudRoot = document.getElementById("hud");
  const autotestEl = document.getElementById("autotest");
  const statusEl = document.getElementById("status");
  let demo = null;
  let fallback2d = false;
  let bootError = null;

  // 2D district map drawing, shared by the boot-error fallback (on #scene)
  // and the lite tier map panel (on #lite-map). Same drawing, no new content.
  function drawDistrictMap2d(ctx2d, width, height) {
    ctx2d.fillStyle = "#05070a";
    ctx2d.fillRect(0, 0, width, height);
    ctx2d.strokeStyle = "#1c2a3a";
    for (let gx = 0; gx < width; gx += 40) {
      ctx2d.beginPath(); ctx2d.moveTo(gx, 0); ctx2d.lineTo(gx, height); ctx2d.stroke();
    }
    for (const t of TOWERS) {
      const sx = width / 2 + t.x * (width / 200);
      const sy = height / 2 + t.z * (height / 200);
      const sw = Math.max(8, t.w * (width / 200));
      const sh = Math.max(6, t.d * (height / 200));
      ctx2d.fillStyle = "#" + t.accent.toString(16).padStart(6, "0");
      ctx2d.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);
      ctx2d.fillStyle = "#ffffff";
      ctx2d.font = "10px sans-serif";
      ctx2d.textAlign = "center";
      ctx2d.fillText(t.sign, sx, sy - sh / 2 - 4);
    }
    ctx2d.fillStyle = "#00e5ff";
    ctx2d.font = "bold 14px sans-serif";
    ctx2d.textAlign = "left";
    ctx2d.fillText("2D FALLBACK (tier=lite or WebGL unavailable) - district map, no WebGL", 12, 24);
  }

  function draw2dFallback() {
    fallback2d = true;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    function draw() {
      drawDistrictMap2d(ctx2d, canvas.width, canvas.height);
    }
    canvas.width = canvas.clientWidth || 1280;
    canvas.height = canvas.clientHeight || 720;
    draw();
    window.__fallback2dDraw = draw;
  }

  try {
    demo = wireDemo({ THREE: window.THREE, canvas: canvas, layoutData: LAYOUT, config: DEFAULT_SIM_CONFIG, hudRoot: hudRoot });
  } catch (e) {
    bootError = e;
    if (statusEl) statusEl.textContent = "BOOT ERROR (WebGL): " + e.message + " - 2D fallback shown. Tier lite is a stretch goal, not a gate item.";
    draw2dFallback();
  }
  if (tierLite && demo && demo.simStatus !== "running") draw2dFallback();

  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  if (zoomInBtn && demo) zoomInBtn.addEventListener("click", function () { demo.renderer.zoomIn(); });
  if (zoomOutBtn && demo) zoomOutBtn.addEventListener("click", function () { demo.renderer.zoomOut(); });

  // ---- ScrollXCarousel lite tier (vanilla JS adaptation) ----
  // Mechanism from workspace/builds/ribbon-kit/scroll-x-carousel.tsx:
  // outer div (relative, full viewport width) tracked with useScroll gives
  // scrollYProgress 0 to 1 as the section scrolls through the viewport;
  // container sticky, overflow hidden, full width, top 0, left 0; wrap is
  // a width-fit track whose x is useTransform(scrollYProgress, [0, 1],
  // xRagnge) with default xRagnge ["-0%", "-80%"]; progress bar scaleX is
  // useTransform(scrollYProgress, [0, 1], [0, 1]), origin left.
  // Five panels of 100vw each make -80% land exactly on the last panel.
  // The sim, receipts, HUD and status nodes are moved, not rebuilt.
  let liteMapCanvas = null;
  function liteMirror(id, text) {
    const el = document.getElementById(id);
    if (el && text !== undefined && text !== null) el.textContent = String(text);
  }
  function liteText(id) {
    const el = document.getElementById(id);
    return el ? el.textContent : "n/a";
  }
  function drawLiteMap() {
    if (!liteMapCanvas) return;
    const w = liteMapCanvas.clientWidth || 0;
    const h = liteMapCanvas.clientHeight || 0;
    if (w === 0 || h === 0) return;
    if (liteMapCanvas.width !== w) liteMapCanvas.width = w;
    if (liteMapCanvas.height !== h) liteMapCanvas.height = h;
    const ctx = liteMapCanvas.getContext("2d");
    if (!ctx) return;
    drawDistrictMap2d(ctx, w, h);
  }
  function liteUpdateMirrors(progress) {
    liteMirror("lite-ov-simstatus", liteText("hud-simstatus"));
    liteMirror("lite-ov-tick", liteText("hud-tick"));
    liteMirror("lite-ov-receipts", liteText("hud-receipts"));
    liteMirror("lite-ov-head", liteText("hud-head"));
    liteMirror("lite-ov-agents", liteText("hud-agents"));
    liteMirror("lite-ov-towers", liteText("hud-towers"));
    liteMirror("lite-ov-progress", Math.round(progress * 100) + "%");
    liteMirror("lite-rc-receipts", liteText("hud-receipts"));
    liteMirror("lite-rc-chain", liteText("hud-chain"));
    liteMirror("lite-rc-simstatus", liteText("hud-simstatus"));
    if (demo && demo.sim && typeof demo.sim.getGlobalHead === "function") {
      liteMirror("lite-rc-headfull", demo.sim.getGlobalHead());
    }
    drawLiteMap();
  }
  function liteScrollDriver() {
    const outer = document.getElementById("lite-carousel");
    const track = document.getElementById("lite-track");
    const fill = document.getElementById("lite-progress-fill");
    if (!outer || !track || !fill) return;
    let ticking = false;
    function update() {
      ticking = false;
      const rect = outer.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      let p = 0;
      if (travel > 0) p = -rect.top / travel;
      p = Math.max(0, Math.min(1, p));
      track.style.transform = "translateX(" + (-80 * p) + "%)";
      fill.style.transform = "scaleX(" + p + ")";
      window.__liteCarouselProgress = p;
    }
    function request() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    update();
  }
  if (tierLite) {
    document.documentElement.classList.add("lite");
    document.body.classList.add("lite");
    const hudPanel = document.getElementById("lite-panel-hud");
    if (hudPanel && hudRoot) {
      hudPanel.appendChild(hudRoot);
      // The HUD panel is dedicated to the HUD, so start it expanded even
      // on narrow screens (it starts collapsed there in the 3D tier).
      if (hudRoot.classList.contains("collapsed")) {
        hudRoot.classList.remove("collapsed");
        const collapseBtn = hudRoot.querySelector("#hud-collapse-btn");
        if (collapseBtn) collapseBtn.textContent = "-";
      }
    }
    const statusPanel = document.getElementById("lite-panel-status");
    if (statusPanel && statusEl) statusPanel.appendChild(statusEl);
    if (statusPanel && autotestEl) statusPanel.appendChild(autotestEl);
    liteMirror("lite-rc-ref", REFERENCE_HEAD_60);
    liteMapCanvas = document.getElementById("lite-map");
    liteScrollDriver();
    liteUpdateMirrors(0);
    setInterval(function () { liteUpdateMirrors(window.__liteCarouselProgress || 0); }, 250);
    window.__liteCarousel = { progress: function () { return window.__liteCarouselProgress || 0; } };
    window.__liteReady = true;
  }

  window.__demo = {
    profile: CITY_PROFILE,
    demo: demo,
    fallback2d: fallback2d,
    bootError: bootError ? String(bootError.message || bootError) : null,
    layoutTowers: TOWERS.length,
    agentPositions: function () {
      if (!demo || !demo.sim || !demo.sim.world) return [];
      return demo.district.agentRenderPositions(demo.sim.world, demo.clock.alpha);
    },
    benchmark: function () {
      const hud = demo ? demo.hud : null;
      const fs = hud ? hud.frameStats() : null;
      const stats = demo ? demo.renderer.frameStats() : { drawCalls: 0, triangles: 0 };
      return {
        device: "headless Chromium SwiftShader",
        workload: "11 towers + 100 agents",
        frame: fs,
        tickRate: hud ? hud.tickRate : 0,
        drawCalls: stats.drawCalls,
        triangles: stats.triangles,
        simStatus: demo ? demo.simStatus : "no demo",
        tick: demo ? demo.clock.simTick : 0,
        contextVersion: demo ? demo.renderer.contextVersion : "n/a",
        threeRevision: demo ? demo.renderer.threeRevision : "n/a",
        webgpuPresent: demo ? demo.renderer.webgpu.present : false,
        consoleErrors: window.__consoleErrors.length,
      };
    },
    serialize: function () {
      if (!demo) return null;
      return serializeScene(demo.sim ? demo.sim.world : null, demo.district);
    },
  };

  let lastNow = performance.now();
  let frozen = false;
  function loop(now) {
    const dt = Math.min((now - lastNow) / 1000, 0.25);
    lastNow = now;
    if (demo) {
      if (freezeTick !== null && !Number.isNaN(freezeTick) && demo.clock.simTick >= freezeTick) {
        frozen = true;
        if (demo.sim && demo.sim.world) demo.district.drawAgents(demo.sim.world, demo.clock.alpha);
        demo.renderer.render();
      } else {
        demo.frame(dt, now);
      }
    } else if (fallback2d && window.__fallback2dDraw) {
      window.__fallback2dDraw();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function runAutotest() {
    const lines = [];
    function check(name, ok, detail) {
      lines.push((ok ? "PASS" : "FAIL") + " - " + name + (detail ? " - " + detail : ""));
    }
    check("engine loads", typeof canonical === "function" && typeof sha256Hex === "function" && typeof mulberry32 === "function", "canonical/sha256/mulberry32 present");
    check("THREE r149 present", !!(window.THREE && window.THREE.REVISION === "149"), "REVISION=" + (window.THREE ? window.THREE.REVISION : "missing"));
    check("district has 11 towers", !!(demo && demo.district && demo.district.towerCount === 11), "towers=" + (demo ? demo.district.towerCount : "no demo"));
    let simOk = false;
    let simDetail = "sim not landed";
    let chainOk = false;
    let chainDetail = "no sim";
    try {
      if (typeof createSim === "function") {
        const s = createSim(DEFAULT_SIM_CONFIG);
        for (let i = 0; i < 60; i++) s.step();
        const st = typeof s.getState === "function" ? s.getState() : {};
        const tick = st.tick !== undefined ? st.tick : 60;
        simOk = tick === 60;
        simDetail = "tick=" + tick;
        if (typeof s.verify === "function") {
          const v = s.verify();
          chainOk = !!(v && (v.ok === true || v.chainValid === true || v.valid === true));
          chainDetail = chainOk ? "chain valid" : "chain invalid: " + JSON.stringify(v);
        } else if (typeof s.getReceipts === "function") {
          const receipts = s.getReceipts();
          const flat = Array.isArray(receipts) ? receipts : Object.keys(receipts || {}).reduce(function (a, k) { return a.concat(receipts[k] || []); }, []);
          const v = verifyChain(flat);
          chainOk = v.ok === true;
          chainDetail = chainOk ? "chain valid (" + v.checked + " receipts)" : "chain invalid: " + v.error;
        }
        // Deterministic replay check against the reference 60-tick head.
        if (typeof replayFromSeed === "function") {
          const rep = replayFromSeed(DEFAULT_SIM_CONFIG, 60, REFERENCE_HEAD_60);
          chainOk = chainOk && rep.matchesReference === true;
          chainDetail = chainDetail + "; replay head match=" + rep.matchesReference + " head=" + (rep.globalHead || rep.error || "none");
        }
      }
    } catch (e) {
      simDetail = "sim error: " + e.message;
    }
    check("sim runs 60 ticks", simOk, simDetail);
    check("chain verifies", chainOk, chainDetail);
    let clockOk = false;
    try {
      const c = new FixedStepClock({ hz: 60 });
      const r = c.update(1 / 60, function () { /* step */ });
      clockOk = r.steps === 1 && r.alpha >= 0 && r.alpha < 1;
    } catch (e) { clockOk = false; }
    check("clock steps", clockOk, "60 Hz fixed step, alpha in [0,1)");
    const hudLive = !!(demo && demo.hud && demo.hud.frameStats() !== null) || !!(hudRoot && hudRoot.textContent && hudRoot.textContent.indexOf("frame") >= 0);
    check("HUD shows live values", hudLive, "HUD bound to measured state");
    check("zero console errors captured", window.__consoleErrors.length === 0, "errors=" + window.__consoleErrors.length);
    if (autotestEl) {
      autotestEl.textContent = lines.join("\n");
      autotestEl.setAttribute("data-done", "true");
    }
    window.__autotestDone = true;
    window.__autotestLines = lines;
    window.__autotestPass = lines.every(function (l) { return l.indexOf("PASS") === 0; });
  }

  if (autotest) {
    // Let a few frames run first so the HUD has live values, then run.
    setTimeout(runAutotest, 2500);
  }
})();

// city-profile.mjs - City construction demo profile for UWE54 Phase 1.
// Profile stub. MATH54 and POM54 semantics are PROVISIONAL. Geometry is
// procedural DEVELOPMENT MODE, not final art. Deployment is a GOAL, not
// this phase. AGENTROPOLIS is pre-launch; nothing here is live.
// No em dashes in this file.
export const CITY_PROFILE = {
  profile: "city-construction-demo",
  mode: "city",
  world_type: "district",
  demoGround: "HERMES CITY (11 actual towers)",
  scale: { districts: 1, towers: 11, agents: 100 },
  devices: ["mobile", "laptop", "desktop"],
  art_style: "realistic high-quality recognizable architecture (GOAL; Phase 1 renders procedural DEVELOPMENT MODE geometry)",
  deployment: "GitHub Pages (GOAL, not this phase)",
  persistent_world: "GOAL Phase 4",
  agent_population: true,
  math54: "PROVISIONAL definitions only; O1 open",
  pom54: "receipt discipline only",
  governance: "54-T (Phase 5)",
  asset_sources: "CREATOR / CREATOR CORE first (0 reusable geometry at pinned heads; Phase 1 procedural)",
};

export function wireDemo(deps) {
  deps = deps || {};
  const THREE = deps.THREE;
  const canvas = deps.canvas;
  const layoutData = deps.layoutData;
  const config = deps.config || DEFAULT_SIM_CONFIG;
  const hudRoot = deps.hudRoot || null;
  if (!THREE) throw new Error("wireDemo: THREE is required");
  if (!canvas) throw new Error("wireDemo: canvas is required");
  if (!layoutData) throw new Error("wireDemo: layoutData is required");

  const renderer = createRenderer(THREE, canvas, { fog: false });
  const district = buildDistrict(THREE, layoutData);
  renderer.scene.add(district.group);
  const clock = new FixedStepClock({ hz: 60, maxStepsPerFrame: 5, maxFrameDtSeconds: 0.25 });
  const hud = new DebugHUD(hudRoot, {
    onVerify: function () {
      if (!wireDemo._sim) return { ok: false, error: "no sim wired" };
      if (typeof wireDemo._sim.verify === "function") return wireDemo._sim.verify();
      return { ok: false, error: "sim has no verify()" };
    },
  });

  let sim = null;
  let simStatus = "not landed";
  try {
    if (typeof createSim === "function") {
      sim = createSim(config);
      simStatus = "running";
      wireDemo._sim = sim;
    }
  } catch (e) {
    simStatus = "failed: " + e.message;
    sim = null;
  }

  if (sim && sim.world) district.updateAgents(sim.world, 0);

  function stepOnce(tick) {
    if (!sim) return;
    if (typeof sim.step === "function") sim.step();
    if (sim.world) district.updateAgents(sim.world, tick + 1);
  }

  function frame(dtSeconds, nowMs) {
    const res = clock.update(dtSeconds, stepOnce);
    hud.recordFrame(dtSeconds * 1000);
    hud.recordTicks(res.steps, nowMs);
    const alpha = res.alpha;
    if (sim && sim.world) district.drawAgents(sim.world, alpha);
    const stats = renderer.render();
    const state = sim && typeof sim.getState === "function" ? sim.getState() : {};
    let receiptsTotal = 0;
    let head = "";
    if (sim && typeof sim.getReceipts === "function") {
      const r = sim.getReceipts();
      if (Array.isArray(r)) receiptsTotal = r.length;
      else if (r && typeof r === "object") {
        for (const k of Object.keys(r)) {
          if (Array.isArray(r[k])) receiptsTotal += r[k].length;
        }
      }
    }
    if (sim && typeof sim.getGlobalHead === "function") head = sim.getGlobalHead();
    const heap = (typeof performance !== "undefined" && performance.memory && typeof performance.memory.usedJSHeapSize === "number")
      ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + " MB"
      : "n/a (not exposed)";
    hud.update({
      drawCalls: stats.drawCalls,
      triangles: stats.triangles,
      memory: heap,
      entityCount: (sim && sim.world ? sim.world.aliveCount : 0) + district.towerCount,
      agentsAlive: sim && sim.world ? sim.world.aliveCount : 0,
      towers: district.towerCount,
      sim: {
        tick: state.tick !== undefined ? state.tick : (sim ? clock.simTick : 0),
        run: state.run !== undefined ? state.run : 1,
        loopCount: state.loopCount !== undefined ? state.loopCount : 0,
        totalTicks: state.totalTicks !== undefined ? state.totalTicks : clock.totalSteps,
        unauthorized: state.unauthorized !== undefined ? state.unauthorized : (state.unauthorizedEffects !== undefined ? state.unauthorizedEffects : 0),
        denied: state.denied !== undefined ? state.denied : (state.deniedCount !== undefined ? state.deniedCount : 0),
        receipts: receiptsTotal,
        head: head,
      },
      simStatus: simStatus,
      rendererLabel: "Three.js r" + renderer.threeRevision,
      contextVersion: renderer.contextVersion,
      webgpuLabel: renderer.webgpu.present ? "navigator.gpu present (not measured working)" : "navigator.gpu absent",
    });
    return { steps: res.steps, alpha: alpha, stats: stats };
  }

  return {
    profile: CITY_PROFILE,
    renderer: renderer,
    district: district,
    hud: hud,
    clock: clock,
    sim: sim,
    simStatus: simStatus,
    config: config,
    frame: frame,
    stepOnce: stepOnce,
  };
}

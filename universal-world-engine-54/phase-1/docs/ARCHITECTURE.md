# UWE54 Phase 1 Architecture
## Shared engine: ECS, simulation clock, renderer, debug HUD
### 2026-11-08

Status: BUILT. Gates G1-G7 PASS (coordinator-verified). G8 PENDING independent verification (GROKBOT or APEX54; verifier choice open with NEURO). G9 PASS.

## Module map

```
phase-1/
  engine/src/        shared engine package (uwe54-engine 0.1.0)
    canonical.mjs    canonical JSON (key-sorted, no whitespace)
    sha256.mjs       pure-JS sync SHA-256 (Node + browser identical)
    prng.mjs         mulberry32, randInt, randPick
    quantize.mjs     16-level quantize + Stage B-defined risk tiers
    receipts.mjs     ReceiptChain, globalHead, verifyChain
    config.mjs       sim + engine config, validation
    index.mjs        public API (only entry point applications import)
  ecs/src/           entity-component-system
    world.mjs        World: entity ids, spawn/destroy, liveness
    components.mjs   typed-array SoA stores + enums + id helpers
    systems.mjs      ordered SystemRunner
  clock/src/
    clock.mjs        FixedStepClock: 60 Hz, alpha, spiral guard
  simulation/agents/src/  ported 54T Stage B 100-agent sim on the ECS
    population.mjs   buildPopulation, depsEffectivelyAlive, cascadeSize
    state-machine.mjs  7-state containment machine, role/capability rules
    authz.mjs        decideAction, stateHash, deny reasons
    scenarios.mjs    7 breach scripts, lytagateVerdict (test double)
    payrail.mjs      SimulatedPayrail (integer cents, mandate freeze)
    engine.mjs       runSimulation (one-shot) + createSim (steppable)
    verify.mjs       INDEPENDENT verifier (own canonical + hash)
    index.mjs        public sim API
  render/src/
    three-r149.js    vendored Three.js r149 UMD (MIT, unmodified)
    renderer.mjs     createRenderer(THREE, canvas, opts)
    district.mjs     buildDistrict(THREE, layoutData)
    RENDERER-README.md  pin record (r149 + reason)
  debug/src/
    hud.mjs          DebugHUD (KISS54 headers, live profiling)
  scene/src/
    serialize.mjs    JSON scene serialization STUB (PROVISIONAL v0.2.0)
  scene/schemas/     7 PROVISIONAL v0.2.0 schemas, verbatim copies
  replay/src/
    replay.mjs       replayFromSeed (verification only)
  profiles/city/
    city-profile.mjs  city profile stub + wireDemo
    demo-bootstrap.mjs  demo bootstrap (?autotest=1, ?freezeTick=N, ?tier=lite)
    build-demo.mjs   Node build script (deterministic, same SHA on rebuild)
    demo.html        single-file demo (built artifact)
  tests/             shared harness (run-all.mjs + per-area tests + cdp-probe.mjs)
  docs/              this set
```

## Design rules

- No-imports rule: engine, ecs, clock, render, debug, scene, replay, simulation, profiles code imports ONLY via relative paths inside the phase-1 tree. Enforced by tests/no-imports.mjs (G1). The renderer takes THREE as a parameter (UMD global), never as an import. Node-only code lives in tests/ and build scripts (build-*.mjs exempt by design).
- Environment-agnostic core: engine modules use no node: imports, so the same code runs in Node tests and the browser demo. The pure-JS SHA-256 is cross-checked against node:crypto in tests/sha256-test.mjs (8 vectors PASS).
- Single-file demo pattern: the demo is built by inlining three-r149.js as a classic script plus bundling the ES modules into one module script in topological order (imports/exports stripped). The built demo.html opens via file:// with zero runtime network calls (the only URL-like strings are a w3.org namespace literal inside three.js and a PRNG attribution link in a comment). Build is deterministic: rebuilding produces the identical SHA.

## ECS

- Entity ids are small integers 0..99. Agent id strings derive from the index (agent-000..agent-099); sorting by id string equals sorting by index, which the reference sim relies on.
- All agent sim state lives in typed-array SoA (state/riskLevel/riskTier/role/tenant/district/capMask Uint8; balance/spent/spendCap/expiryTick Int32; dependencies/dependents/redundantProviders as sorted Int32Array of entity indices).
- Render-only state (pos/prev Float32 arrays) is owned by the renderer; the sim never reads or writes it, and it never affects receipts.
- Iteration order is ascending index order everywhere; every seeded draw depends on that order.
- The decision context (decideAction) is built as VIEWS over the SoA, not a second copy: capability views with live spent getters/setters, a BalancesView backed by the balance Int32Array, a real seenNonces Set, a real receiptIndex Map.

## Simulation clock

- FixedStepClock: 60 Hz fixed steps, accumulator pattern, alpha in [0,1) for render interpolation (lerp between prev and current render state).
- Spiral-of-death guard: at most 5 steps per frame; excess accumulated time is dropped and counted in droppedTime, never executed late.
- Determinism: the same dt sequence produces the same step counts and sim states (tests/clock-test.mjs). Wall-clock timing is NOT reproducible; step counts for a given dt sequence are.

## Determinism contract (G2)

- Three separate PRNG streams, never merged: population mulberry32(seed); scenarios mulberry32(seed ^ 0x5eed); engine tick loop mulberry32(seed + 10000). No Math.random, no wall clock in sim state.
- Engine rng draw order per run: 5 mandate-agent picks, 1 benign-flag pick, then per tick 4 tasks x (owner pick, capability pick over the sorted cap array, cost 1..20).
- Tick loop order per tick: kill-switch check, tick-5 false alarm, issue tasks, complete due tasks, scenario script, containment pipeline (+2/+4/+6/+8 schedule), PAYRAIL attempts at ticks 20 and 40, records.push.
- Receipts: SHA-256 of canonical JSON of {seq, stream, type, tick, payload, prevHash}; GENESIS prev hash; seq 1-based; global head = SHA-256 of canonical JSON of the three stream heads in fixed order.
- Reference heads reproduced exactly: ON 1d7273a69786b45c50a4a57586d7f8c19598369556b5c13ba96479e158727339 (39 receipts), OFF 9134fdeccd90469124e168c26e35cb9cf5d07e1c481a3afb397d3acf49542518 (17 receipts). See tests/determinism.mjs (49/49 PASS).

## Renderer

- Three.js r149 pinned (vendored UMD, MIT). Reason: the only version VERIFIED inlined in two independent working 3D surfaces (54T city, $XENTS). r169 exists only in the P4 bench copy. HERMES CITY exact REVISION is UNKNOWN beyond its ^0.149.0 pin.
- WebGLRenderer, antialias false, pixel ratio capped at 1, no shadows (SwiftShader baseline). Resize handling updates camera aspect. Reports the actual context version string; WebGPU presence reported as measured (navigator.gpu exists in the probe env; WebGPU is NOT claimed working).
- District: 11 ACTUAL HERMES CITY towers from live main 6ead8bb7 LAYOUT (positions, heights, widths, depths, signs, accents, shapes), rendered as distinct procedural shapes in explicitly labeled DEVELOPMENT MODE. Four district ground markers (ATG, DOCKING, HERMES-CITY, AQUADUCT). Agents: one InstancedMesh of 100 boxes, color by state, render-only positions from mulberry32(54000 + index) plus a per-tick bob that is a pure function of (tick, index); prev/current snapshot per sim step, lerp by clock alpha.
- Camera: drag orbit, wheel zoom, touch pinch, on-screen ZOOM +/- buttons (48px targets).

## Debug HUD

- DOM overlay with KISS54 section headers (OBSERVE / UNDERSTAND / EXPLAIN / ACT / VERIFY / ADAPT). Live values only, bound to real engine state: frame time (rAF delta last/avg/min/max/p95 over rolling 60 frames), measured tick rate, entity count, draw calls, triangles, JS heap (or literal "n/a (not exposed)"), sim tick/run/loopCount/totalTicks/unauthorized/denied, receipts total, chain head (truncated to 16 hex), determinism status. VERIFY CHAIN button runs the independent verifier.

## Reproducibility limits (G6)

Reproducible: seed, ticks, tasks per tick, containment arm, scenario scripts, receipt chains and heads, summary fields, records. NOT reproducible: wall-clock timing, SwiftShader frame pacing, real-device frame times, desktop live tick rate under SwiftShader (spiral guard drops time when frames run ~100 ms). The sim itself is exactly deterministic in Node (60 ticks per run, identical heads across runs).

## What Phase 1 does NOT deliver

Construction runtime, persistence, streaming, GPU compute, physics, audio, asset pipeline, the agent-operated city pipeline, versioned integration interfaces, the ROM RIOT profile, production deployment, payment enforcement, an AEGIS runtime, real 3D geometry. Each is assigned to a later phase. The demo is local only; a Pages deploy needs a separate approval.

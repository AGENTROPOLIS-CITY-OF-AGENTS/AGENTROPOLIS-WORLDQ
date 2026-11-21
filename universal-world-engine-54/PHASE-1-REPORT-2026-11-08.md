# AGENTROPOLIS UNIVERSAL WORLD ENGINE 54
## Phase 1 Report: Shared Engine (ECS, Simulation Clock, Renderer, Debug HUD)
### 2026-11-08

**Ordered by:** NEURO, 16:19 PT Nov 8, 2026 (directive); first-profile decision 16:48 PT Nov 8, 2026
**Authorization:** NEURO approved the Phase 1 plan and authorized starting Phase 1 at 17:23 PT Nov 8, 2026, including every PROPOSED project variable.
**Status:** BUILT. Gates G1-G7 PASS, G9 PASS, G8 PENDING (independent verification not yet done; verifier choice open). Phase 1 does NOT advance to Phase 2 until G8 passes.
**Coordinator:** VERITY
**Workers:** Worker B (sim port, P1.3), Worker C (renderer / HUD / demo, P1.5-P1.7). Foundation (engine core, ECS, clock, harness) built by the coordinator.
**Basis:** Phase 0 census (SHA 7aa10a9ed9c20caa80f3c479426987ee0b435e5a450a557a81cbe49a540f226b), Phase 1 plan (SHA 557051609f3446e205747ba56f74da9fe61324a58bc78a65032425874c302e04).
**Location:** ~/workspace/builds/universal-world-engine-54/phase-1/

**Evidence labels:** VERIFIED, REPORTED, PARTIAL, BLOCKED, NOT VERIFIED, UNKNOWN, PROVISIONAL. Builder evidence stays REPORTED until reproduced. Coordinator re-runs are marked as such. No claim in this report should be read as independent verification: VERITY cannot verify work she co-authored (G8).

---

## 1. What was built

A shared engine package (uwe54-engine 0.1.0) with an ECS, a fixed 60 Hz simulation clock with interpolated rendering, a shared renderer pinned to Three.js r149, a debug HUD with profiling, the ported 54T 100-agent deterministic sim running on the ECS, a city profile stub, and a single-file demo page showing the HERMES CITY district (11 ACTUAL towers) with the 100-agent sim running. Procedural geometry in explicitly labeled DEVELOPMENT MODE throughout; no primitive placeholder is presented as final art. All MATH54/POM54 semantics are PROVISIONAL (O1 open).

Profile (approved): city construction demo. Mode city; genre/function agent-operated city construction demo; world_type district (HERMES CITY, 11 actual towers); scale one district / 11 towers / 100 agents; devices mobile, laptop, desktop; art style realistic high-quality recognizable architecture (GOAL; Phase 1 renders procedural development-mode geometry); deployment GitHub Pages (GOAL, not this phase); persistent_world true (GOAL, Phase 4); agent_population true; math54 true (PROVISIONAL definitions only); pom54 true (receipt discipline only); governance 54-T (Phase 5); asset_sources approved CREATOR / CREATOR CORE first (0 reusable geometry at pinned heads).

## 2. Pinned Three.js version

**Three.js r149.** Vendored UMD at render/src/three-r149.js, 608,148 chars, SHA-256 7f80827f2088d205dde48401007c692e685a5d4c28cfc76778b049214eb781a6, REVISION "149", MIT license header intact, file unmodified (verified before and after the build, and again by the coordinator). Reason: r149 is the only version VERIFIED inlined in two independent working 3D surfaces (54T city SHA 3aa32280..., $XENTS SHA 149dc1bb...). r169 exists only in the P4 bench copy. HERMES CITY's exact REVISION is UNKNOWN beyond its ^0.149.0 pin. Full record: render/src/RENDERER-README.md.

## 3. Gate results

### G1. Shared engine package exists. PASS.

- The package builds standalone: `node tests/run-all.mjs` exits 0 (5/5 test files PASS); `node profiles/city/build-demo.mjs` produces demo.html deterministically (rebuilding yields the identical SHA 0b38ba74...).
- Dependency scan tests/no-imports.mjs PASS: zero imports from outside the phase-1 tree across engine/ecs/clock/render/debug/scene/replay/simulation/profiles. The vendored three-r149.js UMD is skipped by design (it is not an ES module; the renderer takes THREE as a parameter). Node build scripts (build-*.mjs) are exempt by design (they run in Node).
- Evidence: harness output (coordinator re-ran), no-imports.mjs output.

### G2. ECS runs the 100-agent deterministic sim. PASS.

- The ported sim on the ECS reproduces the reference behavior exactly, first try, no fudging:
  - ON arm global head 1d7273a69786b45c50a4a57586d7f8c19598369556b5c13ba96479e158727339 (39 receipts: 13 events, 14 transitions, 12 settlements; unauthorized 0; denied 7; chainValid true).
  - OFF arm global head 9134fdeccd90469124e168c26e35cb9cf5d07e1c481a3afb397d3acf49542518 (17 receipts: 7 events, 0 transitions, 10 settlements; unauthorized 7).
- Coordinator reproduced BOTH reference heads first with her own runs of the original Stage B sim (evidence/reference-on/, evidence/reference-off/), then re-ran the port's tests/determinism.mjs herself: 49/49 checks PASS, exit 0. The test compares both arms against the reference evidence on global head, stream heads, receipt counts, every summary field except runMetadata/artifactHashes, every receipt line (canonical JSON, byte-identical), and every record line; plus repeat-run stability (ON twice, identical), createSim steppable vs one-shot (identical head, receipts, histogram), restart (loopCount 1, totalTicks 120, identical head), kill switch (haltTick 11, latency exactly 1, ticksExecuted 11, restart after halt throws), and tamper tests (mutating events seq 3 fails at exactly seq 3; settlements seq 1 at exactly seq 1).
- One intentional adaptation, documented in simulation/agents/PORT-REPORT-2026-11-08.md: runSimulation returns SoA snapshots with real final balances/spent, while the reference returned stale balance 50000 / spent 0 (it only mutated its separate balances Map and capability spent). Unobservable in receipts, records, and summary; byte-identical receipt lines confirm no hashed evidence changed.
- Evidence: tests/determinism.mjs (49/49), simulation/agents/PORT-REPORT-2026-11-08.md, evidence/reference-on/, evidence/reference-off/.

### G3. Fixed 60 Hz sim clock with interpolated rendering. PASS.

- Sim advances by fixed steps independent of wall clock: tests/clock-test.mjs PASS (120 frames at 1/60 s = exactly 120 steps; same dt sequence twice = same step counts and simTick; alpha in [0,1) across 200 mixed-dt frames; spiral guard caps at 5 steps per frame and counts dropped time).
- Render interpolation verified by frame sampling: the probe sampled 100 agent render positions over 5 samples (400 comparisons); max jump per sample 0.55 units against a 2.0 bound; smooth: true. Coordinator re-run: max jump 0.553. Autotest clock check PASS (60 Hz fixed step, alpha in [0,1)).
- Caveat (measured, not a failure): desktop live tick rate under SwiftShader is 47-50/s (spiral guard drops time at ~100 ms frames); the sim itself is exactly deterministic in Node. See docs/BENCHMARKS.md.
- Evidence: tests/clock-test.mjs, tests/evidence/probe-results.json (interpolation), autotest lines.

### G4. Renderer shows the HERMES CITY district. PASS.

- The 11 ACTUAL towers render in a browser at 1280x720 and 390x844, zero console errors, zero exceptions. Coordinator re-ran tests/cdp-probe.mjs herself (exit 0, pass true, consoleErrors 0, exceptions []), and read both screenshots herself: desktop shows all 11 distinct towers with legible name labels, district markers, agent dots, and the HUD; phone shows the whole district framed with the HUD collapsed to its title bar.
- Procedural geometry is labeled DEVELOPMENT MODE on the page banner ("DEMO - PRE-LAUNCH - SIMULATED - DEVELOPMENT MODE - procedural geometry, not final art"). No primitive placeholder is presented as final art.
- Caveats (cosmetic, not gate-failing): the phone view fits the whole district width and leaves vertical black space above/below; tower labels are small at 390 px; on desktop the HUD panel occludes the right ~25% of the 3D view; the top banner wraps to 3 lines on phone and touches the HUD title bar.
- Evidence: tests/evidence/desktop-1280x720.png, phone-390x844.png, probe-results.json (coordinator re-run 01:45 UTC).

### G5. Debug HUD with profiling. PASS.

- The HUD shows live frame time (rAF delta last/avg/min/max/p95 over rolling 60 frames), measured tick rate, entity count (111), agents alive (100), towers (11), draw calls (90), triangles (4,886), JS heap (9.5 MB), sim tick/run/loopCount/totalTicks/unauthorized/denied, receipts total (39), chain head (truncated to 16 hex), and determinism status, all bound to real engine state. Screenshots confirm live values at both viewports. The VERIFY CHAIN button was clicked live in the demo: determinism went from "not yet verified" to VALID with the reference head.
- Evidence: screenshots (coordinator-read), probe-results.json (hudTick 60, hudDrawCalls 90, hudTriangles 4886), debug/src/hud.mjs.

### G6. Simulations reproducible within documented limits. PASS.

- Same seed produces the identical receipt chain head across runs: ON twice identical; createSim vs runSimulation identical; restart identical head (tests/determinism.mjs 49/49).
- Limits documented in docs/ARCHITECTURE.md: reproducible = seed, ticks, tasks per tick, containment arm, scenario scripts, receipt chains and heads, summary fields, records. NOT reproducible = wall-clock timing, SwiftShader frame pacing, real-device frame times, desktop live tick rate under SwiftShader.
- Evidence: tests/determinism.mjs, docs/ARCHITECTURE.md (Reproducibility limits).

### G7. Mobile and desktop performance measured. PASS.

- Measured with device, workload, and evidence for every number. Device: headless Chromium SwiftShader. Workload: 11 towers + 100 agents. Evidence: tests/evidence/benchmark.json, probe-results.json, screenshots.
- Coordinator re-run (01:45 UTC): desktop 1280x720 frame avg 101.7 ms / p95 166.6 ms, tick rate 49.6/s, 90 draw calls, 4,886 triangles; phone 390x844 frame avg 31.1 ms / p95 66.7 ms, tick rate 60.0/s, 90 draw calls, 4,886 triangles. Worker C's run (01:42 UTC) measured desktop avg 107.8 ms / p95 166.7 ms / tick 47.3/s and phone avg 36.9 ms / p95 83.4 ms / tick 60.0/s. Same order of magnitude; SwiftShader frame pacing varies run to run. Draw calls and triangles agree exactly (deterministic scene properties).
- Budgets recorded from these baselines in docs/BENCHMARKS.md (SwiftShader only): desktop frame p95 <= 200 ms, phone p95 <= 100 ms, draw calls <= 100, triangles <= 6,000, desktop tick rate >= 45/s, phone tick rate >= 55/s, console errors 0. These are probe-environment baselines, not real-device targets. No performance target was promised in advance.
- No real-GPU, real-phone, DPR-2, shadow, texture, GLTF, or WebGPU results exist; none are claimed.
- Evidence: docs/BENCHMARKS.md, tests/evidence/benchmark.json.

### G8. Independent verification. PENDING (not passed, not claimed).

- GROKBOT or APEX54 has NOT independently verified the Phase 1 result. The verifier choice is still open with NEURO.
- VERITY cannot verify work she co-authored. Builder evidence in this report (including the coordinator's own re-runs) is not independent verification.
- Evidence package prepared for the verifier: this report, all source files with SHAs (section 6), the reference evidence, the determinism test, the probe evidence (screenshots, benchmark, console log, probe results), and the worker reports. The verifier's report, when it exists, is the evidence for this gate.
- Phase 1 does NOT advance to Phase 2 until G8 passes.

### G9. No unauthorized side effects. PASS.

- No merge, no deploy, no publish, no spend, no GitHub writes, no credentials, no real money, no live settlement. Local build only. The demo is labeled as a demo and as pre-launch (banner on the page). The ENTITY54 hackathon track was not diverted (separate track; no shared resources claimed).
- Evidence: PHASE-1-RUN-LOG.md (side-effects record), this report.

## 4. Verified, partial, blocked, unimplemented

### VERIFIED (coordinator re-ran or read herself)
- Reference heads ON/OFF reproduced by the coordinator's own runs of the original Stage B sim.
- Port heads ON/OFF reproduced exactly (determinism 49/49, coordinator re-ran).
- Pure-JS SHA-256 vs node:crypto, 8 vectors (sha256-test PASS).
- ECS spawn/iterate/destroy 100 entities, no leaks (ecs-test PASS).
- Clock fixed-step determinism, alpha bounds, spiral guard (clock-test PASS).
- No-imports scan PASS (zero imports outside the phase-1 tree).
- Demo builds deterministically (identical SHA on rebuild: 0b38ba74...).
- Demo probe re-run by the coordinator: pass true, 0 console errors, 0 exceptions, autotest 8/8, chain head matches reference, interpolation smooth, both viewports.
- Both screenshots read by the coordinator herself.
- demo.html has zero runtime network calls (the only URL-like strings are a w3.org namespace literal inside three.js and a PRNG attribution link in a comment).
- three-r149.js unmodified (SHA 7f80827f... before and after).
- No em dashes anywhere in the phase-1 tree (python sweep; 16 files fixed by the coordinator, comments only).

### PARTIAL
- ?tier=lite 2D fallback: implemented but NOT live-tested (WebGL succeeds in the probe env). Stretch goal, not a gate item.
- ?freezeTick=N: stops at the requested tick or up to 5 steps after (coordinator run: exactly 30; Worker C run: 34). One frame's worth of steps can land before the freeze check runs. Documented in docs/CONFIG.md.
- Desktop live tick rate under SwiftShader is 47-50/s, below 60/s (spiral guard drops time). Sim determinism unaffected.
- Phone framing and desktop HUD occlusion are cosmetic (see G4 caveats).
- Performance budgets are SwiftShader baselines only; no real-device budgets exist.

### BLOCKED
- G8 independent verification: blocked on NEURO choosing the verifier (GROKBOT or APEX54) and the verifier producing a report.
- O1 canonical QRAG/QRAR/LOOP/GRAPH definitions: still open. Blocks claiming canonical MATH54/POM54 semantics, not the engine work. Schemas stay PROVISIONAL.

### UNIMPLEMENTED (later phases, per the plan)
- /gpu, /streaming, /physics, /input, /audio, /assets, /world/spatial, /districts, /construction, /persistence, /integrations (except stubs documented as not yet built). Construction runtime, persistence, GPU compute, physics, audio, asset pipeline, agent-operated city pipeline, versioned integration interfaces, ROM RIOT profile, production deployment, payment enforcement, AEGIS runtime, real 3D geometry.

## 5. Harness results

- node tests/run-all.mjs: 5/5 test files PASS (clock-test, determinism, ecs-test, no-imports, sha256-test). Exit 0.
- node tests/cdp-probe.mjs: PASS (coordinator re-run, exit 0). Autotest 8/8 PASS.
- Total Node test checks: clock-test 12, determinism 49, ecs-test 21, sha256-test 8 vectors + canonical checks, no-imports scan over 9 directories.

## 6. File SHAs (SHA-256)

Engine:
- engine/src/canonical.mjs 2aa14c288e4cf09b0c7efa7a9dcc45cd303103088f30be4f9084da3e3561c85a
- engine/src/sha256.mjs 46e0b64cf0a572d92d9e288c80651ac5a088bd416822a041e2195809b708669c
- engine/src/prng.mjs 5420f08a17121eacb2de8835fa2374e63db592cf6f72e5cee93367237633e418
- engine/src/quantize.mjs 78cbb808d037ef29f4d777e12026a9d87cc04563c05a21d91855df47f6236586
- engine/src/receipts.mjs 2cc09d42ed5ebd11ebb77d5fb145dec467ade6c6ca3c2e893f3c70267bb8fb3c
- engine/src/config.mjs 8054e9898e9fd343a83bd678da53937beb3dafa12ce761c8f6a96e99134f2c7f
- engine/src/index.mjs 7f69d3f84cc789769befa5f9ec0895bf8c0b6992070f709e76c178a9fbd49b07
- engine/package.json f193f39be2d940de6abfd0f6ed73657c156f2cd9a59cabc69275b57eda6fcff1

ECS + clock:
- ecs/src/world.mjs 8be11400673f3516aec9bd4531d2b77278e26dbd45f81ec254a18bd549a23b8f
- ecs/src/components.mjs 7acb81e982393e49a006b5b1f6b9a4dd13cdbfb18cb513d58742f53738c33b4b
- ecs/src/systems.mjs b72832104d57ac562259923c1755fe3b22cc63a6bb737a8af9c21ca6e0eaad67
- clock/src/clock.mjs 7c1473698be9dae79be980cb1e1dbcb48a0caeb711660ebe0b14342070610958

Simulation (Worker B):
- simulation/agents/src/population.mjs d69353e82be2e41ea98e5faf2adf0ae27b9cc5a16a7397a7396908ec8b329404
- simulation/agents/src/state-machine.mjs 70560e66b180387ade4c94dcd958638c5aa69139da383cdf8de44e558f7ed4bf
- simulation/agents/src/authz.mjs 7664d6dca419f7bdf813240bc0a7a8ce2109dc2f5edfb77bfe5e4ffaa7791d3b
- simulation/agents/src/scenarios.mjs ccb3dadbdff2be653f7a1b4d83b01b25ebe373ce1a1bb8d45c1d9429c7dade38
- simulation/agents/src/payrail.mjs 4041cc52f153d0067cd6ab050aaa4cbc8bd9efd20c0c3e8061b14e7784ddae10
- simulation/agents/src/engine.mjs 6076e304dbd69fc0e2ff11824bec3f449cac40371966af6818fb244ede4b7d1d
- simulation/agents/src/verify.mjs a32eb2a83331a659564d6ed4d062f73f48dee236f50f46ef7a50b22d2c1007dc
- simulation/agents/src/index.mjs 0c8bb6740acccd621f96a39cdde42f55c90ea8e5578314e660479d8c2283ca7f
- simulation/agents/PORT-REPORT-2026-11-08.md 93eec998778771d4212eb31140a650b8bd2355d6e3274e568d7ca49726af8c02

Render + HUD + demo (Worker C):
- render/src/three-r149.js 7f80827f2088d205dde48401007c692e685a5d4c28cfc76778b049214eb781a6
- render/src/renderer.mjs dccce7b6ab05e4d62b329b71fca9a7f76c1da8a26d7725f494aaffda60b4b590
- render/src/district.mjs a4b8db61056a6e846da4b2088e891c1e8e3dcf49a5c229f9691028dfeb9cd82d
- render/src/RENDERER-README.md ad30734f14485d917187bbdfbd3f06cc95dcedcdb4a6cc4baed8dccebc9aa49b
- debug/src/hud.mjs 7f73f3547324dd00a6cc667511a8c3fed725278dfb787e7668724c3e53a101b4
- scene/src/serialize.mjs aef2e9d5885c606628853a2c6c99991237e3622141d64d30fc30642e00e1a563
- scene/schemas/PROVENANCE.md 65b24bd69ada8fb968f6a88e706fe481598a12c7b820f19c4632fa0995237757
- replay/src/replay.mjs 564d1e71aff309c98d5c3b3cdeb497b3d14045c7b5a4bcd8d92ee6277cb8719a
- profiles/city/city-profile.mjs d290fa3a0d4e2ee6142b8b0965a270b5b893b92173f4de024c7cffb020f0579c
- profiles/city/demo-bootstrap.mjs 47a81b710b44af24f3960ddd6710857b2ef2682963c22943579dbdceef222199
- profiles/city/build-demo.mjs 792ad98375ed9528d4879397c365bb7f726eedef8b052c655989c567407900c0
- profiles/city/demo.html 0b38ba74251e5df192502b115c9e8b3c899db353242e448645117199862a7c86
- profiles/city/BUILD-REPORT-2026-11-08.md fa6fe90dc19f186fc6c0a6684c1d4de62a828fdb8873ce5f61098d5ee77f8bec
- tests/cdp-probe.mjs 51fdf257cd52ab72b5b02c8ad7d47eaf6e743996162df03f28bfa8aaea74c4e5

Tests + docs + evidence:
- tests/determinism.mjs 7ad7d79e104dd6492dc320d874196c209201d0154e196b0c9ad1f3e04dc6c368
- tests/clock-test.mjs feb219205437563a63baab8d5640342778d9ecf51bf366e115146c2e20f6a926
- tests/ecs-test.mjs 702423b498ecc428f7c3b62997d33947706361413304f81878461cfbfd62a3ea
- tests/sha256-test.mjs 204d8026bc1f71e2475fc5f9d253e97b89fcd9039b56dffde60aa016b9b1fb9f
- tests/no-imports.mjs 458fe77ae05302e33e36794aaa8c1abeabd0d7462c17aeac53a47a21cff0e1f3
- tests/run-all.mjs f0f416739d4d505db60f66e25f6f6b091e09f5e51d2d9a7429fa7d882ac53414
- tests/evidence/benchmark.json c725b4ed8fc83ccba310acc69736197b95112208b043f43a4be247e56e3cbd8b
- tests/evidence/probe-results.json b82b502dca4f31c079c9d43e059d967c6fc33232ce4d30f8abd9603fb659a5e8
- tests/evidence/console-log.json 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945
- evidence/hermes-city-layout-6ead8bb7.json c98e2797faaf5f45ef00f75ce5a46d0d70c3bb9c4705d6fee7b71bf21497a9b9
- evidence/reference-on/summary.json b58e42eaee07715bba987619d5630e7e85f61d5be2a0e38228237df1cd9bde2a
- evidence/reference-off/summary.json e39344b9fab513289a4d8069f6683eb2969279a7d67e2d7df54771b99baecbc0
- docs/ARCHITECTURE.md 3dedf7d7b3f9208b5423fe2231bfa3a53c398df93e617ff8c123a584973a6335
- docs/CONFIG.md 7e3b78f7351d955fcc6d0551a28e3c6e7e12a06fe84b84032b7f1001bac1fca9
- docs/BENCHMARKS.md 43aeac8bcb5eaad555d069d6d08e01ecb3b9466fb5ded86612adc24d9c55e0d3
- docs/DEPLOYMENT.md b8cb7d0a09e2ad4df8a8ef2655a4153af865391f9c16e8560e784438d58c399a
- docs/PROVENANCE.md de3a08c84223f45e2b96de5d007774a07648fd9be59fd69a5daaa2e547639509
- PHASE-1-RUN-LOG.md d91cda235833a1f0d200b787b33ea4e094ce9afffaf88d5e26d531c6f8988921

Schema SHAs: see scene/schemas/PROVENANCE.md. Screenshot SHAs: desktop-1280x720.png e3db1cd8bded0ace78be2aeb71088d1657ed3f175c6f29a1f2162b687bf89722, phone-390x844.png 1186a549c94f5587d388c273c8f3394ddd393fdc43ff72561103e1e678d61dbc (coordinator probe re-run).

## 7. Open items

- G8: NEURO to choose the verifier (GROKBOT or APEX54); the verifier's report is the remaining gate evidence. Phase 1 does not advance to Phase 2 until G8 passes.
- O1: canonical QRAG/QRAR/LOOP/GRAPH definitions (blocks canonical MATH54/POM54 semantics at the gate, not the build).
- ?tier=lite 2D fallback: live-test when a WebGL-failure environment is available.
- ?freezeTick overshoot (up to 5 steps): tighten or document as accepted behavior (currently documented).
- Desktop HUD occlusion + phone framing polish: cosmetic, Phase 2 or later.
- Real-device measurements (real GPU, real phone): no such measurements exist; Phase 7 cross-device benchmarks own them.
- No deploy: a GitHub Pages deploy needs NEURO's separate explicit approval.

## 8. Run log

phase-1/PHASE-1-RUN-LOG.md records the build sequence, decisions, worker completions, and the harness correction (build scripts exempted from the node: rule in no-imports.mjs).

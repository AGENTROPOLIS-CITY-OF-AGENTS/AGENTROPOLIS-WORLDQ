# UWE54 Phase 1 Build Report - Renderer / HUD / Demo (P1.5, P1.6, P1.7; gates G4, G5, G7)

Date: 2026-11-08 (build and probe run 2026-11-09 01:40 UTC, 2026-11-08 17:40 PT)
Worker: Worker C (renderer / HUD / demo builder)
Authorization: NEURO approved the Phase 1 plan and authorized starting Phase 1 at 17:23 PT Nov 8, 2026. Local only. No merge, deploy, publish, spend, GitHub writes, credentials, or real money.
Status: BUILT and PROBE-PASSED with the real sim wired in. All target files delivered.

## Pinned Three.js version

**Three.js r149** (`REVISION "149"`), vendored at `render/src/three-r149.js`.
SHA-256: `7f80827f2088d205dde48401007c692e685a5d4c28cfc76778b049214eb781a6`, verified before and after the build (unchanged, file not modified).
Reason: r149 is the only version VERIFIED inlined in two independent working 3D surfaces in this workspace (54T city SHA 3aa32280..., $XENTS SHA 149dc1bb...). r169 exists only in the P4 bench copy. HERMES CITY pins `^0.149.0` but its exact REVISION is UNKNOWN beyond that pin. Full record: `render/src/RENDERER-README.md`.

## What was built

- `render/src/renderer.mjs`: `createRenderer(THREE, canvas, opts)`. WebGLRenderer, antialias false, pixel ratio capped at 1, no shadows, clear color obsidian #05070A. ResizeObserver plus window resize, camera aspect update. Reports the actual context version string. Orbit: drag, wheel zoom, touch pinch, on-screen ZOOM +/- buttons (48px). Stats from `renderer.info.render`.
- `render/src/district.mjs`: `buildDistrict(THREE, layoutData)`. Ground plane plus grid, the 11 ACTUAL HERMES CITY towers from `evidence/hermes-city-layout-6ead8bb7.json` (live main 6ead8bb7) as distinct procedural DEVELOPMENT MODE shapes, each with accent emissive trim and a floating canvas-sprite name label. Four district markers: ATG, DOCKING, HERMES-CITY, AQUADUCT. Agents: one InstancedMesh of 100 small boxes, color by state, render-only positions from `mulberry32(54000 + index)` per agent, per-tick bob as a pure function of (tick, index), prev/current snapshot per sim step, lerp by clock alpha.
- `debug/src/hud.mjs`: `DebugHUD`. DOM overlay, KISS54 section headers (OBSERVE / UNDERSTAND / EXPLAIN / ACT / VERIFY / ADAPT). Live values only: frame time last/avg/min/max/p95 over a rolling 60-frame window, measured tick rate, entity count, draw calls, triangles, JS heap (or the literal string "n/a (not exposed)"), sim tick/run/loopCount/totalTicks/unauthorized/denied, receipts total, chain head truncated to 16 hex chars, determinism status. VERIFY CHAIN button runs the independent verifier.
- `scene/src/serialize.mjs`: serialization STUB only (no save/load). Returns `{schema_version: "0.2.0", status: "PROVISIONAL", towers, agents: {count, stateHistogram}}`.
- `scene/schemas/`: the 7 PROVISIONAL v0.2.0 schemas copied verbatim from the World Engine pilot (`~/workspace/builds/hermes-city-world-engine/schemas/v0.2.0/`), each verified to carry `schema_version` const "0.2.0" and `status` "PROVISIONAL" before copying. SHAs in `scene/schemas/PROVENANCE.md`.
- `replay/src/replay.mjs`: `replayFromSeed(config, ticks, expectedHead)` via `runSimulation`; returns `{globalHead, chainValid, matchesReference}`.
- `profiles/city/city-profile.mjs`: city profile stub plus `wireDemo(deps)` connecting World, sim, clock, renderer, district, HUD.
- `profiles/city/demo-bootstrap.mjs`: demo bootstrap (runs last in the bundle). URL params `?autotest=1`, `?freezeTick=N`, `?tier=lite` (minimal 2D fallback, stretch).
- `profiles/city/build-demo.mjs`: Node build script. Produces `profiles/city/demo.html` (746,002 chars, SHA-256 `0b38ba74251e5df192502b115c9e8b3c899db353242e448645117199862a7c86`) as ONE self-contained file openable via file:// with zero network calls at runtime. Inlines three-r149.js as a classic script, bundles the modules into one module script in topological order with imports/exports stripped.
- `tests/cdp-probe.mjs`: headless-browser probe (Node built-in WebSocket, CDP). See the probe deviation below.

## What renders

Desktop screenshot (1280x720) shows all 11 towers with legible labels, the district grid, 100 agents as cyan dots (agents alive 100, entities 111), HUD live values, and the banner "DEMO - PRE-LAUNCH - SIMULATED - DEVELOPMENT MODE - procedural geometry, not final art". Phone screenshot (390x844) shows the whole district in frame with the HUD collapsed to its title bar (tap + to expand). Sim state after 60 ticks: tick 60, receipts 39, denied 7, unauthorized 0, chain head `1d7273a69786b45c` (full head `1d7273a69786b45c50a4a57586d7f8c19598369556b5c13ba96479e158727339`), matching the reference-on summary exactly.

## Probe results (final run, with the real sim)

Probe: `tests/cdp-probe.mjs`, evidence in `tests/evidence/` (desktop-1280x720.png, phone-390x844.png, autotest-1280x720.png, benchmark.json, console-log.json, probe-results.json).
Overall: PASS. Console errors: 0. Exceptions: 0.

Autotest (`?autotest=1`): 8/8 PASS.
- PASS engine loads; PASS THREE r149 present (REVISION=149); PASS district has 11 towers; PASS sim runs 60 ticks (tick=60); PASS chain verifies (chain valid; replay head match=true, head=1d7273a69786b45c50a4a57586d7f8c19598369556b5c13ba96479e158727339); PASS clock steps; PASS HUD shows live values; PASS zero console errors captured.

Interpolation check (G3): 100 agents sampled over 5 samples (400 comparisons), max jump per sample 0.55 units against a 2.0 bound. Smooth: true.

VERIFY CHAIN button (separate check): clicked in the live demo, HUD determinism changed from "not yet verified" to VALID, output head `1d7273a69786b45c50a4a57586d7f8c19598369556b5c13ba96479e158727339`.

Freeze check: `?freezeTick=30` stopped the sim at tick 34 (overshoot of 4: the clock can step up to 5 fixed steps in one frame before the freeze check runs on the next frame).

Benchmark (all figures SwiftShader, device "headless Chromium SwiftShader", workload "11 towers + 100 agents"):
- Desktop 1280x720: frame avg 107.8 ms, min 83.3 ms, max 250 ms, p95 166.7 ms (rolling 60-frame window); tick rate 47.3/s; draw calls 90; triangles 4,886; context "WebGL 2.0 (OpenGL ES 3.0 Chromium)"; `navigator.gpu` present (presence only, WebGPU NOT claimed working).
- Phone 390x844: frame avg 36.9 ms, min 16.6 ms, max 83.4 ms, p95 83.4 ms; tick rate 60.0/s; draw calls 90; triangles 4,886; same context string.
- Note: desktop frame times are rAF-to-rAF deltas under SwiftShader software rendering and include the spiral-guard time drop; they are NOT real-GPU, real-phone, DPR-2, shadow, texture, or GLTF results. No such results are claimed anywhere.

## Sim integration (Worker B)

Worker B landed during this build. The first probe ran against the sim stub (sim directory existed but was empty): autotest 6/8, the 2 failures honestly reported "sim not landed". The sim then landed as 7 modules (`simulation/agents/src/authz, state-machine, scenarios, payrail, population, verify, engine`). The build was updated to bundle all 7 in topological order and to fix multi-line import stripping (the first real-sim build failed with a SyntaxError from a leftover multi-line import tail; the stripper now drops multi-line imports to the terminating semicolon). API diff: NONE against the briefed contract. `createSim(config)` returns `{world, step(), restart(), getState(), getReceipts(), getGlobalHead(), verify()}` and `runSimulation(config)` returns `{summary, records, receipts, agents, payrail}`; `replayFromSeed` reads `summary.globalHead` and `summary.chainValid`. Verified in Node: `runSimulation(DEFAULT_SIM_CONFIG)` head matches the reference `1d7273a69786b45c50a4a57586d7f8c19598369556b5c13ba96479e158727339`, chainValid true, 39 receipts. No sim files were modified; no sim of my own was written.

## Deviations and notes

1. Probe transport: the brief says headless Chromium with `--headless=new`. Plain `--headless=new` is blocked in this sandbox by the Hatch WebGL domain policy ("Hatch WebGL domain policy is required for browser startup"). The probe instead follows the established workspace pattern from `verity-city-simulation/stage-b/city/cdp-check.mjs` and `verify-city.sh`: headed Chromium under Xvfb with the Hatch WebGL domain flags plus `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, driven over CDP on port 9223. Screenshots are CDP captures, not Xvfb grabs.
2. Em dashes: the foundation modules (engine/ecs/clock) each carry one em dash in a line-1 header comment and must not be rewritten. The build normalizes that character to a hyphen inside the bundle only; sources on disk are untouched. All files written by Worker C contain no em dashes, and demo.html contains none.
3. Phone framing: the initial phone view fits the whole district width, which leaves vertical black space above and below the city (narrow aspect, wide district). The gate (whole district visible at 390x844) is met; the framing is not yet cinematic.
4. `?tier=lite` 2D fallback: implemented (2D district map plus HUD when WebGL fails) but NOT live-tested, because WebGL succeeds in the probe environment. It is a stretch goal, not a gate item.
5. Desktop tick rate 47.3/s is below 60/s under SwiftShader: at ~108 ms per frame the clock's spiral guard (max 5 steps per frame) drops accumulated time. This is a SwiftShader measurement, not a sim defect; the sim itself runs 60 ticks deterministically in Node.
6. The demo's only URL-like strings are in comments (a w3.org namespace string inside three.js and a PRNG attribution link). The page makes zero network calls at runtime.

## File SHAs (SHA-256)

- render/src/three-r149.js: `7f80827f2088d205dde48401007c692e685a5d4c28cfc76778b049214eb781a6`
- render/src/renderer.mjs: `dccce7b6ab05e4d62b329b71fca9a7f76c1da8a26d7725f494aaffda60b4b590`
- render/src/district.mjs: `a4b8db61056a6e846da4b2088e891c1e8e3dcf49a5c229f9691028dfeb9cd82d`
- render/src/RENDERER-README.md: `ad30734f14485d917187bbdfbd3f06cc95dcedcdb4a6cc4baed8dccebc9aa49b`
- debug/src/hud.mjs: `7f73f3547324dd00a6cc667511a8c3fed725278dfb787e7668724c3e53a101b4`
- scene/src/serialize.mjs: `aef2e9d5885c606628853a2c6c99991237e3622141d64d30fc30642e00e1a563`
- replay/src/replay.mjs: `564d1e71aff309c98d5c3b3cdeb497b3d14045c7b5a4bcd8d92ee6277cb8719a`
- profiles/city/city-profile.mjs: `d290fa3a0d4e2ee6142b8b0965a270b5b893b92173f4de024c7cffb020f0579c`
- profiles/city/demo-bootstrap.mjs: `47a81b710b44af24f3960ddd6710857b2ef2682963c22943579dbdceef222199`
- profiles/city/build-demo.mjs: `792ad98375ed9528d4879397c365bb7f726eedef8b052c655989c567407900c0`
- profiles/city/demo.html: `0b38ba74251e5df192502b115c9e8b3c899db353242e448645117199862a7c86`
- tests/cdp-probe.mjs: `51fdf257cd52ab72b5b02c8ad7d47eaf6e743996162df03f28bfa8aaea74c4e5`
- scene/schemas/*.json SHAs: see `scene/schemas/PROVENANCE.md`.

## Unverified

- No real-GPU, real-phone, DPR-2, shadow, texture, GLTF, or WebGPU results (none measured, none claimed).
- `?tier=lite` 2D fallback not live-tested (see note 4).
- The demo has not been opened in a real browser on a real device; all measurements are headless Chromium SwiftShader under Xvfb.

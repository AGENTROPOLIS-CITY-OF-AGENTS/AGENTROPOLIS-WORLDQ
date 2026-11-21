# UWE54 Phase 1 Benchmarks
## Measurement method, results, budgets
### 2026-11-08

## Method

- Probe: tests/cdp-probe.mjs (Node built-in WebSocket + CDP). Headed Chromium under Xvfb with the Hatch WebGL flags plus SwiftShader (plain --headless=new is blocked by the Hatch WebGL domain policy). Demo loaded via file://.
- Frame time is rAF-to-rAF delta (the honest frame-pacing number, per the P4 method), reported as last/avg/min/max/p95 over a rolling 60-frame window. Tick rate is measured sim ticks per second. Draw calls and triangles come from renderer.info.render.
- Every number below carries device, workload, and evidence. SwiftShader figures are labeled SwiftShader. No real-GPU, real-phone, DPR-2, shadow, texture, GLTF, or WebGPU results exist; none are claimed.

## Results (coordinator re-run, 2026-11-09 01:45 UTC)

Device: headless Chromium SwiftShader. Workload: 11 towers + 100 agents. Context: WebGL 2.0 (OpenGL ES 3.0 Chromium). Three.js r149. Console errors: 0. Exceptions: 0. Evidence: tests/evidence/benchmark.json, probe-results.json, desktop-1280x720.png, phone-390x844.png.

| Viewport | Frame avg | Frame min | Frame max | Frame p95 | Tick rate | Draw calls | Triangles |
|---|---|---|---|---|---|---|---|
| Desktop 1280x720 | 101.7 ms | 83.3 ms | 250 ms | 166.6 ms | 49.6/s | 90 | 4,886 |
| Phone 390x844 | 31.1 ms | 16.6 ms | 83.4 ms | 66.7 ms | 60.0/s | 90 | 4,886 |

Worker C's run (01:42 UTC) measured desktop avg 107.8 ms / p95 166.7 ms / tick 47.3/s and phone avg 36.9 ms / p95 83.4 ms / tick 60.0/s. Same order of magnitude; SwiftShader frame pacing varies run to run. Both runs agree on draw calls (90) and triangles (4,886), which are deterministic scene properties.

## Interpolation (G3)

100 agents sampled over 5 samples (400 comparisons): max jump per sample 0.55 units against a 2.0 bound. Smooth: true. Coordinator re-run: max jump 0.553. The per-tick bob is deterministic and interpolatable; no tick-driven jumps.

## Why desktop tick rate is below 60/s

At ~100 ms per frame under SwiftShader, the clock's spiral guard (max 5 steps per frame) drops accumulated time, so the live demo advances ~48-50 sim ticks per wall-clock second on desktop. This is a SwiftShader software-rendering measurement, not a sim defect: the sim itself runs exactly 60 ticks per run deterministically in Node (tests/determinism.mjs 49/49 PASS), and the phone viewport holds 60.0/s. No real-device tick-rate claim is made.

## Phase 1 budgets (baselines, SwiftShader only)

Set from the measured baselines, per the plan. These are budgets for the SwiftShader probe environment, not real-device targets. A later phase sets real-device budgets from real-device measurements.

| Budget | Value |
|---|---|
| Desktop frame p95 | <= 200 ms (SwiftShader) |
| Phone frame p95 | <= 100 ms (SwiftShader) |
| Draw calls | <= 100 |
| Triangles | <= 6,000 |
| Desktop tick rate | >= 45/s (SwiftShader) |
| Phone tick rate | >= 55/s (SwiftShader) |
| Console errors | 0 |
| Agents | 100 alive, 11 towers, 111 entities |

## Limits

- SwiftShader-only. No real integrated-GPU, real-phone, DPR-2, shadow, texture, or GLTF measurement exists.
- Frame times vary run to run under SwiftShader (load-dependent); the p95 budget has headroom for that variance.
- The demo has not been opened in a real browser on a real device.

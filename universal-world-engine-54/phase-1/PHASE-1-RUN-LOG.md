# UWE54 Phase 1 Run Log
## 2026-11-08 (coordinator: VERITY)

Authorization: NEURO approved the Phase 1 plan and authorized starting Phase 1 at 17:23 PT Nov 8, 2026. Plan SHA 557051609f3446e205747ba56f74da9fe61324a58bc78a65032425874c302e04. Census SHA 7aa10a9ed9c20caa80f3c479426987ee0b435e5a450a557a81cbe49a540f226b.

## Decisions recorded
- Three.js pin: r149. Reason: the only version VERIFIED inlined in two independent working 3D surfaces (54T city SHA 3aa32280..., $XENTS SHA 149dc1bb...). r169 exists only in the P4 bench copy. HERMES CITY exact REVISION is UNKNOWN beyond its ^0.149.0 pin. Vendored UMD extracted from the 54T city file: render/src/three-r149.js, 608,148 chars, REVISION "149", MIT license header intact, SHA-256 7f80827f2088d205dde48401007c692e685a5d4c28cfc76778b049214eb781a6.
- Demo ground geometry: LAYOUT + DISTRICTS copied verbatim from live HERMES CITY main 6ead8bb7 (index.html 2,965,756 bytes, SHA edf80c2fd32f910d8789dd7d46d8544fe15af9318ef17d9320fdd8e42810d3a6, fetched from raw.githubusercontent.com). Saved at evidence/hermes-city-layout-6ead8bb7.json (SHA c98e2797faaf5f45ef00f75ce5a46d0d70c3bb9c4705d6fee7b71bf21497a9b9).
- Engine core modules are environment-agnostic pure JS (no node: imports) so the same code runs in Node tests and the browser demo. Pure-JS SHA-256 verified against node:crypto on 8 vectors.

## Reference heads reproduced by the coordinator (own runs, Nov 8)
- ON arm: 1d7273a69786b45c50a4a57586d7f8c19598369556b5c13ba96479e158727339 (39 receipts: 13 events, 14 transitions, 12 settlements; unauthorized 0; denied 7; chainValid true). Evidence: evidence/reference-on/.
- OFF arm: 9134fdeccd90469124e168c26e35cb9cf5d07e1c481a3afb397d3acf49542518 (17 receipts: 7 events, 0 transitions, 10 settlements; unauthorized 7). Evidence: evidence/reference-off/.

## Foundation built by the coordinator (smoke-tested)
- engine/src: canonical.mjs, sha256.mjs, prng.mjs, quantize.mjs, receipts.mjs, config.mjs, index.mjs; engine/package.json (uwe54-engine 0.1.0).
- ecs/src: world.mjs, components.mjs, systems.mjs.
- clock/src: clock.mjs (FixedStepClock, 60 Hz, alpha in [0,1), spiral guard).
- tests: sha256-test.mjs, clock-test.mjs, ecs-test.mjs, no-imports.mjs, run-all.mjs.
- Harness result: 4/4 test files PASS (node tests/run-all.mjs exit 0).

## Workers spawned (parallel)
- Worker B (sim port, P1.3/G2): COMPLETE, coordinator-verified by own re-run. Port reproduces both reference heads exactly, first try: ON 1d7273a69786b45c... (39 receipts), OFF 9134fdeccd904691... (17 receipts). tests/determinism.mjs 49/49 PASS (coordinator re-ran, exit 0; SHAs match Worker B's report). One intentional adaptation documented in simulation/agents/PORT-REPORT-2026-11-08.md: runSimulation returns SoA snapshots with real final balances/spent (reference returned stale 50000/0); unobservable in receipts/records/summary. Kill switch terminal (restart throws). Tamper tests detect at exactly the mutated seq.
- Worker C (renderer/HUD/demo, P1.5/P1.6/P1.7, G4/G5/G7): COMPLETE, coordinator-verified by own probe re-run (exit 0, pass true, 0 console errors, autotest 8/8, chain head matches reference, interpolation max jump 0.553 vs 2.0 bound). Demo.html SHA 0b38ba74... (rebuild-identical). Screenshots read by the coordinator herself. ?tier=lite implemented but NOT live-tested; ?freezeTick stops at N or up to 5 steps after (coordinator run: exactly 30; Worker C run: 34).

## Integration (coordinator)
- Fixed em dashes in 16 foundation/test files (comments only, hyphen replacement); tree now has zero em dashes (python sweep). Demo rebuild after the fix is byte-identical (SHA 0b38ba74...).
- Verified demo.html has zero runtime network calls (only a w3.org namespace literal in three.js and a PRNG attribution link in a comment).
- Docs P1.8 written: docs/ARCHITECTURE.md, CONFIG.md, BENCHMARKS.md, DEPLOYMENT.md, PROVENANCE.md.
- Phase 1 report written: PHASE-1-REPORT-2026-11-08.md.
- Final harness: 5/5 PASS. Final gate tally: G1-G7 PASS, G9 PASS, G8 PENDING (independent verification; verifier choice open with NEURO). Phase 1 does NOT advance to Phase 2 until G8 passes.

## Harness corrections
- no-imports.mjs: build scripts (build-*.mjs) exempted from the node: rule; they run in Node by design. Harness now 5/5 PASS (was 4/5 with the false flag on profiles/city/build-demo.mjs, a Worker C file).

## Still to do (coordinator, after workers return)
- Integration: wire Worker B sim + Worker C demo; run full gate checklist G1-G9.
- Docs (P1.8): ARCHITECTURE.md, CONFIG.md, BENCHMARKS.md, DEPLOYMENT.md, PROVENANCE.md.
- Phase 1 report: PHASE-1-REPORT-2026-11-08.md with per-gate evidence.
- G8: prepare evidence for independent verification (GROKBOT or APEX54); do NOT claim verification.
- Open items carried forward: O1 (canonical QRAG/QRAR/LOOP/GRAPH definitions), verifier choice (GROKBOT vs APEX54).

## Side effects (G9)
- None. No merge, deploy, publish, spend, GitHub writes, credentials, or real money. Local build only.

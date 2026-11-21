# P1.3 Port Report - 54T Stage B 100-Agent Sim on the ECS

Date: 2026-11-08. Worker B (simulation porter), Phase 1 gate G2.
Authorization: NEURO approved the Phase 1 plan and authorized starting Phase 1 at 17:23 PT Nov 8, 2026. Local only, no merge, deploy, publish, spend, GitHub writes, credentials, or real money. AGENTROPOLIS is pre-launch; nothing here is described as live. MATH54/POM54 semantics are labeled PROVISIONAL; the risk tiers below are Stage B-defined, NEVER MATH54 canonical.

## Result: heads reproduced exactly

| Arm | Global head | Receipts |
| --- | --- | --- |
| ON | 1d7273a69786b45c50a4a57586d7f8c19598369556b5c13ba96479e158727339 | 39 (13 events, 14 transitions, 12 settlements) |
| OFF | 9134fdeccd90469124e168c26e35cb9cf5d07e1c481a3afb397d3acf49542518 | 17 (7 events, 0 transitions, 10 settlements) |

Both match the reference evidence in `evidence/reference-on/` and `evidence/reference-off/` exactly.

Test: `node tests/determinism.mjs` exits 0, 49/49 checks PASS. It compares global head, per-stream heads, receipt counts, every summary field except runMetadata/artifactHashes, every receipt line (canonical JSON, byte-identical), and every record line, for both arms. It also checks repeat-run stability (ON run twice, identical heads, receipts, and records), the steppable createSim API against the one-shot run (identical head, receipts, histogram), restart behavior (loopCount 1, totalTicks 120, identical head), the kill switch (haltTick 11, latency exactly 1, ticksExecuted 11, restart after halt throws), and the tamper test (mutating events seq 3 fails at exactly seq 3, checked index 2; mutating settlements seq 1 fails at exactly seq 1). The independent verifier in `verify.mjs` also accepts the reference evidence files themselves.

## What was ported 1:1

- `population.mjs`: same PRNG draw order (role shuffle, per-agent caps, ring plus random edges to 150, 30 redundancy links), same graph rules, same dependency direction (lower id is the dependency), same POM54 direct-dependents-only cascade rule.
- `state-machine.mjs`: TRANSITIONS, ROLE_CAPABILITIES, decideTransition, requestTransition, isContained, isSettleBlocked verbatim in behavior, including G10 distinct-approver/channel rule and deny-before-any-state-change with identical before/after hashes.
- `authz.mjs`: DENY_REASONS, stateHash, decideAction verbatim in behavior.
- `scenarios.mjs`: buildScenarios verbatim (seed ^ 0x5eed stream, capability-aware picks, all 7 scripts, ticks 10-16) and lytagateVerdict as a labeled test double, never a real detector.
- `payrail.mjs`: SimulatedPayrail verbatim (mandate freeze/unfreeze, settle deny when FROZEN or isSettleBlocked, integer cents only, stl-N ids).
- `engine.mjs`: tick loop order, PRNG streams and draw order, kill-switch check at top of tick, tick-5 benign false-alarm, 4 tasks per tick, backwards pending completion, scenario script, containment pipeline (+2/+4/+6/+8), settlement attempts at ticks 20 and 40, records shape, and the full summary shape.
- `verify.mjs`: independent re-implementation with its own canonical JSON and its own pure-JS SHA-256 in the file; it imports no engine canonical/receipts code. It also verifies the reference evidence files, so the verifier is checked against node:crypto-produced hashes, not only against the port's own emitter.

## What was adapted, and why

- Storage is the ECS SoA, not plain agent objects. Agent state, risk, role, tenant, district, capMask, balance, spent, spendCap, expiryTick, and dependency lists live in typed arrays in `ecs/src/components.mjs`. The engine works through agent facades (`population.mjs`): getters/setters that read/write the SoA, with state names converted only at the facade boundary. No sim state is duplicated.
- Decision context is views over the SoA, not a second copy: `buildCapabilitiesMap` returns capability views whose `spent` is a live getter/setter over the SoA spent array and whose `allowedOps` Set is built once from capMask; `BalancesView` (in `engine.mjs`) is a Map-like backed by the SoA balance array. Spend and balance mutations go through the SoA, so views always agree.
- Hashing uses the shared engine pure-JS SHA-256 plus canonical JSON instead of node:crypto, so the same code runs in Node and the browser demo. Hash outputs are identical (same canonical bytes, same SHA-256), which the byte-identical receipt lines prove.
- `verifyAllIndependent` iterates the fixed STREAMS order (events, transitions, settlements) instead of `Object.keys(streams)`. The order is the same for the engine's streams object, and the global head is defined over that fixed order.
- `runSimulation` returns `agents` as plain end-of-run snapshots read from the SoA. One value differs from the reference return by design: the reference agent objects kept `balance` (50000) and `spent` (0) stale, because the reference only ever mutated its separate balances Map and capability `spent`. The port stores balance/spent in the SoA as the single source of truth, so snapshots show the real final balances and spend. This is unobservable in receipts, records, and summary (nothing in the reference reads `agent.balance` or `agent.spent` after init), and the byte-identical receipt lines confirm it changes no hashed evidence.
- `runSimulation` defaults a missing seed to 54 and otherwise follows the reference config semantics (`containmentOn === true`, ticks default 60, tasksPerTick default 4, killSwitchTick default null).
- `createSim` is the new steppable API. It shares the single internal tick function with `runSimulation`, so the two can never drift. `step()` advances exactly one fixed tick and returns `{ tick, done, halted }`, where tick is the tick index just processed (or the halt tick when the kill switch fires first). `restart()` rebuilds from seed 54 with fresh chains from GENESIS and increments loopCount; loopCount and totalTicks persist across restarts; a halted sim can never restart (restart throws). `getState()` reports tick and runTick as the ticks executed in the current loop (equal values), plus loopCount, totalTicks, halted, counters, receiptsTotal, globalHead, and stateHistogram.

## Files

- `simulation/agents/src/population.mjs` (261 lines)
- `simulation/agents/src/state-machine.mjs` (157 lines)
- `simulation/agents/src/authz.mjs` (84 lines)
- `simulation/agents/src/scenarios.mjs` (165 lines)
- `simulation/agents/src/payrail.mjs` (97 lines)
- `simulation/agents/src/engine.mjs` (622 lines)
- `simulation/agents/src/verify.mjs` (175 lines)
- `simulation/agents/src/index.mjs` (47 lines)
- `tests/determinism.mjs` (219 lines)

File SHA-256 (after final edit):

- authz.mjs 7664d6dca419f7bdf813240bc0a7a8ce2109dc2f5edfb77bfe5e4ffaa7791d3b
- engine.mjs 6076e304dbd69fc0e2ff11824bec3f449cac40371966af6818fb244ede4b7d1d
- index.mjs 0c8bb6740acccd621f96a39cdde42f55c90ea8e5578314e660479d8c2283ca7f
- payrail.mjs 4041cc52f153d0067cd6ab050aaa4cbc8bd9efd20c0c3e8061b14e7784ddae10
- population.mjs d69353e82be2e41ea98e5faf2adf0ae27b9cc5a16a7397a7396908ec8b329404
- scenarios.mjs ccb3dadbdff2be653f7a1b4d83b01b25ebe373ce1a1bb8d45c1d9429c7dade38
- state-machine.mjs 70560e66b180387ade4c94dcd958638c5aa69139da383cdf8de44e558f7ed4bf
- verify.mjs a32eb2a83331a659564d6ed4d062f73f48dee236f50f46ef7a50b22d2c1007dc
- determinism.mjs 7ad7d79e104dd6492dc320d874196c209201d0154e196b0c9ad1f3e04dc6c368

No em dashes in any file written by this task (checked with grep). No node: imports in `simulation/agents/src/` (only relative imports inside the phase-1 tree).

## Unverified / open items

- Live Hermes, Telegram, Linear, CI, and any production behavior were not tested. This port is local-only deterministic simulation evidence.
- `tests/run-all.mjs` reports 4/5 test files PASS. The one failure is `tests/no-imports.mjs`, which flags only `profiles/city/build-demo.mjs` (node: imports in non-test code). That file is outside this task's scope and was not written or touched by this worker; none of the P1.3 files appear in the violation list.
- The reference `config.json` / `config.schema.json` live at the stage-b root, not under `stage-b/src/` as the brief stated; the port read them from the root. Behavior matches the engine config already in the phase-1 tree.

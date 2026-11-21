# UWE54 Phase 1 Configuration
## Schemas, values, units, defaults, limits
### 2026-11-08

## Simulation config (54T Stage B, configId verity-city-100agent-v01)

| Key | Type | Value / default | Units / limits |
|---|---|---|---|
| configId | string, const | "verity-city-100agent-v01" | must match exactly |
| seed | integer | 54 | minimum 0; one seed per run |
| ticks | integer | 60 | 1..10000; a run is 60 ticks |
| tasksPerTick | integer | 4 | 1..64; 240 tasks per 60-tick run |
| nAgents | integer, const | 100 | fixed; the schema rejects 1000 |
| containmentOn | boolean | true | ON arm vs OFF arm |
| mode | string, const | "adversarial" | only mode supported |
| scenario | string, const | "single_agent" | only scenario supported |
| killSwitchTick | integer or null | null | minimum 0; STOP at end of tick K halts before tick K+1 (latency exactly 1) |
| productionMutationsAllowed | boolean, const | false | must be false; production mutation is never allowed |

Validation: engine/src/config.mjs validateSimConfig (minimal JSON Schema subset: type, const, minimum, maximum, required, additionalProperties). Invalid config exits before any sim state is built.

## Engine config

| Key | Value | Units / limits |
|---|---|---|
| simHz | 60 | fixed simulation steps per second |
| maxAgents | 100 | ECS entity capacity |
| maxStepsPerFrame | 5 | spiral-of-death guard; excess time dropped and counted |
| maxFrameDtSeconds | 0.25 | clamp on real dt fed to the clock |

## Demo URL parameters

| Parameter | Effect |
|---|---|
| ?autotest=1 | Runs 8 in-page self-checks; results written into the #autotest DOM node |
| ?freezeTick=N | Pauses the sim at tick N (stops at N or up to 5 steps after: one frame's worth of steps can land before the freeze check runs) |
| ?tier=lite | Minimal 2D fallback when WebGL fails (STRETCH, not live-tested; WebGL succeeds in the probe env) |

## Quantization and risk tiers (Stage B-defined, NOT MATH54)

- 16-level quantization: level = clamp(floor(score * 16), 0, 15); quantized score = level / 15. The ONLY quantization mechanism in Stage B.
- Risk tiers: levels 0-3 LOW, 4-7 GUARDED, 8-11 ELEVATED, 12-15 CRITICAL. Stage B implementation choices. MATH54 canonical tiers do not exist in any located source. Never present these tiers as MATH54 canonical.
- False-positive bound per run: at most 2 benign agents escalated to SUSPECT, ZERO benign agents may reach QUARANTINED (Stage B threshold, not a spec threshold).

## Receipt chain rules

- Receipt: {seq, stream, type, tick, payload, prevHash, hash}. hash = SHA-256 hex of canonical JSON of {seq, stream, type, tick, payload, prevHash}. seq 1-based; prevHash "GENESIS" for seq 1.
- Streams in fixed order: events, transitions, settlements. Global head = SHA-256 of canonical JSON of the three stream heads in that order.
- Money is integer cents everywhere. A float in a receipt payload is a bug.

## Scene serialization (PROVISIONAL v0.2.0 stub)

- serializeScene returns {schema_version: "0.2.0", status: "PROVISIONAL", mode: "development", geometry: "procedural", towers, agents: {count, stateHistogram}}. No save/load yet (Phase 3/4).
- The 7 schemas in scene/schemas/ are PROVISIONAL v0.2.0, copied verbatim from the World Engine pilot. They stay PROVISIONAL until O1 (canonical QRAG/QRAR/LOOP/GRAPH definitions) is decided.

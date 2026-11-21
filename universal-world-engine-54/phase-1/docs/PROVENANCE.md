# UWE54 Phase 1 Provenance
## Every source, asset, and reference, with SHAs
### 2026-11-08

## Engine sources built in Phase 1

All under ~/workspace/builds/universal-world-engine-54/phase-1/. SHAs recorded in the Phase 1 report (PHASE-1-REPORT-2026-11-08.md). License for Phase 1 engine code: MIT (engine/package.json).

## Vendored third-party code

| Item | Source | SHA-256 | License / note |
|---|---|---|---|
| Three.js r149 UMD | Extracted verbatim from 54T Stage B city file (~/workspace/builds/verity-city-simulation/stage-b/city/verity-city-100agent.html, SHA 3aa32280...), which vendors it from the ENTITY54 3D demo blob | 7f80827f2088d205dde48401007c692e685a5d4c28cfc76778b049214eb781a6 | MIT (license header intact in file). REVISION "149" verified. File unmodified during Phase 1. |
| mulberry32 PRNG | Public-domain seeded PRNG (bryc/code PRNGs); ported from 54T Stage B src/prng.mjs | n/a (ported code) | Public domain per the Stage B attribution. |

## Reference implementations ported (behavior preserved)

| Item | Source | Reference evidence |
|---|---|---|
| 54T Stage B sim (12 src files) | ~/workspace/builds/verity-city-simulation/stage-b/src/ | Reference heads reproduced exactly: ON 1d7273a69786b45c..., OFF 9134fdeccd904691... Evidence: phase-1/evidence/reference-on/ and reference-off/ (coordinator re-ran both arms Nov 8). |
| Receipt-chain discipline | POM54 local build (APEX54 PASS 7A, 5 chains, 148 receipts); 54T Stage B; $XENTS (27 receipts, head 47d61149...) | Census 1.4, 1.5, 1.6. |
| KISS54 loop (HUD pattern) | wiredchaos/AGENTROPOLIS-ASDS main 1653c31a (kiss54Navigator.ts, constructionAdapter.ts) | Census 1.4. The loop shapes HUD labels only; KISS54 does NOT grant permissions. |
| Schemas v0.2.0 (PROVISIONAL) | World Engine pilot ~/workspace/builds/hermes-city-world-engine/schemas/v0.2.0/ (7 schemas) | Copied verbatim into scene/schemas/; each verified schema_version 0.2.0 + status PROVISIONAL. SHAs in scene/schemas/PROVENANCE.md. |
| Reference index (seed catalog) | World Engine pilot reference-index.json (28 entries, 9 categories) | Census 1.1. |

## Demo ground geometry

| Item | Source | SHA-256 |
|---|---|---|
| HERMES CITY LAYOUT + DISTRICTS (11 actual towers) | AGENTROPOLIS-CITY-OF-AGENTS/HERMES-CITY index.html at main 6ead8bb721206745284efea48df555e8eceb5ab6, fetched from raw.githubusercontent.com Nov 8 | edf80c2fd32f910d8789dd7d46d8544fe15af9318ef17d9320fdd8e42810d3a6 (2,965,756 bytes). Extracted copy: phase-1/evidence/hermes-city-layout-6ead8bb7.json (SHA c98e2797faaf5f45ef00f75ce5a46d0d70c3bb9c4705d6fee7b71bf21497a9b9). |

## Asset provenance

- Real 3D geometry at CREATOR / CREATOR-CORE pinned heads: 0 (census VERIFIED). Real NVIDIA assets: 0. No GLB/glTF/FBX/OBJ/USD file is used in Phase 1.
- All Phase 1 geometry is procedural, generated in code from the LAYOUT numbers above, in explicitly labeled DEVELOPMENT MODE. Nothing is presented as final art.
- CREATOR canonical-owner question (Q7) and CREATOR-CORE license question (Q8) remain open; they gate Phase 4 asset reuse, not Phase 1.

## PROVISIONAL labels (O1 open)

- Schemas v0.2.0: PROVISIONAL until O1 (canonical QRAG/QRAR/LOOP/GRAPH definitions) is decided.
- Risk tiers and 16-level quantization: Stage B-defined, NOT MATH54 canonical.
- The demo's MATH54/POM54 semantics are PROVISIONAL throughout. No canonical MATH54/POM54 claim is made in Phase 1.

# Universal World Engine 54 (Phase 1) recovery — provenance and limits

Recovered 2026-11-20 from local builder tree `~/workspace/builds/universal-world-engine-54/` (no .git). Originals untouched; this is a copy.
Candidate destination: AGENTROPOLIS-CITY-OF-AGENTS/AGENTROPOLIS-WORLDQ, branch `recovery/universal-world-engine-54-20261120`, from main `64b760bb`. Draft PR only. No merge, no deploy.
Repo path: `universal-world-engine-54/` (new top-level directory; no collision with existing WORLDQ main files — 'universal-world-engine' has zero hits in the repo by code search).

## Included
Phase 0 census, Phase 1 plan + report, phase-1/ engine (ECS, 60 Hz clock, renderer pinned Three.js r149, debug HUD, 100-agent sim port, city demo). All text files; see manifest.

## Excluded (local only, binary)
13 PNGs (frames, diagrams) — connector cannot push binaries; listed below with SHA-256.

## Excluded PNGs (SHA-256)
78bf81fde9535dd452dbeea181b548785cf05a124ecafcd61851d2276a0b8e76  ./phase-1/tests/evidence/autotest-1280x720.png
e3db1cd8bded0ace78be2aeb71088d1657ed3f175c6f29a1f2162b687bf89722  ./phase-1/tests/evidence/desktop-1280x720.png
41abc0ccbb431b247f9d6b318574aa507ee23d417ce133506a1e4feb3bdd9b42  ./phase-1/tests/evidence/lite-autotest.png
b231ae2f962d291db0498a20319ac3e41c8d8de88263c91bdce3f82e93c3e9cd  ./phase-1/tests/evidence/lite-default-tier-check.png
4f80147b4eb210d661ad51bca110b3ddf7a0b239f662669f1964b1492cf8a2f3  ./phase-1/tests/evidence/lite-desktop-p0.png
8b4dd7fbbbbad9b13694776666783cac914286ea8b6c28f4ba3076bb7ce5d195  ./phase-1/tests/evidence/lite-desktop-p100-verified.png
ff4742fe2e386266fcc9e4c83752fd493a8c20e6d09fd25a5a19bbb6874f7756  ./phase-1/tests/evidence/lite-desktop-p100.png
f40a838b11077c0b1d9133d784a6a109a72b5d3e62491aa494a52de440f18e23  ./phase-1/tests/evidence/lite-desktop-p25.png
ae669426da1c3443574a753f9ad8e6dac220470ac8e81d32a416cb50818f7e89  ./phase-1/tests/evidence/lite-desktop-p50.png
f80e332dc99fce9262084d170e8073e8b084adc446a0c196b17e67d9f541c455  ./phase-1/tests/evidence/lite-phone-p0.png
30804b2c72b41c8a2e9df9722f3c99d4a59e21d70970c90ba6dcfef2ddf78a1d  ./phase-1/tests/evidence/lite-phone-p100.png
d83e55a248d9939e969ecf298ed8dc4045db91bee1ee8f2b080392e3260e8652  ./phase-1/tests/evidence/lite-phone-p50.png
1186a549c94f5587d388c273c8f3394ddd393fdc43ff72561103e1e678d61dbc  ./phase-1/tests/evidence/phone-390x844.png

## Tests (per Phase 1 report, builder evidence; coordinator did not re-run in this pass)
`node tests/run-all.mjs` in phase-1/ — 5/5 test files PASS; determinism checks 49/49 PASS; demo rebuild byte-identical (SHA 0b38ba74...).
Gates G1-G7 PASS, G9 PASS, G8 PENDING (independent verification not yet done; verifier choice open). Phase 1 does NOT advance to Phase 2 until G8 passes.

## Dependencies
Node >= 24, zero external dependencies (engine); Three.js r149 VENDORED at render/src/three-r149.js (608,148 chars, MIT header intact, unmodified).

## Known limitations
- All MATH54/POM54 semantics PROVISIONAL (O1 open); procedural geometry is explicitly DEVELOPMENT MODE, not final art.
- Receipt counts in evidence are stored data until independently checked.
- worldq-transit/ (destination registry + prototype) is a SEPARATE local bundle, not included here.

## Status
RECOVERED_LOCAL staged for push. Draft PR only. Independent verification (G8) still owed.

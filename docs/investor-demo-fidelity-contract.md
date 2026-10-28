# WORLDQ investor-demo fidelity contract

WORLDQ is the existing quantized world transport and reconstruction runtime, not a replacement for AGENTROPOLIS-WORLD.

## Progressive detail
Q0 manifest and entry; Q1 districts; Q2 buildings; Q3 interiors; Q4 objects and citizens; Q5 local high fidelity.

## Required client behavior
- Start Q0-Q2 immediately; request Q3-Q5 only near viewer or relevant active agent.
- Quality profiles FULL, ADAPTIVE, LITE, MINIMUM selected from measured device capabilities, not device branding.
- Deterministic generator version/seed and asset hashes recorded for reconstruction.
- glTF/GLB geometry validated independently of printability or structural safety.
- Preserve world state and stable identifiers when switching fidelity levels.
- Provide graceful WebGL fallback if WebGPU unavailable.
- Do not stream private credentials, internal agent state, or privileged execution endpoints.

## Benchmark fixtures
Use existing SHIELD Relay Beacon and Vault Canister GLB test cases for visual fidelity and mesh validation regression. Their successful glTF checks do not establish watertight or printable meshes.

## Release evidence
Record Q-level transitions, cold-start time, FPS, peak memory, asset transfer bytes, reconstruction errors, mobile fallback behavior, and provenance receipts. Do not assert unmeasured targets were met.

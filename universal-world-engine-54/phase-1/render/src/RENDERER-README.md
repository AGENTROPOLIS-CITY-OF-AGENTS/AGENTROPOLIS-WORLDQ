// RENDERER-README.md - UWE54 Phase 1 renderer pin record.
// No em dashes in this file.

# Renderer pin: Three.js r149

Pinned version: **Three.js r149** (UMD three.min.js, `REVISION "149"`).

Vendored file: `render/src/three-r149.js` (608,148 chars, MIT license header
intact). SHA-256: `7f80827f2088d205dde48401007c692e685a5d4c28cfc76778b049214eb781a6`.
Do not modify this file. Verify its SHA before and after any build.

## Why r149

r149 is the only version VERIFIED inlined in two independent working 3D
surfaces in this workspace:

- 54T city, SHA 3aa32280...
- $XENTS, SHA 149dc1bb...

r169 exists only in the P4 bench copy and is not verified as a demo surface.
HERMES CITY pins `^0.149.0` but its exact REVISION is UNKNOWN beyond that
pin, so it cannot ground a pin decision.

## How the renderer uses it

`three-r149.js` is a CLASSIC script that sets the global `THREE`. It is not
an ES module. `render/src/renderer.mjs` takes THREE as a parameter:
`createRenderer(THREE, canvas, opts)`. It never imports three.

Renderer settings (SwiftShader baseline): antialias false, pixel ratio
capped at 1, no shadows, clear color obsidian #05070A. WebGL2 is reported
from the actual context version string; if WebGL2 is unavailable the
renderer reports that and does not claim it. WebGPU is probed only as
`navigator.gpu` presence; it is never claimed working until measured working.

## District geometry

`render/src/district.mjs` builds the 11 ACTUAL HERMES CITY towers from
`evidence/hermes-city-layout-6ead8bb7.json` (live HERMES CITY main 6ead8bb7)
as procedural DEVELOPMENT MODE geometry. Positions, heights, widths, depths,
signs and accents are the live city's. The rendering is not final art.
Census fact: 0 reusable geometry at CREATOR / CREATOR-CORE pinned heads.

MATH54 and POM54 semantics are PROVISIONAL. AGENTROPOLIS is pre-launch;
nothing in this demo is live.

# Spatial Genesis: open-source integration registry (proposal)

Status: CANDIDATE / RESEARCH ONLY. This change documents adapters and tests; it does not install packages, enable sensors, deploy services, grant location claims or authorize payments.

## Canonical ownership (verified against repository READMEs)
- WORLDQ: quantized world packaging, Q0-Q5 progressive streaming, reconstruction, agent operations and receipts. **Not** the sole 3D authoring engine.
- Parallax Spatial MCP: separate spatial interaction and construction runtime; integrate via MCP/WebMCP, do not merge.
- WORLDQ-ASTRA: React/Three.js mission-control and spatial observability shell, with demo events when disconnected.
- WORLDQ-ASTRA-GATEWAY: mission execution and SSE events, not a room scanning or sensor backend. Keep API credentials server-side.
- GENESIS CLAIM: proposed location-to-digital-space relationship and authorization protocol. No physical title or entry rights inferred.
- 54-T: gate capture, sharing, agent access, sensing and execution.
- RuView: optional research-stage CSI sensing, not a geometry/identity/ownership oracle.
- VisionClaw: ambiguous upstream; candidate Intent-Lab/VisionClaw; internal wiredchaos/ww3monitor VisionClaw page exists. Confirm intended implementation.

## Open-source candidate vault
| Domain | Primary | Alternatives | Gate |
|---|---|---|---|
| Photogrammetry | https://github.com/colmap/colmap | https://github.com/alicevision/Meshroom ; https://github.com/openMVG/openMVG ; https://github.com/cdcseacave/openMVS | benchmark |
| Geometry | https://github.com/isl-org/Open3D | https://github.com/introlab/rtabmap | benchmark |
| Splats | https://github.com/nerfstudio-project/nerfstudio ; https://github.com/nerfstudio-project/gsplat | https://github.com/graphdeco-inria/gaussian-splatting ; https://github.com/mkkellogg/GaussianSplats3D ; https://github.com/playcanvas/supersplat ; https://github.com/pierotofy/OpenSplat | license/model review |
| Authoring | https://github.com/blender/blender | https://github.com/ahujasid/blender-mcp | sandbox agent tools |
| Assets | https://github.com/microsoft/TRELLIS | https://github.com/Tencent/Hunyuan3D-2 ; https://github.com/Stability-AI/stable-fast-3d | weights/license/GPU |
| Visual understanding | https://github.com/opencv/opencv | https://github.com/facebookresearch/sam2 ; https://github.com/IDEA-Research/GroundingDINO ; https://github.com/google-ai-edge/mediapipe | consent |
| Browser 3D | https://github.com/mrdoob/three.js ; https://github.com/pmndrs/react-three-fiber | https://github.com/BabylonJS/Babylon.js ; https://github.com/aframevr/aframe | device QA |
| Mobile AR | https://github.com/google/model-viewer | https://github.com/pmndrs/xr ; https://github.com/KhronosGroup/OpenXR-SDK | iOS/Android compatibility |
| Formats | https://github.com/KhronosGroup/glTF | https://github.com/PixarAnimationStudios/OpenUSD | conversion fidelity |
| Geospatial | https://github.com/postgis/postgis ; https://github.com/h3geo/h3 | https://github.com/CesiumGS/cesium ; https://github.com/maplibre/maplibre-gl-js ; https://github.com/OSGeo/gdal | claim semantics |
| Collaboration/events | https://github.com/yjs/yjs ; https://github.com/nats-io/nats-server | https://github.com/eclipse-zenoh/zenoh ; https://github.com/temporalio/temporal | authenticated channels |
| Sensing | https://github.com/ruvnet/RuView | https://github.com/Intent-Lab/VisionClaw | simulation-only |
| Policy/security | https://github.com/open-policy-agent/opa ; https://github.com/sigstore/cosign ; https://github.com/aquasecurity/trivy | existing 54-T controls | review |

## Proposed integration flow
Authorized physical room -> phone images/video/depth -> camera calibration and geometry reconstruction -> optional splat appearance -> Blender/Parallax scene construction -> WORLDQ Q3/Q4/Q5 package and versioned asset manifests -> phone AR viewer with device-supported spatial anchors -> WORLDQ-ASTRA event visualization.

GENESIS CLAIM binds authorized entity + spatial reference + permitted digital rights; it is not a game and never establishes land title. RuView/VisionClaw observations are optional, separately consented evidence streams; never auto-approve claims.

## Required event schema
`event_id, space_id, source, observed_at, event_type, confidence, coordinate_frame, consent_scope, retention_policy, model_version, evidence_digest, simulated`.
Reject unknown coordinate frames, missing consent, unsigned privileged events, and simulated events presented as real.

## Acceptance gates
1. Audit existing Parallax, WORLD, WORLD GRID, both gateway repositories and claim authority before implementing adapters.
2. Record license/weights/commit/maintenance/SBOM per candidate; pin versions.
3. Produce one synthetic room Q3 package with geometry, glTF assets and optional splat reference.
4. Verify deterministic WORLDQ reconstruction and content hashes across two sessions.
5. Render on Android phone and test iOS separately; explicitly document anchor persistence limits.
6. Emit a synthetic RuView motion event through a mock adapter; label it SIMULATED.
7. Confirm no live camera/RF capture, automatic claims, payment authority or remote secret exposure.
8. Threat model private interiors, location inference, surveillance, replay, prompt injection and unauthorized sharing.
9. Obtain 54-T review and approval before production integration.

## Cloud-first
Do not require local NVIDIA hardware. Separate capture/viewing on the phone from optional remote GPU reconstruction. Estimate compute cost and check provider/model licensing before launching any remote job.

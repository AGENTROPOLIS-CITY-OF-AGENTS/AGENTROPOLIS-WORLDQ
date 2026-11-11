# WORLDQ Ecumenopolis Spatial Reference — v0.1

Status: DESIGN SPECIFICATION / NOT IMPLEMENTED
Owner: AGENTROPOLIS-WORLDQ
Reference: Coruscant is a fictional ecumenopolis. This document uses the *general planet-wide city concept* only; no Star Wars IP, models, textures, maps, or distinctive architecture may be copied.

## Objective
Provide a globe-first, continuous 3D spatial navigation model for AGENTROPOLIS, with layered city infrastructure, enterable districts and buildings, and links to canonical services. Do not conflate visual spatial representation with ownership of backend services.

## Navigation hierarchy
WORLD (settlement/context) -> WORLDQ (spatial navigation) -> AGENTROPOLIS (coordination city) -> districts -> buildings -> rooms -> agent interfaces.

Globe-first entry is mandatory. Transitions should preserve user context and offer return navigation. Use spatial streaming / level-of-detail rather than loading a whole planet at once.

## District routing
- NEURO District and AKIRA Heights: boroughs.
- CHAOS MALL / GAMING DISTRICT: creator commerce, ROMRIOT and interactive experiences.
- DOCKING DISTRICT: external ecosystem/community discovery; links are registry-owned, not hardcoded.
- HERMES CITY: agent orchestration and pilot environment.
- BUILDER COMMONS: collaborative construction.
- SOCIALS: community and communication.
- Identity Plaza, Ledger Core, Work Exchange, Research District, Security Watch, Builder's Wharf: functional locations mapped to their canonical owners.

Retain canonical navigation order where applicable: AGENTROPOLIS -> CHAOS MALL GAMING DISTRICT -> DOCKING -> HERMES CITY -> BUILDER COMMONS -> SOCIALS. Do not overwrite other route definitions without repository inspection.

## Visual contract
- Real 3D city environments, enterable structures, dense vertical infrastructure, navigable streets, multiple elevations and underground levels.
- No generic primitive-only substitute for finished city assets; temporary developer proxies must be clearly marked.
- No copied copyrighted Coruscant designs.
- Follow AGENTROPOLIS Design System; avoid green-dominant palette. Preserve legible typography and cyan scrollbar where applicable.
- Progressive performance tiers for mobile and integrated GPUs. Do not require NVIDIA hardware.
- Accessibility: reduced-motion, keyboard navigation, text route alternatives, controllable camera.

## Sovereignty and security
- No mandatory third-party API, hosted renderer, telemetry, authentication, or inference service.
- Audit licenses and provenance for assets and dependencies.
- Enforce district permission boundaries; 3D entry does not grant tool privileges.
- Sensitive actions pass 54-T / APEX54 / AEGIS approval and receipt controls.
- Offline-capable core navigation, local cached assets, and deterministic fallback.

## Interfaces to recover before implementation
Inspect actual WORLDQ, WORLDQ-ASTRA, CITY, CREATOR, CREATOR-CORE, CONSTRUCTION, ASDS-54, DOCK and HERMES implementations. Document routes, scene formats, build systems, camera controls, and service links with commit SHAs. Do not invent integration status.

## Acceptance criteria
1. Globe view launches locally without external network.
2. User enters city, district, building and returns without losing navigation context.
3. At least one representative district uses actual licensed 3D assets, not placeholder blocks.
4. LOD and streaming demonstrated on CPU/integrated GPU and mobile test profiles; record measured frame rates.
5. No third-party runtime requests in offline acceptance test.
6. Permission boundaries remain enforced regardless of camera position.
7. Provenance, accessibility, rollback and verification receipts exist.
8. Independent review before merge or deployment.

## Delivery phases
P0 repository/asset census and route ownership.
P1 camera + globe-to-city transition contract.
P2 district/building scene streaming and entry.
P3 service interaction and security gating.
P4 offline/mobile performance and acceptance evidence.

No merge, deployment, or production activation is authorized by this specification.

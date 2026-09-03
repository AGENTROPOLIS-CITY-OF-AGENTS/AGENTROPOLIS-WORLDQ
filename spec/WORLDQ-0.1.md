# WORLDQ 0.1 — Architecture Draft

## Purpose

WORLDQ defines a progressive representation for persistent 3D worlds that can be transported, reconstructed, inspected, and manipulated by humans and autonomous agents.

## Design principles

1. Quantize before transmitting unnecessary precision.
2. Instance before duplicating geometry.
3. Stream according to observer/task requirements.
4. Separate semantic world identity from rendered fidelity.
5. Pin generators and seeds when procedural reconstruction must be deterministic.
6. Add residuals when generated or quantized reconstruction is insufficient.
7. Keep physics-critical and authority-critical state deterministic.
8. Every committed mutation should be independently verifiable.

## Layers

### Q0 — Manifest
World identity, coordinate system, schema version, hashes, capabilities, generator requirements.

### Q1 — Regions
Districts, zones, cells, bounds, portals, coarse navigation and visibility metadata.

### Q2 — Structures
Buildings, terrain sectors, large props, archetype references and transforms.

### Q3 — Local spaces
Rooms, interiors, collision partitions, local navigation and interaction anchors.

### Q4 — Entities
Objects, agents, interactables, materials, animation and state references.

### Q5 — Fidelity
High-detail geometry, textures, animation residuals and optional reconstruction corrections.

## Deterministic reconstruction contract

A deterministic WORLDQ reconstruction identifies at minimum:

- WORLDQ schema version
- source/world content hash
- generator implementation + version when used
- procedural seed when used
- quantization profile
- asset dictionary version/hash
- ordered residual layers

A decoder MUST NOT claim deterministic equivalence if any required dependency is unresolved or mutable.

## Quantization profiles

Profiles may independently define bit depth for positions, normals, UVs, rotations, scales, animation values and physics state. Physics-authoritative data may use a stricter profile than visual data.

## Streaming

A client requests world regions and fidelity according to position, task, capabilities and policy. WORLDQ does not require full-world download before interaction.

## Receipts

A world commit receipt should include input state hash, operation, affected entities/regions, output state hash, WORLDQ version, policy/authority reference and verification result.

## Security boundary

World descriptions are data, not authority. Loading a WORLDQ package MUST NOT automatically grant contained agents/scripts/tool descriptions execution permission.

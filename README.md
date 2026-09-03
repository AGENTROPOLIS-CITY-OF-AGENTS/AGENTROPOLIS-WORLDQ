# AGENTROPOLIS-WORLDQ

**WORLDQ — Quantized World Runtime**

WORLDQ is an open runtime and interchange approach for compressing, streaming, reconstructing, and agent-navigating persistent 3D worlds.

Instead of treating a world as one giant asset, WORLDQ decomposes it into progressively reconstructable layers: semantic manifests, quantized scene graphs, compressed geometry and textures, procedural seeds, asset dictionaries, state, and fidelity residuals.

## Goals

- Reduce world size through spatial and attribute quantization.
- Stream only the level of detail an observer or agent currently requires.
- Reuse archetypes and instancing instead of transmitting duplicate geometry.
- Support deterministic procedural reconstruction through pinned generator versions and seeds.
- Preserve high-fidelity results with optional residual correction layers.
- Expose world operations to agents through MCP and WebMCP.
- Produce verifiable receipts for world changes and reconstruction checks.

## Conceptual package

```text
WORLDQ package
├── world.manifest
├── scene.graph
├── geometry.qmesh
├── materials.qmat
├── textures.ktx2
├── motion.qanim
├── physics.qphys
├── spatial.qmap
├── agents.qstate
├── procedural.seed
└── residuals/
```

## Progressive world levels

```text
Q0  World token / manifest
Q1  Districts / regions
Q2  Structures
Q3  Rooms / cells
Q4  Objects / entities
Q5  Full local fidelity
```

WORLDQ clients should be able to request only the spatial fidelity needed for the current observer, agent, device, or task.

## MCP / WebMCP surface

Initial tool vocabulary:

```text
world.inspect
world.encode
world.quantize
world.stream
world.decode
world.enter
world.modify
world.commit
world.verify
```

## WebMCP Challenge

WORLDQ is being developed as a reusable AGENTROPOLIS Utility Grid primitive, with the AGENTROPOLIS WebMCP Challenge as its first proving ground.

The target challenge loop is:

```text
WebMCP agent
  -> inspect world
  -> quantize / package world
  -> progressively stream world
  -> enter and modify world
  -> commit state change
  -> verify deterministic reconstruction
  -> emit receipt
```

The objective is not to claim arbitrary multi-gigabyte worlds can be faithfully represented by a tiny prompt. WORLDQ instead aims to minimize the information required to reconstruct the level of reality currently needed, while preserving deterministic and auditable behavior where required.

## Relationship to Parallax Spatial MCP

`AGENTROPOLIS-PARALLAX-SPATIAL-MCP` remains a separate runtime/repository. Parallax is the spatial interaction and construction surface; WORLDQ is the compression, quantization, packaging, streaming, and reconstruction layer beneath it.

```text
WebMCP Challenge
      |
      +--> Parallax Spatial MCP   = spatial interaction/runtime
      |
      +--> WORLDQ                 = quantized world transport/runtime
```

The two projects integrate through explicit MCP/WebMCP contracts rather than being merged into one codebase.

## Status

Early architecture / prototype stage.

## License

Apache-2.0

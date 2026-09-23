# Overwatch Spatial Sensor Integration

WORLDQ may consume normalized Overwatch geography as an observation layer over canonical world state.

## Mapping

```text
Overwatch globe / MapLibre / AOI / H3
        |
        v
EvidenceEnvelope
        |
        v
WORLDQ spatial observation layer
        |
        +--> Q1 region
        +--> Q2 structure context
        +--> Q3/Q4 local entities when source supports fidelity
```

## Rules

- feed points are observations, not canonical world truth
- H3 HEAT cells represent attention/overlap, not causal certainty
- demo hotspots remain navigation geography and must not become live events
- stale/error state must remain visible
- AOI clips the current view; it does not prove absence outside the AOI
- time scrubber history is limited to observations actually retained by the client/adapter
- model-generated briefs remain derived assertions

## Spatial fields

WORLDQ adapters may ingest:

- lat/lon
- H3
- GeoJSON geometry
- source timestamps
- evidence ids
- LIVE/STALE/ERR/OFF state

WORLDQ renderers may visualize these observations but must preserve the distinction between canonical spatial state and external evidence overlays.

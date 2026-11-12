# WORLDQ Genesis Claim Naming & Integration Contract v0.1

Status: proposed architecture; no production entitlement or deployment implied.
Date: 2026-11-11

## Canonical names
- WORLD ATLAS: navigable 3D Earth and geographic reference surface.
- WORLD MIRROR: digital Earth twin and geospatial visualization.
- WORLDQ: spatial coordination and intelligence layer.
- WORLD PARCEL: uniquely addressable *virtual* spatial unit.
- GENESIS CLAIM: user action requesting a virtual parcel entitlement.
- GENESIS REGISTRY: authoritative, auditable record of virtual claims.
- AGENTROPOLIS: district construction, agents and civic/economic interaction.
- ROMRIOT: optional gameplay and simulation engine.
- PAYRAIL / OMNIRAIL54: governed payments and settlement, not ownership authority.

## User journey
Explore WORLD ATLAS -> inspect WORLD MIRROR -> select WORLD PARCEL -> request GENESIS CLAIM -> registry validates -> issue claim receipt -> build AGENTROPOLIS district -> optional ROMRIOT gameplay and PAYRAIL commerce.

## Non-negotiable rules
1. Virtual claims never imply title, possession, access, mineral rights, jurisdiction, or other rights to physical property.
2. No wallet required to explore or request a free claim; paid flows must be explicit and separately authorized.
3. Claims must be uniquely identified and concurrency-safe; overlapping claims require deterministic policy and review.
4. Record provenance, actor authorization, geometry version, timestamp, state transition, and immutable audit receipt.
5. Prevent claims over sensitive/protected locations until geographic eligibility policy is approved.
6. Avoid the board-game brand name in public product naming, UI, repository titles, and marketing.
7. Conduct trademark clearance and license review before commercial launch.
8. 54-T/APEX54 gates: inspect -> simulate -> preview -> approve -> execute -> verify -> record.

## Technical contract (draft)
WorldParcel: parcel_id, grid_system, grid_version, geometry_ref, resolution, eligibility_status.
GenesisClaim: claim_id, parcel_id, claimant_subject_id, status [requested|approved|rejected|revoked], policy_version, created_at, receipt_id.
Claim transitions must be idempotent, authorization checked, and resistant to duplicate/overlap races. Public globe data is not evidence of physical property ownership.

## ORBITAL assessment gate
Evaluate vcruz305/orbital as a potential CesiumJS visualization reference only. Before reuse: verify actual repo, license, data attribution, CORS/API reliability, mobile performance, and security. Satellite/aircraft feeds are not required for claim registration. Do not present simulated telemetry as live.

## Ownership and implementation sequence
WORLDQ owns spatial contracts and integration specification. Genesis Registry owns claim entitlement authority (repository to be confirmed). WORLD MIRROR owns user visualization (repository to be confirmed). AGENTROPOLIS owns district gameplay; ROMRIOT remains optional. Implement on feature branches and merge only after checks and reviews.

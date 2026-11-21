// quantize.mjs - Explicit 16-level quantization (QRAG bench definition).
// Ported verbatim (behavior) from 54T Stage B src/quantize.mjs.
// A continuous risk score in [0, 1] is quantized to 16 discrete levels
// (0..15): level = clamp(floor(score * 16), 0, 15). The quantized score
// is level / 15. This is the ONLY quantization mechanism in Stage B.
//
// STAGE B-DEFINED RISK TIERS (NOT MATH54): MATH54's canonical risk
// tiers do not exist in any located source (Stage A G3, NOT VERIFIED).
// The tiers below are Stage B implementation choices, documented as
// such, and must NEVER be presented as MATH54's canonical model.
//   levels  0-3  -> LOW
//   levels  4-7  -> GUARDED
//   levels  8-11 -> ELEVATED
//   levels 12-15 -> CRITICAL
export const LEVELS = 16;

export function quantize(score) {
  if (!Number.isFinite(score)) throw new Error("quantize: non-finite score");
  const clamped = Math.min(1, Math.max(0, score));
  const level = Math.min(LEVELS - 1, Math.floor(clamped * LEVELS));
  return { level, quantizedScore: level / (LEVELS - 1) };
}

// Stage B-defined risk tier for a quantized level. NOT MATH54 canonical.
export function riskTier(level) {
  if (level <= 3) return "LOW";
  if (level <= 7) return "GUARDED";
  if (level <= 11) return "ELEVATED";
  return "CRITICAL";
}

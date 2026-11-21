// index.mjs - Public API of the UWE54 shared engine package (v0.1.0).
// This is the ONLY entry point applications import. The engine has no
// imports from any application (enforced by tests/no-imports.mjs).
export { canonical } from "./canonical.mjs";
export { sha256Hex } from "./sha256.mjs";
export { mulberry32, randInt, randPick } from "./prng.mjs";
export { quantize, riskTier, LEVELS } from "./quantize.mjs";
export { ReceiptChain, receiptHash, globalHead, verifyChain, STREAMS } from "./receipts.mjs";
export {
  SIM_CONFIG_ID, DEFAULT_SIM_CONFIG, SIM_CONFIG_SCHEMA, ENGINE_CONFIG,
  validateConfig, validateSimConfig,
} from "./config.mjs";

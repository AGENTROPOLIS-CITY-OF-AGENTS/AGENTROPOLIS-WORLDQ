// config.mjs - Engine and simulation configuration + validation.
// The simulation config is the 54T Stage B config (configId
// "verity-city-100agent-v01"), validated with the same rules as Stage B
// src/validate.mjs (minimal JSON Schema subset: type, const, minimum,
// maximum, required, additionalProperties). Environment-agnostic.
export const SIM_CONFIG_ID = "verity-city-100agent-v01";
export const DEFAULT_SIM_CONFIG = {
  configId: SIM_CONFIG_ID,
  containmentOn: true,
  killSwitchTick: null,
  mode: "adversarial",
  nAgents: 100,
  productionMutationsAllowed: false,
  scenario: "single_agent",
  seed: 54,
  tasksPerTick: 4,
  ticks: 60,
};

export const SIM_CONFIG_SCHEMA = {
  type: "object",
  required: ["configId", "containmentOn", "mode", "nAgents", "scenario", "seed", "tasksPerTick", "ticks"],
  additionalProperties: false,
  properties: {
    configId: { type: "string", const: SIM_CONFIG_ID },
    containmentOn: { type: "boolean" },
    killSwitchTick: { type: ["integer", "null"], minimum: 0 },
    mode: { type: "string", const: "adversarial" },
    nAgents: { type: "integer", const: 100 },
    productionMutationsAllowed: { type: "boolean", const: false },
    scenario: { type: "string", const: "single_agent" },
    seed: { type: "integer", minimum: 0 },
    tasksPerTick: { type: "integer", minimum: 1, maximum: 64 },
    ticks: { type: "integer", minimum: 1, maximum: 10000 },
  },
};

// Engine (non-sim) configuration.
export const ENGINE_CONFIG = {
  simHz: 60, // fixed simulation steps per second
  maxAgents: 100,
  maxStepsPerFrame: 5, // spiral-of-death guard
  maxFrameDtSeconds: 0.25, // clamp on real dt fed to the clock
};

export function validateConfig(config, schema) {
  const errors = [];
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return ["config must be an object"];
  }
  for (const req of schema.required || []) {
    if (!(req in config)) errors.push(`missing required property: ${req}`);
  }
  if (schema.additionalProperties === false) {
    for (const k of Object.keys(config)) {
      if (!(k in (schema.properties || {}))) errors.push(`additional property not allowed: ${k}`);
    }
  }
  for (const [key, rule] of Object.entries(schema.properties || {})) {
    if (!(key in config)) continue;
    const v = config[key];
    const types = Array.isArray(rule.type) ? rule.type : [rule.type];
    const okType = types.some((t) => {
      if (t === "integer") return Number.isInteger(v);
      if (t === "number") return typeof v === "number";
      if (t === "string") return typeof v === "string";
      if (t === "boolean") return typeof v === "boolean";
      if (t === "null") return v === null;
      return false;
    });
    if (!okType) {
      errors.push(`${key}: expected type ${types.join("/")} got ${typeof v}`);
      continue;
    }
    if (rule.const !== undefined && v !== rule.const) {
      errors.push(`${key}: must equal ${JSON.stringify(rule.const)}`);
    }
    if (typeof v === "number") {
      if (rule.minimum !== undefined && v < rule.minimum) errors.push(`${key}: below minimum ${rule.minimum}`);
      if (rule.maximum !== undefined && v > rule.maximum) errors.push(`${key}: above maximum ${rule.maximum}`);
    }
  }
  return errors;
}

export function validateSimConfig(config) {
  return validateConfig(config, SIM_CONFIG_SCHEMA);
}

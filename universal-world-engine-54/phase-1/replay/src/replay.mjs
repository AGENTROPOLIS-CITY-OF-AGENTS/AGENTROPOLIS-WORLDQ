// replay.mjs - Deterministic replay check (verification only).
// Runs the sim fresh via runSimulation and compares the global head to
// an expected head. Uses the sim API contract only; it does not implement
// any simulation itself. If the sim has not landed, it reports that
// honestly instead of inventing a result.
// No em dashes in this file.
export function replayFromSeed(config, ticks, expectedHead) {
  if (typeof runSimulation !== "function") {
    return { globalHead: null, chainValid: false, matchesReference: false, error: "sim not landed: runSimulation is not defined" };
  }
  const runConfig = Object.assign({}, config || {}, { ticks: ticks });
  const result = runSimulation(runConfig);
  let head = null;
  let chainValid = false;
  if (result && typeof result.getGlobalHead === "function") head = result.getGlobalHead();
  else if (result && typeof result.globalHead === "string") head = result.globalHead;
  else if (result && result.summary && typeof result.summary.globalHead === "string") head = result.summary.globalHead;
  else if (result && result.sim && typeof result.sim.getGlobalHead === "function") head = result.sim.getGlobalHead();
  if (result && typeof result.verify === "function") {
    const v = result.verify();
    chainValid = v && (v.ok === true || v.chainValid === true || v.valid === true);
  } else if (result && result.summary && typeof result.summary.chainValid === "boolean") {
    chainValid = result.summary.chainValid;
  } else if (result && typeof result.chainValid === "boolean") {
    chainValid = result.chainValid;
  }
  return {
    globalHead: head,
    chainValid: chainValid,
    matchesReference: expectedHead ? head === expectedHead : null,
    error: null,
  };
}

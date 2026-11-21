// determinism.mjs - P1.3 gate G2 test: the ECS port must reproduce the
// 54T Stage B reference receipt-chain heads exactly, for both arms.
// Compares, against evidence/reference-on and evidence/reference-off:
//   - global head and per-stream heads
//   - receipt counts per stream and total
//   - every summary field except runMetadata / artifactHashes
//   - every receipt line (canonical JSON, byte-identical order and content)
//   - every record line
// Also checks repeat-run stability (run ON twice, heads identical),
// the steppable createSim API against the one-shot run, restart
// behavior, the kill switch, and the tamper test (mutate one receipt
// payload, the independent verifier must fail at exactly that seq).
// Node-only (fs). Exits 0 on PASS, non-zero on any mismatch.
// Usage: node tests/determinism.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { canonical } from "../engine/src/index.mjs";
import {
  runSimulation,
  createSim,
  verifyAllIndependent,
  verifyChainIndependent,
  tamperTest,
  DEFAULT_SIM_CONFIG,
} from "../simulation/agents/src/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const failures = [];
let checks = 0;

function check(name, ok, detail = "") {
  checks += 1;
  if (ok) {
    console.log(`  PASS ${name}`);
  } else {
    failures.push(name);
    console.error(`  FAIL ${name}${detail ? " - " + detail : ""}`);
  }
}

function loadJsonLines(path) {
  const text = readFileSync(path, "utf8");
  return text.trim().split("\n").filter((l) => l.length > 0);
}

function stripMeta(summary) {
  const copy = JSON.parse(JSON.stringify(summary));
  delete copy.runMetadata;
  delete copy.artifactHashes;
  return copy;
}

function compareArm(arm, dirName) {
  console.log(`arm ${arm} (${dirName}):`);
  const dir = join(ROOT, "evidence", dirName);
  const refSummary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));
  const refReceiptLines = loadJsonLines(join(dir, "receipts.jsonl"));
  const refRecordLines = loadJsonLines(join(dir, "records.jsonl"));
  const config = { ...DEFAULT_SIM_CONFIG, containmentOn: arm === "ON" };
  const result = runSimulation(config);
  const summary = result.summary;

  check(`${arm} global head`, summary.globalHead === refSummary.globalHead,
    `got ${summary.globalHead} want ${refSummary.globalHead}`);
  check(`${arm} stream heads`, canonical(summary.streamHeads) === canonical(refSummary.streamHeads),
    `got ${canonical(summary.streamHeads)} want ${canonical(refSummary.streamHeads)}`);
  check(`${arm} receipt counts`, canonical(summary.receiptsEmitted) === canonical(refSummary.receiptsEmitted),
    `got ${canonical(summary.receiptsEmitted)} want ${canonical(refSummary.receiptsEmitted)}`);
  check(`${arm} summary fields (except runMetadata/artifactHashes)`,
    canonical(stripMeta(summary)) === canonical(stripMeta(refSummary)),
    `got ${canonical(stripMeta(summary))} want ${canonical(stripMeta(refSummary))}`);
  check(`${arm} chainValid`, summary.chainValid === true && summary.verificationError === null);

  const myReceiptLines = [
    ...result.receipts.events,
    ...result.receipts.transitions,
    ...result.receipts.settlements,
  ].map((r) => canonical(r));
  check(`${arm} receipt line count`, myReceiptLines.length === refReceiptLines.length,
    `got ${myReceiptLines.length} want ${refReceiptLines.length}`);
  let firstDiff = -1;
  for (let i = 0; i < Math.min(myReceiptLines.length, refReceiptLines.length); i++) {
    if (myReceiptLines[i] !== refReceiptLines[i]) {
      firstDiff = i;
      break;
    }
  }
  check(`${arm} receipt lines byte-identical`, firstDiff === -1,
    firstDiff >= 0
      ? `first divergent line ${firstDiff + 1}:\n    got  ${myReceiptLines[firstDiff]}\n    want ${refReceiptLines[firstDiff]}`
      : "");
  const myRecordLines = result.records.map((r) => canonical(r));
  check(`${arm} record line count`, myRecordLines.length === refRecordLines.length,
    `got ${myRecordLines.length} want ${refRecordLines.length}`);
  let firstRecordDiff = -1;
  for (let i = 0; i < Math.min(myRecordLines.length, refRecordLines.length); i++) {
    if (myRecordLines[i] !== refRecordLines[i]) {
      firstRecordDiff = i;
      break;
    }
  }
  check(`${arm} record lines byte-identical`, firstRecordDiff === -1,
    firstRecordDiff >= 0
      ? `first divergent record ${firstRecordDiff + 1}:\n    got  ${myRecordLines[firstRecordDiff]}\n    want ${refRecordLines[firstRecordDiff]}`
      : "");

  // Independent verifier must accept the reference evidence itself.
  const refReceipts = refReceiptLines.map((l) => JSON.parse(l));
  const refStreams = {
    events: refReceipts.filter((r) => r.stream === "events"),
    transitions: refReceipts.filter((r) => r.stream === "transitions"),
    settlements: refReceipts.filter((r) => r.stream === "settlements"),
  };
  const refVerify = verifyAllIndependent(refStreams, refSummary.globalHead);
  check(`${arm} independent verifier accepts reference evidence`, refVerify.ok === true,
    refVerify.error || "");
  return { refSummary, result };
}

const on = compareArm("ON", "reference-on");
const off = compareArm("OFF", "reference-off");

// Repeat-run stability: run ON twice, heads and full receipts identical.
console.log("repeat-run stability:");
const again = runSimulation({ ...DEFAULT_SIM_CONFIG, containmentOn: true });
check("ON repeat run global head identical", again.summary.globalHead === on.result.summary.globalHead);
check("ON repeat run receipts identical",
  canonical(again.receipts) === canonical(on.result.receipts));
check("ON repeat run records identical",
  canonical(again.records) === canonical(on.result.records));

// Steppable createSim must match the one-shot run exactly.
console.log("createSim steppable API:");
const sim = createSim({ ...DEFAULT_SIM_CONFIG, containmentOn: true });
let lastStep = null;
for (let i = 0; i < 60; i++) lastStep = sim.step();
check("createSim 60 steps done, not halted", lastStep.done === true && lastStep.halted === false,
  JSON.stringify(lastStep));
check("createSim global head matches one-shot",
  sim.getGlobalHead() === on.result.summary.globalHead,
  `got ${sim.getGlobalHead()} want ${on.result.summary.globalHead}`);
check("createSim receipts match one-shot",
  canonical(sim.getReceipts()) === canonical(on.result.receipts));
check("createSim state histogram matches one-shot",
  canonical(sim.getState().stateHistogram) === canonical(on.result.summary.stateHistogram));
check("createSim verify() ok", sim.verify().ok === true);
check("createSim extra step stays done", sim.step().done === true);
const st0 = sim.getState();
check("createSim totalTicks 60 after one loop", st0.totalTicks === 60, `got ${st0.totalTicks}`);
check("createSim loopCount 0 before restart", st0.loopCount === 0, `got ${st0.loopCount}`);

// Restart: fresh run from seed 54, same head, loopCount and totalTicks persist.
const restarted = sim.restart();
check("restart returns loopCount 1", restarted.loopCount === 1, JSON.stringify(restarted));
let lastStep2 = null;
for (let i = 0; i < 60; i++) lastStep2 = sim.step();
check("restarted run done", lastStep2.done === true);
check("restarted run head identical", sim.getGlobalHead() === on.result.summary.globalHead);
const st1 = sim.getState();
check("restarted run loopCount 1, totalTicks 120",
  st1.loopCount === 1 && st1.totalTicks === 120,
  `got loopCount ${st1.loopCount} totalTicks ${st1.totalTicks}`);
check("restarted run receipts identical to one-shot",
  canonical(sim.getReceipts()) === canonical(on.result.receipts));

// Kill switch: terminal, latency exactly 1, restart refused.
console.log("kill switch:");
const ksRun = runSimulation({ ...DEFAULT_SIM_CONFIG, containmentOn: true, killSwitchTick: 10 });
check("kill-switch run halted", ksRun.summary.halted === true);
check("kill-switch haltTick 11", ksRun.summary.haltTick === 11, `got ${ksRun.summary.haltTick}`);
check("kill-switch latency exactly 1", ksRun.summary.killSwitchLatencyTicks === 1,
  `got ${ksRun.summary.killSwitchLatencyTicks}`);
check("kill-switch ticksExecuted 11", ksRun.summary.ticksExecuted === 11,
  `got ${ksRun.summary.ticksExecuted}`);
const ksSim = createSim({ ...DEFAULT_SIM_CONFIG, containmentOn: true, killSwitchTick: 10 });
let ksLast = null;
for (let i = 0; i < 30; i++) {
  ksLast = ksSim.step();
  if (ksLast.done) break;
}
check("kill-switch sim halts at tick 11", ksLast.halted === true && ksLast.tick === 11,
  JSON.stringify(ksLast));
let restartThrew = false;
try {
  ksSim.restart();
} catch (e) {
  restartThrew = true;
}
check("kill-switch sim restart throws (terminal)", restartThrew);

// Tamper test: mutate one receipt payload, verifier must fail at exactly that seq.
console.log("tamper test:");
const events = on.result.receipts.events;
const tampered = tamperTest(events, 3);
check("tamper events seq 3 detected", tampered.detected === true);
check("tamper events seq 3 failSeq exactly 3", tampered.failSeq === 3,
  `got ${tampered.failSeq}`);
check("tamper events seq 3 checked index 2", tampered.checked === 2,
  `got ${tampered.checked}`);
const tamperedSettle = tamperTest(on.result.receipts.settlements, 1);
check("tamper settlements seq 1 detected at exactly seq 1",
  tamperedSettle.detected === true && tamperedSettle.failSeq === 1,
  JSON.stringify(tamperedSettle));
const clean = verifyChainIndependent(events);
check("untampered events chain verifies", clean.ok === true && clean.checked === events.length);

// OFF arm spot checks from the brief.
console.log("OFF arm spot checks:");
check("OFF unauthorizedEffects 7", off.result.summary.unauthorizedEffects === 7);
check("OFF deniedCount 0", off.result.summary.deniedCount === 0);

console.log(`determinism: ${checks - failures.length}/${checks} checks PASS`);
if (failures.length) {
  console.error(`determinism: FAIL (${failures.length} failed)`);
  process.exit(1);
}
console.log("determinism: PASS - ON/OFF heads reproduced exactly");

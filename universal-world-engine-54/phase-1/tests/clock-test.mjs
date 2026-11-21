// clock-test.mjs - FixedStepClock: fixed steps, determinism, alpha bounds.
// G3 support: the same dt sequence must produce the same step counts;
// alpha must stay in [0, 1); the spiral guard must drop (not execute)
// excess time.
import { FixedStepClock, SIM_HZ, STEP_SECONDS } from "../clock/src/clock.mjs";

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.error("FAIL:", label); }
  else console.log("ok:", label);
};

check(SIM_HZ === 60, "SIM_HZ is 60");
check(Math.abs(STEP_SECONDS - 1 / 60) < 1e-12, "STEP_SECONDS is 1/60");

// 120 frames at exactly 1/60 -> exactly 120 steps, alpha 0.
{
  const clock = new FixedStepClock();
  let steps = 0;
  for (let f = 0; f < 120; f++) clock.update(1 / 60, () => steps++);
  check(steps === 120, "120 frames @1/60s = 120 steps (got " + steps + ")");
  check(clock.simTick === 120, "simTick 120");
  check(clock.alpha === 0, "alpha 0 on exact steps");
}

// Same dt sequence twice -> same step count and same simTick.
{
  const dts = [0.016, 0.033, 0.008, 0.05, 0.0167, 0.1, 0.0, 0.004];
  const run = () => {
    const c = new FixedStepClock();
    let s = 0;
    for (let k = 0; k < 25; k++) for (const d of dts) c.update(d, () => s++);
    return { steps: s, tick: c.simTick, dropped: c.droppedTime };
  };
  const a = run(), b = run();
  check(a.steps === b.steps && a.tick === b.tick, "deterministic step counts (" + a.steps + " steps both runs)");
  check(a.dropped === b.dropped, "deterministic dropped time");
}

// Alpha always in [0, 1).
{
  const c = new FixedStepClock();
  let bad = 0;
  const dts = [0.001, 0.0167, 0.033, 0.1, 0.25, 0.0001, 0.05];
  for (let k = 0; k < 200; k++) {
    const r = c.update(dts[k % dts.length], () => {});
    if (!(r.alpha >= 0 && r.alpha < 1)) bad++;
  }
  check(bad === 0, "alpha in [0,1) across 200 mixed-dt frames");
}

// Spiral guard: a huge dt does not execute unbounded steps.
{
  const c = new FixedStepClock({ maxStepsPerFrame: 5 });
  let steps = 0;
  c.update(10, () => steps++); // 10 s clamped to 0.25 s = 15 steps max, guard caps at 5
  check(steps === 5, "spiral guard caps steps per frame at 5 (got " + steps + ")");
  check(c.droppedTime > 0, "excess time counted as dropped, not executed");
}

// Zero/negative dt: no steps, no crash, alpha unchanged-ish.
{
  const c = new FixedStepClock();
  let steps = 0;
  c.update(0, () => steps++);
  c.update(-1, () => steps++);
  check(steps === 0, "zero/negative dt steps nothing");
}

if (failures) {
  console.error(`clock-test: FAIL (${failures} failures)`);
  process.exit(1);
}
console.log("clock-test: PASS");

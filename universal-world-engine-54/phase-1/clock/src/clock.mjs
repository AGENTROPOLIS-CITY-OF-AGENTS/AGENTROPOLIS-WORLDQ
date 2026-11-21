// clock.mjs - Shared fixed-step simulation clock (60 Hz) with
// interpolated rendering.
// The sim advances by fixed steps independent of wall clock; rendering
// interpolates between the last two sim states using alpha in [0, 1).
// One shared clock for CPU and GPU: the sim never reads wall clock,
// and the renderer never steps the sim.
//
// Contract:
// - update(dtSeconds, stepFn): feeds real frame dt (clamped to
//   maxFrameDtSeconds), runs stepFn(simTick) once per fixed step, and
//   returns { steps, alpha }. simTick counts total fixed steps.
// - alpha = accumulator / step after stepping, in [0, 1). The renderer
//   draws lerp(prevState, currentState, alpha).
// - Spiral-of-death guard: at most maxStepsPerFrame steps per update;
//   excess accumulated time is dropped and counted in droppedTime
//   (never silently executed late).
// - Determinism: the same sequence of dt values produces the same
//   sequence of step counts and the same sim states. Wall-clock timing
//   is NOT reproducible; step counts for a given dt sequence are.
export const SIM_HZ = 60;
export const STEP_SECONDS = 1 / SIM_HZ;

export class FixedStepClock {
  constructor({ hz = SIM_HZ, maxStepsPerFrame = 5, maxFrameDtSeconds = 0.25 } = {}) {
    this.hz = hz;
    this.step = 1 / hz;
    this.maxStepsPerFrame = maxStepsPerFrame;
    this.maxFrameDtSeconds = maxFrameDtSeconds;
    this.accumulator = 0;
    this.simTick = 0;
    this.stepsThisFrame = 0;
    this.alpha = 0;
    this.droppedTime = 0;
    this.totalSteps = 0;
  }

  update(dtSeconds, stepFn) {
    const dt = Math.min(Math.max(dtSeconds, 0), this.maxFrameDtSeconds);
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxStepsPerFrame) {
      stepFn(this.simTick);
      this.simTick += 1;
      this.totalSteps += 1;
      this.accumulator -= this.step;
      steps += 1;
    }
    if (this.accumulator >= this.step) {
      // Guard tripped: drop the backlog rather than spiral.
      this.droppedTime += this.accumulator;
      this.accumulator = 0;
    }
    this.stepsThisFrame = steps;
    this.alpha = this.accumulator / this.step;
    return { steps, alpha: this.alpha };
  }

  reset() {
    this.accumulator = 0;
    this.simTick = 0;
    this.stepsThisFrame = 0;
    this.alpha = 0;
    this.droppedTime = 0;
    this.totalSteps = 0;
  }
}

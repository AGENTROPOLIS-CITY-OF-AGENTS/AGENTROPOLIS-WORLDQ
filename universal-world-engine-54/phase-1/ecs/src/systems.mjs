// systems.mjs - Minimal ordered system runner.
// Systems run in registration order, once per tick. The runner owns no
// state and no game logic; it is the fixed execution order the sim and
// the demo share. A system is fn(world, tick, ctx).
export class SystemRunner {
  constructor() {
    this.systems = [];
  }

  add(name, fn) {
    if (typeof fn !== "function") throw new Error("SystemRunner.add: fn must be a function");
    this.systems.push({ name, fn });
    return this;
  }

  run(world, tick, ctx) {
    for (const s of this.systems) s.fn(world, tick, ctx);
  }

  get names() {
    return this.systems.map((s) => s.name);
  }
}

// world.mjs - ECS World: entity ids, spawn/destroy, component stores.
// Entity ids are small integers (0..maxEntities-1). No game logic lives
// here; systems own behavior. The world is deliberately boring: it
// allocates ids, tracks liveness, and owns the SoA component stores.
import { AgentComponents, agentIdString } from "./components.mjs";

export class World {
  constructor(maxEntities = 100) {
    this.maxEntities = maxEntities;
    this.alive = new Uint8Array(maxEntities); // 1 = live entity
    this.aliveCount = 0;
    this.nextId = 0;
    this.freeList = [];
    this.agents = new AgentComponents(maxEntities);
  }

  createEntity() {
    let id;
    if (this.freeList.length > 0) {
      id = this.freeList.pop();
    } else {
      if (this.nextId >= this.maxEntities) {
        throw new Error("World: entity capacity exhausted (" + this.maxEntities + ")");
      }
      id = this.nextId++;
    }
    this.alive[id] = 1;
    this.aliveCount += 1;
    this.agents.clearEntity(id);
    return id;
  }

  destroyEntity(id) {
    if (!this.alive[id]) return false;
    this.alive[id] = 0;
    this.aliveCount -= 1;
    this.agents.clearEntity(id);
    this.freeList.push(id);
    return true;
  }

  isAlive(id) {
    return id >= 0 && id < this.maxEntities && this.alive[id] === 1;
  }

  idString(id) {
    return agentIdString(id);
  }

  // Iterate live entity ids in ascending index order. Ascending order
  // is load-bearing for determinism: the reference sim iterates agents
  // in index order, and every seeded draw depends on that order.
  forEachAlive(fn) {
    for (let i = 0; i < this.maxEntities; i++) {
      if (this.alive[i]) fn(i);
    }
  }

  aliveIds() {
    const out = [];
    this.forEachAlive((id) => out.push(id));
    return out;
  }
}

// prng.mjs - Seeded PRNG: mulberry32 (standard 6-line function).
// Ported verbatim (behavior) from 54T Stage B src/prng.mjs.
// Attribution: mulberry32 is a well-known public-domain seeded PRNG
// (https://github.com/bryc/code/blob/master/jshash/PRNGs.md).
// One seed per run; no Math.random; no wall clock in simulation state.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer in [0, n). Uses the seeded stream only.
export function randInt(rng, n) {
  return Math.floor(rng() * n);
}

// Pick one element from an array using the seeded stream.
export function randPick(rng, arr) {
  return arr[randInt(rng, arr.length)];
}

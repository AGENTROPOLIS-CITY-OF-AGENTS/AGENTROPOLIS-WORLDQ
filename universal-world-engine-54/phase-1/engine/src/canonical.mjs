// canonical.mjs - Canonical JSON: key-sorted, no whitespace.
// Ported verbatim (behavior) from 54T Stage B src/canonical.mjs.
// Environment-agnostic pure JS: no node: imports, so the same code runs
// in Node tests and in the browser demo.
// Throws on undefined, functions, and non-finite numbers.
// Money is integer cents; a float here is a bug.
export function canonical(value) {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number") {
    if (!Number.isFinite(value)) throw new Error("canonical: non-finite number");
    return JSON.stringify(value);
  }
  if (t === "string" || t === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonical).join(",") + "]";
  }
  if (t === "object") {
    const keys = Object.keys(value).sort();
    return (
      "{" +
      keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") +
      "}"
    );
  }
  throw new Error("canonical: unsupported type " + t);
}

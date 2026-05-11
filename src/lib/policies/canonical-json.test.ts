import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "./canonical-json";

test("canonicalJson keeps stable key ordering", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), "{\"a\":1,\"b\":2}");
});

test("canonicalJson returns the same output for reordered nested objects", () => {
  const first = { z: [{ b: 2, a: 1 }], a: { d: 4, c: 3 } };
  const second = { a: { c: 3, d: 4 }, z: [{ a: 1, b: 2 }] };

  assert.equal(canonicalJson(first), canonicalJson(second));
});


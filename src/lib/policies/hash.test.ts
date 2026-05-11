import assert from "node:assert/strict";
import test from "node:test";
import { sha256Hex } from "./hash";

test("sha256Hex is deterministic for equivalent canonical objects", async () => {
  const first = await sha256Hex({ b: 2, a: 1 });
  const second = await sha256Hex({ a: 1, b: 2 });

  assert.equal(first, second);
  assert.equal(first.length, 64);
});


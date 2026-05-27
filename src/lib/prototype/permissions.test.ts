import assert from "node:assert/strict";
import test from "node:test";
import { demoAccounts } from "./authAccounts";
import { can } from "./permissions";

test("owner can manage the full enterprise console", () => {
  assert.equal(can("owner", "source:upload"), true);
  assert.equal(can("owner", "candidate:confirm"), true);
  assert.equal(can("owner", "proposal:finalize"), true);
  assert.equal(can("owner", "company:manage"), true);
  assert.equal(can("owner", "company:user:manage"), true);
  assert.equal(can("owner", "company:organization:manage"), true);
  assert.equal(can("owner", "company:code:manage"), true);
  assert.equal(can("owner", "company:type:manage"), true);
});

test("manager can operate data and decisions but only read company administration", () => {
  assert.equal(can("manager", "company:read"), true);
  assert.equal(can("manager", "source:upload"), true);
  assert.equal(can("manager", "insight:proposal"), true);
  assert.equal(can("manager", "proposal:vote"), true);
  assert.equal(can("manager", "verification:create"), true);
  assert.equal(can("manager", "outcome:record"), true);
  assert.equal(can("manager", "company:manage"), false);
  assert.equal(can("manager", "company:user:manage"), false);
  assert.equal(can("manager", "company:organization:manage"), false);
  assert.equal(can("manager", "company:code:manage"), false);
  assert.equal(can("manager", "company:type:manage"), false);
});

test("demo exposes exactly one account per active enterprise role", () => {
  assert.deepEqual(demoAccounts.map((account) => account.role), ["owner", "manager"]);
  assert.deepEqual(demoAccounts.map((account) => account.userId), ["user-owner", "user-manager"]);
  assert.equal(demoAccounts.some((account) => account.loginId === "test" && account.password === "test"), true);
});

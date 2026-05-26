import assert from "node:assert/strict";
import test from "node:test";
import { demoAccounts } from "./authAccounts";
import { can } from "./permissions";

test("owner can manage the full operating flow", () => {
  assert.equal(can("owner", "source:upload"), true);
  assert.equal(can("owner", "candidate:confirm"), true);
  assert.equal(can("owner", "proposal:finalize"), true);
  assert.equal(can("owner", "admin:manage"), true);
});

test("manager can drive the decision flow and limited organization management", () => {
  assert.equal(can("manager", "source:upload"), true);
  assert.equal(can("manager", "insight:proposal"), true);
  assert.equal(can("manager", "proposal:vote"), true);
  assert.equal(can("manager", "verification:create"), true);
  assert.equal(can("manager", "outcome:record"), true);
  assert.equal(can("manager", "admin:manage"), false);
});

test("member can read shared screens but cannot vote or mutate operating structure", () => {
  assert.equal(can("member", "proposal:vote"), false);
  assert.equal(can("member", "source:upload"), false);
  assert.equal(can("member", "candidate:confirm"), false);
  assert.equal(can("member", "insight:proposal"), false);
  assert.equal(can("member", "proposal:finalize"), false);
  assert.equal(can("member", "verification:create"), false);
  assert.equal(can("member", "outcome:record"), false);
});

test("demo exposes exactly one account per customer role", () => {
  assert.deepEqual(demoAccounts.map((account) => account.role), ["owner", "manager", "member"]);
  assert.deepEqual(demoAccounts.map((account) => account.userId), ["user-admin", "user-manager", "user-member"]);
  assert.equal(demoAccounts.some((account) => account.loginId === "test" && account.password === "test"), true);
});

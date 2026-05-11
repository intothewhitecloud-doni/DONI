import assert from "node:assert/strict";
import test from "node:test";
import { demoAccounts } from "./authAccounts";
import { can } from "./permissions";

test("admin can manage the full operating flow", () => {
  assert.equal(can("admin", "source:upload"), true);
  assert.equal(can("admin", "candidate:confirm"), true);
  assert.equal(can("admin", "proposal:finalize"), true);
  assert.equal(can("admin", "admin:manage"), true);
});

test("manager can drive the decision flow without organization management", () => {
  assert.equal(can("manager", "source:upload"), true);
  assert.equal(can("manager", "insight:proposal"), true);
  assert.equal(can("manager", "proposal:vote"), true);
  assert.equal(can("manager", "verification:create"), true);
  assert.equal(can("manager", "outcome:record"), true);
  assert.equal(can("manager", "admin:manage"), false);
});

test("member can participate in votes but cannot mutate operating structure", () => {
  assert.equal(can("member", "proposal:vote"), true);
  assert.equal(can("member", "source:upload"), false);
  assert.equal(can("member", "candidate:confirm"), false);
  assert.equal(can("member", "insight:proposal"), false);
  assert.equal(can("member", "proposal:finalize"), false);
  assert.equal(can("member", "verification:create"), false);
  assert.equal(can("member", "outcome:record"), false);
});

test("demo exposes exactly one account per customer role", () => {
  assert.deepEqual(demoAccounts.map((account) => account.role), ["admin", "manager", "member"]);
  assert.deepEqual(demoAccounts.map((account) => account.userId), ["user-admin", "user-manager", "user-member"]);
  assert.equal(demoAccounts.some((account) => account.loginId === "test" && account.password === "test"), true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { accessibleScreenForSession, activeSidebarScreen, permittedScreenForRole, screenRequiresLogin, sidebarItemsForRole } from "../prototype/navigation";
import { pathForScreen, routeSegments, screenFromPathname } from "../prototype/routes";

test("service screens have stable URL routes", () => {
  assert.equal(pathForScreen("home"), "/");
  assert.equal(pathForScreen("dashboard"), "/dashboard");
  assert.equal(pathForScreen("vault"), "/vault");
  assert.equal(pathForScreen("proposalVote"), "/proposal-vote");
  assert.equal(screenFromPathname("/analysis"), "analysis");
  assert.equal(screenFromPathname("/upload"), "upload");
  assert.equal(screenFromPathname("/company"), "home");
  assert.equal(screenFromPathname("/review/"), "review");
  assert.equal(routeSegments().includes("verification-detail"), true);
});

test("nested service screens keep their parent sidebar highlight", () => {
  assert.equal(activeSidebarScreen("analysis"), "vault");
  assert.equal(activeSidebarScreen("review"), "vault");
  assert.equal(activeSidebarScreen("insightDetail"), "insights");
  assert.equal(activeSidebarScreen("decisionConfirm"), "proposalVote");
  assert.equal(activeSidebarScreen("verificationDetail"), "verification");
  assert.equal(activeSidebarScreen("outcome"), "verification");
});

test("sidebar menus follow the login role", () => {
  assert.deepEqual(
    sidebarItemsForRole("admin").map((item) => item.screen),
    ["dashboard", "vault", "objects", "workflow", "metrics", "insights", "proposalVote", "verification", "organization", "settings"]
  );
  assert.deepEqual(
    sidebarItemsForRole("manager").map((item) => item.screen),
    ["dashboard", "vault", "objects", "workflow", "metrics", "insights", "proposalVote", "verification"]
  );
  assert.deepEqual(
    sidebarItemsForRole("member").map((item) => item.screen),
    ["dashboard", "proposalVote"]
  );
});

test("hidden screens resolve to the nearest permitted role screen", () => {
  assert.equal(permittedScreenForRole("admin", "organization"), "organization");
  assert.equal(permittedScreenForRole("manager", "organization"), "dashboard");
  assert.equal(permittedScreenForRole("manager", "verificationDetail"), "verificationDetail");
  assert.equal(permittedScreenForRole("member", "vault"), "dashboard");
  assert.equal(permittedScreenForRole("member", "decisionConfirm"), "proposalVote");
  assert.equal(permittedScreenForRole("member", "verificationDetail"), "dashboard");
});

test("protected screens fall back to login when session is missing", () => {
  assert.equal(screenRequiresLogin("home"), false);
  assert.equal(screenRequiresLogin("login"), false);
  assert.equal(screenRequiresLogin("workspace"), true);
  assert.equal(accessibleScreenForSession(false, "member", "dashboard"), "login");
  assert.equal(accessibleScreenForSession(false, "manager", "workspace"), "login");
  assert.equal(accessibleScreenForSession(false, "admin", "organization"), "login");
  assert.equal(accessibleScreenForSession(true, "member", "workspace"), "workspace");
  assert.equal(accessibleScreenForSession(true, "member", "decisionConfirm"), "proposalVote");
});

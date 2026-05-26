import assert from "node:assert/strict";
import test from "node:test";
import { accessibleScreenForSession, activeSidebarScreen, permittedScreenForRole, screenRequiresLogin, sidebarItemsForRole } from "../prototype/navigation";
import { pathForScreen, routeSegments, screenFromPathname } from "../prototype/routes";

test("service screens have stable URL routes", () => {
  assert.equal(pathForScreen("home"), "/");
  assert.equal(pathForScreen("signup"), "/signup");
  assert.equal(pathForScreen("dashboard"), "/dashboard");
  assert.equal(pathForScreen("vault"), "/vault");
  assert.equal(pathForScreen("proposalVote"), "/proposal-vote");
  assert.equal(screenFromPathname("/analysis"), "analysis");
  assert.equal(screenFromPathname("/upload"), "upload");
  assert.equal(screenFromPathname("/company"), "home");
  assert.equal(screenFromPathname("/review/"), "review");
  assert.equal(screenFromPathname("/signup"), "signup");
  assert.equal(routeSegments().includes("verification-detail"), true);
  assert.equal(routeSegments().includes("signup"), true);
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
  const allScreens = ["dashboard", "vault", "objects", "workflow", "metrics", "insights", "proposalVote", "verification", "organization", "settings"];
  assert.deepEqual(
    sidebarItemsForRole("owner").map((item) => item.screen),
    allScreens
  );
  assert.deepEqual(
    sidebarItemsForRole("manager").map((item) => item.screen),
    allScreens
  );
  assert.deepEqual(
    sidebarItemsForRole("member").map((item) => item.screen),
    allScreens
  );
});

test("all approved roles can access every protected screen", () => {
  assert.equal(permittedScreenForRole("owner", "organization"), "organization");
  assert.equal(permittedScreenForRole("manager", "organization"), "organization");
  assert.equal(permittedScreenForRole("manager", "verificationDetail"), "verificationDetail");
  assert.equal(permittedScreenForRole("member", "vault"), "vault");
  assert.equal(permittedScreenForRole("member", "decisionConfirm"), "decisionConfirm");
  assert.equal(permittedScreenForRole("member", "verificationDetail"), "verificationDetail");
});

test("protected screens fall back to login when session is missing", () => {
  assert.equal(screenRequiresLogin("home"), false);
  assert.equal(screenRequiresLogin("login"), false);
  assert.equal(screenRequiresLogin("signup"), false);
  assert.equal(screenRequiresLogin("workspace"), true);
  assert.equal(accessibleScreenForSession(false, "member", "dashboard"), "login");
  assert.equal(accessibleScreenForSession(false, "member", "signup"), "signup");
  assert.equal(accessibleScreenForSession(false, "manager", "workspace"), "login");
  assert.equal(accessibleScreenForSession(false, "owner", "organization"), "login");
  assert.equal(accessibleScreenForSession(true, "member", "workspace"), "workspace");
  assert.equal(accessibleScreenForSession(true, "member", "decisionConfirm"), "decisionConfirm");
  assert.equal(accessibleScreenForSession(true, "member", "organization", false), "workspace");
  assert.equal(accessibleScreenForSession(true, "owner", "dashboard", false), "workspace");
});

import assert from "node:assert/strict";
import test from "node:test";
import { accessibleScreenForSession, activeSidebarScreen, permittedScreenForRole, screenRequiresLogin, sidebarItemsForRole } from "../prototype/navigation";
import { pathForScreen, routeSegments, screenFromPathname } from "../prototype/routes";

test("service screens have stable company URL routes", () => {
  assert.equal(pathForScreen("home"), "/");
  assert.equal(pathForScreen("signup"), "/signup");
  assert.equal(pathForScreen("dashboard"), "/dashboard");
  assert.equal(pathForScreen("company"), "/company");
  assert.equal(pathForScreen("vault"), "/vault");
  assert.equal(pathForScreen("proposalVote"), "/proposal-vote");
  assert.equal(screenFromPathname("/analysis"), "analysis");
  assert.equal(screenFromPathname("/upload"), "upload");
  assert.equal(screenFromPathname("/company"), "company");
  assert.equal(screenFromPathname("/review/"), "review");
  assert.equal(routeSegments().includes("company"), true);
  assert.equal(routeSegments().includes("signup"), true);
  assert.equal(routeSegments().includes("verification-detail"), true);
  assert.equal(routeSegments().includes(["work", "space"].join("")), false);
});

test("nested service screens keep their parent sidebar highlight", () => {
  assert.equal(activeSidebarScreen("analysis"), "vault");
  assert.equal(activeSidebarScreen("review"), "vault");
  assert.equal(activeSidebarScreen("insightDetail"), "insights");
  assert.equal(activeSidebarScreen("decisionConfirm"), "proposalVote");
  assert.equal(activeSidebarScreen("verificationDetail"), "verification");
  assert.equal(activeSidebarScreen("outcome"), "verification");
});

test("sidebar menus follow owner and manager roles", () => {
  const allScreens = ["dashboard", "vault", "objects", "workflow", "metrics", "insights", "proposalVote", "verification", "company", "settings"];
  assert.deepEqual(
    sidebarItemsForRole("owner").map((item) => item.screen),
    allScreens
  );
  assert.deepEqual(
    sidebarItemsForRole("manager").map((item) => item.screen),
    allScreens
  );
});

test("all approved enterprise roles can access protected screens", () => {
  assert.equal(permittedScreenForRole("owner", "company"), "company");
  assert.equal(permittedScreenForRole("manager", "company"), "company");
  assert.equal(permittedScreenForRole("manager", "verificationDetail"), "verificationDetail");
  assert.equal(permittedScreenForRole("manager", "decisionConfirm"), "decisionConfirm");
});

test("protected screens fall back to login when session or company access is missing", () => {
  assert.equal(screenRequiresLogin("home"), false);
  assert.equal(screenRequiresLogin("login"), false);
  assert.equal(screenRequiresLogin("signup"), false);
  assert.equal(screenRequiresLogin("company"), true);
  assert.equal(accessibleScreenForSession(false, "manager", "dashboard"), "login");
  assert.equal(accessibleScreenForSession(false, "manager", "signup"), "signup");
  assert.equal(accessibleScreenForSession(false, "owner", "company"), "login");
  assert.equal(accessibleScreenForSession(true, "manager", "decisionConfirm"), "decisionConfirm");
  assert.equal(accessibleScreenForSession(true, "owner", "dashboard", false), "login");
});

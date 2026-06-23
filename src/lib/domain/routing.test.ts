import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { accessibleScreenForSession, activeSidebarScreen, permittedScreenForRole, screenRequiresLogin, sidebarItemsForRole } from "../prototype/navigation";
import { pathForScreen, routeSegments, screenFromPathname } from "../prototype/routes";

test("service screens have stable company URL routes", () => {
  assert.equal(pathForScreen("home"), "/");
  assert.equal(pathForScreen("signup"), "/signup");
  assert.equal(pathForScreen("dashboard"), "/dashboard");
  assert.equal(pathForScreen("company"), "/company");
  assert.equal(pathForScreen("vault"), "/vault");
  assert.equal(pathForScreen("structureMap"), "/structure-map");
  assert.equal(pathForScreen("ai"), "/ai");
  assert.equal(pathForScreen("proposalVote"), "/proposal-vote");
  assert.equal(screenFromPathname("/upload"), "upload");
  assert.equal(screenFromPathname("/company"), "company");
  assert.equal(screenFromPathname("/structure-map"), "structureMap");
  assert.equal(screenFromPathname("/ai"), "ai");
  assert.equal(screenFromPathname("/analysis"), "home");
  assert.equal(screenFromPathname("/review/"), "home");
  assert.equal(routeSegments().includes("company"), true);
  assert.equal(routeSegments().includes("signup"), true);
  assert.equal(routeSegments().includes("verification-detail"), true);
  assert.equal(routeSegments().includes("analysis"), false);
  assert.equal(routeSegments().includes("review"), false);
  assert.equal(routeSegments().includes(["work", "space"].join("")), false);
});

test("nested service screens keep their parent sidebar highlight", () => {
  assert.equal(activeSidebarScreen("insightDetail"), "insights");
  assert.equal(activeSidebarScreen("decisionConfirm"), "proposalVote");
  assert.equal(activeSidebarScreen("verificationDetail"), "verification");
  assert.equal(activeSidebarScreen("outcome"), "verification");
});

test("detail screens show breadcrumbs and keep list navigation at the bottom", () => {
  const sectionTitleSource = readFileSync("src/components/ui/Card.tsx", "utf8");
  const decisionSource = readFileSync("src/features/decisions/DecisionScreens.tsx", "utf8");
  const insightSource = readFileSync("src/features/insights/InsightScreens.tsx", "utf8");
  const verificationSource = readFileSync("src/features/verification/VerificationScreens.tsx", "utf8");

  assert.match(sectionTitleSource, /aria-label="현재 위치"/);
  assert.match(sectionTitleSource, /breadcrumbItems/);
  assert.match(decisionSource, /breadcrumb=\{\["의사결정", "의사결정 상세"\]\}/);
  assert.match(insightSource, /breadcrumb=\{\["인사이트", "인사이트 상세"\]\}/);
  assert.match(verificationSource, /breadcrumb=\{\["검증 기록", "검증 상세"\]\}/);
  assert.match(decisionSource, /<div className="flex justify-start">\s*<Button variant="secondary" onClick=\{\(\) => commands\.navigate\("proposalVote"\)\}>목록으로 돌아가기<\/Button>/);
  assert.match(insightSource, /<div className="flex justify-start">\s*<Button variant="secondary" onClick=\{\(\) => commands\.navigate\("insights"\)\}>목록으로 돌아가기<\/Button>/);
  assert.match(verificationSource, /<div className="flex justify-start">\s*<Button variant="secondary" onClick=\{\(\) => commands\.navigate\("verification"\)\}>목록으로 돌아가기<\/Button>/);
});

test("sidebar menus follow owner and manager roles", () => {
  const allScreens = ["dashboard", "vault", "structureMap", "objects", "workflow", "metrics", "insights", "ai", "proposalVote", "verification", "company", "settings"];
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
  assert.equal(permittedScreenForRole("manager", "structureMap"), "structureMap");
  assert.equal(permittedScreenForRole("manager", "ai"), "ai");
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

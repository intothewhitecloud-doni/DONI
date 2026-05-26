import type { Role, Screen } from "../domain/types";

export type SidebarNavItem = {
  screen: Screen;
  label: string;
  short: string;
};

export const sidebarNavItems: SidebarNavItem[] = [
  { screen: "dashboard", label: "대시보드", short: "대" },
  { screen: "vault", label: "데이터 보관함", short: "보" },
  { screen: "objects", label: "관리 대상", short: "관" },
  { screen: "workflow", label: "업무 흐름", short: "흐" },
  { screen: "metrics", label: "지표", short: "지" },
  { screen: "insights", label: "인사이트", short: "인" },
  { screen: "proposalVote", label: "의사결정", short: "의" },
  { screen: "verification", label: "검증 기록", short: "검" },
  { screen: "organization", label: "조직 관리", short: "조" },
  { screen: "settings", label: "설정", short: "설" }
];

const allSidebarScreens = sidebarNavItems.map((item) => item.screen);

const sidebarScreensByRole: Record<Role, Screen[]> = {
  manager: allSidebarScreens,
  member: allSidebarScreens,
  owner: allSidebarScreens
};

const protectedScreens = [
  "upload",
  "analysis",
  "review",
  "dashboard",
  "vault",
  "objects",
  "workflow",
  "metrics",
  "insights",
  "insightDetail",
  "proposalCreate",
  "proposalVote",
  "decisionConfirm",
  "verification",
  "verificationDetail",
  "organization",
  "settings",
  "outcome"
] satisfies Screen[];

const protectedScreensByRole: Record<Role, Screen[]> = {
  manager: protectedScreens,
  member: protectedScreens,
  owner: protectedScreens
};

const sidebarParents: Partial<Record<Screen, Screen>> = {
  analysis: "vault",
  decisionConfirm: "proposalVote",
  insightDetail: "insights",
  outcome: "verification",
  proposalCreate: "insights",
  review: "vault",
  upload: "vault",
  verificationDetail: "verification"
};

export function activeSidebarScreen(screen: Screen): Screen {
  return sidebarParents[screen] ?? screen;
}

export function sidebarItemsForRole(role: Role): SidebarNavItem[] {
  const allowedScreens = sidebarScreensByRole[role];
  return sidebarNavItems.filter((item) => allowedScreens.includes(item.screen));
}

export function canAccessProtectedScreen(role: Role, screen: Screen): boolean {
  return protectedScreensByRole[role].includes(screen);
}

export function defaultScreenForRole(role: Role, requestedScreen?: Screen): Screen {
  return "dashboard";
}

export function permittedScreenForRole(role: Role, screen: Screen): Screen {
  return canAccessProtectedScreen(role, screen) ? screen : defaultScreenForRole(role, screen);
}

export function screenRequiresLogin(screen: Screen): boolean {
  return screen !== "home" && screen !== "login" && screen !== "signup";
}

export function accessibleScreenForSession(loggedIn: boolean, role: Role, screen: Screen, hasActiveWorkspace = true): Screen {
  if (!loggedIn && screenRequiresLogin(screen)) {
    return "login";
  }

  if (screen === "home" || screen === "login" || screen === "signup" || screen === "workspace") {
    return screen;
  }

  if (!hasActiveWorkspace) {
    return "workspace";
  }

  return permittedScreenForRole(role, screen);
}

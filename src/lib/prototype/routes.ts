import type { Screen } from "../domain/types";

export const screenRoutes: Record<Screen, string> = {
  home: "/",
  login: "/login",
  signup: "/signup",
  upload: "/upload",
  analysis: "/analysis",
  review: "/review",
  dashboard: "/dashboard",
  vault: "/vault",
  structureMap: "/structure-map",
  ai: "/ai",
  objects: "/objects",
  workflow: "/workflow",
  metrics: "/metrics",
  insights: "/insights",
  insightDetail: "/insight-detail",
  proposalCreate: "/proposal-create",
  proposalVote: "/proposal-vote",
  decisionConfirm: "/decision-confirm",
  verification: "/verification",
  verificationDetail: "/verification-detail",
  company: "/company",
  settings: "/settings",
  outcome: "/outcome"
};

const routeScreens = Object.entries(screenRoutes).reduce<Record<string, Screen>>((accumulator, [screen, path]) => {
  accumulator[path] = screen as Screen;
  return accumulator;
}, {});

export function pathForScreen(screen: Screen): string {
  return screenRoutes[screen];
}

export function routeSegments(): string[] {
  return Object.values(screenRoutes)
    .filter((path) => path !== "/")
    .map((path) => path.slice(1));
}

export function screenFromPathname(pathname: string): Screen {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  return routeScreens[normalized] ?? "home";
}

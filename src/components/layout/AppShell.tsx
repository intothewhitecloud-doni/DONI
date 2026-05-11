"use client";

import { useEffect, useState } from "react";
import { Badge } from "../ui/Badge";
import { OrganizationScreen, SettingsScreen } from "../../features/admin/AdminScreens";
import { DashboardScreen } from "../../features/dashboard/DashboardScreen";
import { DataVaultScreen, ManagedObjectsScreen, MetricsScreen, WorkflowScreen } from "../../features/data-review/DataScreens";
import { DecisionConfirmScreen, ProposalVoteScreen } from "../../features/decisions/DecisionScreens";
import { InsightDetailScreen, InsightsScreen, ProposalCreateScreen } from "../../features/insights/InsightScreens";
import { AnalysisScreen, HomeScreen, LoginScreen, ReviewScreen, WorkspaceScreen } from "../../features/onboarding/OnboardingScreens";
import { OutcomeScreen, VerificationDetailScreen, VerificationListScreen } from "../../features/verification/VerificationScreens";
import type { Screen } from "../../lib/domain/types";
import { accessibleScreenForSession, activeSidebarScreen, sidebarItemsForRole } from "../../lib/prototype/navigation";
import { roleLabel } from "../../lib/prototype/permissions";
import { currentUser, currentWorkspace } from "../../lib/prototype/selectors";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

const publicScreens: Screen[] = ["home", "login", "workspace"];

export function AppShell({ screen }: { screen: Screen }) {
  const { commands, state } = usePrototype();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = currentUser(state);
  const workspace = currentWorkspace(state);
  const visibleNavItems = sidebarItemsForRole(state.session.role);
  const screenToRender = accessibleScreenForSession(state.session.loggedIn, state.session.role, screen);
  const activeScreen = activeSidebarScreen(screenToRender);

  useEffect(() => {
    if (screenToRender !== screen && state.screen !== screenToRender) {
      commands.navigate(screenToRender);
    }
  }, [commands, screen, screenToRender, state.screen]);

  if (publicScreens.includes(screenToRender)) {
    return (
      <>
        <Notice />
        {renderScreen(screenToRender)}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-body">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-hairline bg-white px-4 py-5 shadow-[4px_0_24px_rgba(0,0,0,0.03)] transition md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-start gap-1.5">
            <img src="/assets/logo.svg" alt="DONI" className="h-12 w-auto" />
            <p className="pl-0.5 text-caption text-muted">운영 콘솔</p>
          </div>
          <button className="rounded-md px-2 py-1 text-button md:hidden" onClick={() => setMobileOpen(false)}>닫기</button>
        </div>
        <nav className="mt-8 space-y-1">
          {visibleNavItems.map((item) => (
            <button
              key={item.screen}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-nav-link transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${activeScreen === item.screen ? "bg-brand-accent/10 text-brand-accent font-semibold shadow-sm" : "text-muted hover:bg-surface-soft hover:text-ink"
                }`}
              onClick={() => {
                commands.navigate(item.screen);
                setMobileOpen(false);
              }}
            >
              <span className={`flex size-7 items-center justify-center rounded-md text-caption shadow-sm ${activeScreen === item.screen ? "bg-brand-accent text-white" : "bg-canvas border border-hairline text-ink"}`}>{item.short}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <header className="fixed inset-x-0 top-0 z-30 border-b border-hairline bg-white/95 backdrop-blur shadow-[0_4px_24px_rgba(0,0,0,0.03)] md:left-72">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button className="rounded-md border border-hairline px-3 py-2 text-button md:hidden" onClick={() => setMobileOpen(true)}>메뉴</button>
            <WorkspaceSwitchButton workspaceName={workspace.name} onClick={() => commands.navigate("workspace")} />
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="info">{roleLabel(state.session.role)}</Badge>
            <span className="hidden text-title-sm text-ink sm:inline">{user.name}</span>
            <ButtonLike onClick={commands.logout}>로그아웃</ButtonLike>
          </div>
        </div>
      </header>
      <main className="min-h-screen px-4 pb-12 pt-36 md:pl-[19.5rem] md:pr-6">
        <Notice />
        <div className="w-full">
          {renderScreen(screenToRender)}
        </div>
      </main>
    </div>
  );
}

function WorkspaceSwitchButton({ onClick, workspaceName }: { onClick: () => void; workspaceName: string }) {
  return (
    <button
      className="group inline-flex max-w-[58vw] items-center gap-1 rounded-full bg-surface-soft p-1 text-left transition hover:bg-surface-strong md:max-w-md"
      title="워크스페이스 선택 화면으로 이동"
      onClick={onClick}
    >
      <span className="min-w-0 rounded-full bg-canvas px-3 py-1.5 shadow-soft">
        <span className="block text-caption leading-4 text-muted">현재 그룹</span>
        <span className="block truncate text-title-sm leading-5 text-ink">{workspaceName}</span>
      </span>
      <span className="shrink-0 px-3 py-1.5 text-caption text-muted hover:text-ink">워크스페이스 변경</span>
    </button>
  );
}

function ButtonLike({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      className="rounded-md border border-error/20 bg-error/5 px-3 py-2 text-button text-error transition hover:bg-error/10"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Notice() {
  const { commands, state } = usePrototype();
  const message = state.permissionDenied ?? state.simulatedError;

  if (!message) {
    return null;
  }

  return (
    <div className="fixed right-4 top-20 z-50 max-w-sm rounded-lg border border-warning/30 bg-warning/10 p-4 text-body-sm text-warning shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <p>{message}</p>
        <button className="font-bold hover:text-ink" onClick={commands.clearNotice}>닫기</button>
      </div>
    </div>
  );
}

function renderScreen(screen: Screen) {
  switch (screen) {
    case "login":
      return <LoginScreen />;
    case "home":
      return <HomeScreen />;
    case "workspace":
      return <WorkspaceScreen />;
    case "upload":
      return <DataVaultScreen />;
    case "analysis":
      return <AnalysisScreen />;
    case "review":
      return <ReviewScreen />;
    case "dashboard":
      return <DashboardScreen />;
    case "vault":
      return <DataVaultScreen />;
    case "objects":
      return <ManagedObjectsScreen />;
    case "workflow":
      return <WorkflowScreen />;
    case "metrics":
      return <MetricsScreen />;
    case "insights":
      return <InsightsScreen />;
    case "insightDetail":
      return <InsightDetailScreen />;
    case "proposalCreate":
      return <ProposalCreateScreen />;
    case "proposalVote":
      return <ProposalVoteScreen />;
    case "decisionConfirm":
      return <DecisionConfirmScreen />;
    case "verification":
      return <VerificationListScreen />;
    case "verificationDetail":
      return <VerificationDetailScreen />;
    case "organization":
      return <OrganizationScreen />;
    case "settings":
      return <SettingsScreen />;
    case "outcome":
      return <OutcomeScreen />;
    default:
      return <DashboardScreen />;
  }
}

"use client";

import { useEffect, useState } from "react";
import { Badge } from "../ui/Badge";
import { CompanyManagementScreen, SettingsScreen } from "../../features/admin/AdminScreens";
import { DashboardScreen } from "../../features/dashboard/DashboardScreen";
import { DataVaultScreen, ManagedObjectsScreen, MetricsScreen, WorkflowScreen } from "../../features/data-review/DataScreens";
import { DecisionConfirmScreen, ProposalVoteScreen } from "../../features/decisions/DecisionScreens";
import { InsightDetailScreen, InsightsScreen, ProposalCreateScreen } from "../../features/insights/InsightScreens";
import { AnalysisScreen, HomeScreen, LoginScreen, ReviewScreen, SignupScreen } from "../../features/onboarding/OnboardingScreens";
import { OutcomeScreen, VerificationDetailScreen, VerificationListScreen } from "../../features/verification/VerificationScreens";
import { AiChatDock } from "../../features/ai-chat/AiChatPanel";
import type { Screen } from "../../lib/domain/types";
import { accessibleScreenForSession, activeSidebarScreen, sidebarItemsForRole } from "../../lib/prototype/navigation";
import { roleLabel } from "../../lib/prototype/permissions";
import { currentCompany, currentCompanyUser, currentUser, hasActiveCompanySession } from "../../lib/prototype/selectors";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

const publicScreens: Screen[] = ["home", "login", "signup"];

export function AppShell({ screen }: { screen: Screen }) {
  const { commands, state } = usePrototype();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = currentUser(state);
  const company = currentCompany(state);
  const companyUser = currentCompanyUser(state);
  const displayRole = companyUser?.status === "active" ? companyUser.role : state.session.role;
  const visibleNavItems = sidebarItemsForRole(displayRole);
  const screenToRender = accessibleScreenForSession(state.session.loggedIn, displayRole, screen, hasActiveCompanySession(state));
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
      <AiChatDock />
      {mobileOpen && (
        <button
          aria-label="메뉴 닫기"
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          type="button"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-hairline bg-white px-4 py-5 shadow-[4px_0_24px_rgba(0,0,0,0.03)] transition-transform duration-200 lg:w-20 lg:translate-x-0 lg:px-3 xl:w-64 xl:px-4 ${mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col items-start gap-1.5 lg:items-center xl:items-start">
            <img src="/assets/logo.svg" alt="DONI" className="h-12 w-auto lg:h-10 xl:h-12" />
            <p className="pl-0.5 text-caption text-muted lg:hidden xl:block">기업 운영 콘솔</p>
          </div>
          <button className="shrink-0 rounded-md px-2 py-1 text-button lg:hidden" type="button" onClick={() => setMobileOpen(false)}>닫기</button>
        </div>
        <nav className="mt-8 space-y-1">
          {visibleNavItems.map((item) => (
            <button
              key={item.screen}
              className={`flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left text-nav-link transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:justify-center lg:px-2 xl:justify-start xl:px-3 ${activeScreen === item.screen ? "bg-brand-accent/10 text-brand-accent font-semibold shadow-sm" : "text-muted hover:bg-surface-soft hover:text-ink"
                }`}
              onClick={() => {
                commands.navigate(item.screen);
                setMobileOpen(false);
              }}
              title={item.label}
              type="button"
            >
              <span className={`flex size-7 items-center justify-center rounded-md text-caption shadow-sm ${activeScreen === item.screen ? "bg-brand-accent text-white" : "bg-canvas border border-hairline text-ink"}`}>{item.short}</span>
              <span className="min-w-0 truncate lg:hidden xl:block">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <header className="fixed inset-x-0 top-0 z-20 border-b border-hairline bg-white/95 backdrop-blur shadow-[0_4px_24px_rgba(0,0,0,0.03)] lg:left-20 xl:left-64">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-5 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button className="shrink-0 rounded-md border border-hairline px-3 py-2 text-button lg:hidden" type="button" onClick={() => setMobileOpen(true)}>메뉴</button>
            <CompanyPill companyName={company.name} />
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <Badge tone="info">{roleLabel(displayRole)}</Badge>
            <span className="hidden max-w-32 truncate whitespace-nowrap text-title-sm text-ink sm:inline xl:max-w-48">{user.name}</span>
            <ButtonLike onClick={commands.logout}>로그아웃</ButtonLike>
          </div>
        </div>
      </header>
      <main className="min-h-screen px-4 pb-12 pt-24 sm:px-5 lg:pl-[6.5rem] lg:pr-5 xl:pl-[17.5rem] xl:pr-8">
        <Notice />
        <div className="mx-auto w-full max-w-[1180px] 2xl:max-w-[1280px]">
          {renderScreen(screenToRender)}
        </div>
      </main>
    </div>
  );
}

function CompanyPill({ companyName }: { companyName: string }) {
  return (
    <div className="inline-flex min-w-0 max-w-[52vw] items-center gap-1 rounded-full bg-surface-soft p-1 text-left sm:max-w-md">
      <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-canvas px-3 py-1.5 shadow-soft">
        <span className="shrink-0 whitespace-nowrap text-caption leading-4 text-muted">현재 기업</span>
        <span className="min-w-0 max-w-28 truncate whitespace-nowrap text-title-sm leading-5 text-ink sm:max-w-40" title={companyName}>{companyName}</span>
      </span>
      <span className="hidden shrink-0 whitespace-nowrap px-3 py-1.5 text-caption text-muted sm:inline">단일 콘솔</span>
    </div>
  );
}

function ButtonLike({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      className="shrink-0 whitespace-nowrap rounded-md border border-error/20 bg-error/5 px-3 py-2 text-button text-error transition hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      onClick={onClick}
      type="button"
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
    <div className="fixed left-4 right-4 top-20 z-50 rounded-lg border border-warning/30 bg-warning/10 p-4 text-body-sm text-warning shadow-soft sm:left-auto sm:max-w-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0">{message}</p>
        <button className="shrink-0 whitespace-nowrap font-bold hover:text-ink" type="button" onClick={commands.clearNotice}>닫기</button>
      </div>
    </div>
  );
}

function renderScreen(screen: Screen) {
  switch (screen) {
    case "login":
      return <LoginScreen />;
    case "signup":
      return <SignupScreen />;
    case "home":
      return <HomeScreen />;
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
    case "company":
      return <CompanyManagementScreen />;
    case "settings":
      return <SettingsScreen />;
    case "outcome":
      return <OutcomeScreen />;
    default:
      return <DashboardScreen />;
  }
}

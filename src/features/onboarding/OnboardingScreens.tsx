"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { demoAccounts } from "../../lib/prototype/authAccounts";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

const homeHighlights = [
  { label: "대상·이벤트 정의", title: "업무 구조 정리" },
  { label: "관계·지표 분석", title: "영향 신호 탐지" },
  { label: "의사결정 검증", title: "안건 실행 추적" }
];

const productPreviewRows = [
  { label: "주요 관리 대상", value: "고객군 · 공급사 · 상품군", tone: "info" as const },
  { label: "업무 흐름", value: "주문 접수 -> 출고 -> 클레임", tone: "neutral" as const },
  { label: "검증 루프", value: "안건 · 투표 · 해시 · 재분석", tone: "success" as const }
];

export function HomeScreen() {
  const { commands } = usePrototype();

  return (
    <main className="min-h-screen bg-canvas px-6 py-8 text-body sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <img src="/assets/logo.svg" alt="DONI" className="h-10 w-auto" />
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
          <div className="min-w-0 space-y-7">
            <Badge tone="info">기업 의사결정 운영 플랫폼</Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-display-lg text-ink md:text-display-xl">DONI 기업 콘솔</h1>
              <p className="max-w-2xl text-title-md text-body">
                기업 데이터를 관리 대상과 업무 이벤트로 정리하고, 연결 관계와 지표 분석을 통해 실행 가능한 의사결정을 안건, 투표, 검증, 재분석까지 연결합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => commands.navigate("login")}>콘솔 접속</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {homeHighlights.map((item) => (
                <div key={item.label} className="rounded-lg border border-hairline bg-surface-soft p-4">
                  <p className="truncate whitespace-nowrap text-caption text-muted" title={item.label}>{item.label}</p>
                  <p className="mt-2 text-title-sm text-ink">{item.title}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-hairline bg-surface-soft p-4 shadow-soft">
            <div className="rounded-lg border border-hairline-soft bg-canvas">
              <div className="flex items-center justify-between gap-3 border-b border-hairline-soft px-4 py-3">
                <div className="min-w-0">
                  <p className="text-caption text-brand-accent">운영 구조 대시보드</p>
                  <p className="truncate text-title-sm text-ink">넥스트 제조 의사결정 콘솔</p>
                </div>
                <Badge tone="success">검증 가능</Badge>
              </div>
              <div className="grid gap-3 p-4">
                {productPreviewRows.map((row) => (
                  <div key={row.label} className="grid min-w-0 gap-3 rounded-lg border border-hairline-soft bg-white p-4 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-center">
                    <p className="whitespace-nowrap text-caption text-muted">{row.label}</p>
                    <p className="truncate text-title-sm text-ink">{row.value}</p>
                    <Badge tone={row.tone}>연결됨</Badge>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 border-t border-hairline-soft p-4 sm:grid-cols-3">
                <div>
                  <p className="text-caption text-muted">분석 파일</p>
                  <p className="text-title-lg text-ink">12</p>
                </div>
                <div>
                  <p className="text-caption text-muted">후보 항목</p>
                  <p className="text-title-lg text-ink">48</p>
                </div>
                <div>
                  <p className="text-caption text-muted">검증 기록</p>
                  <p className="text-title-lg text-ink">7</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthLayout({
  badge,
  children,
  description,
  side,
  title
}: {
  badge: string;
  children: ReactNode;
  description: string;
  side: ReactNode;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-canvas px-6 py-10 sm:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)]">
        <section className="min-w-0 space-y-6">
          <Badge tone="info">{badge}</Badge>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-display-md text-ink md:text-display-lg">{title}</h1>
            <p className="max-w-2xl text-body-md leading-7 text-body">{description}</p>
          </div>
          {side}
        </section>
        <Card className="space-y-4" motion="reveal">
          {children}
        </Card>
      </div>
    </main>
  );
}

function AuthField({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="block text-sm font-medium text-body">
      <span className="whitespace-nowrap">{label}</span>
      {children}
    </label>
  );
}

function authInputClass(hasError = false) {
  return `mt-1 w-full rounded-md border px-3 py-2 text-body-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-error/50 bg-error/5" : "border-hairline-soft bg-white"
  }`;
}

export function LoginScreen() {
  const { commands, state } = usePrototype();
  const [loginId, setLoginId] = useState("owner01");
  const [password, setPassword] = useState("owner01!");
  const loginFeedback = state.permissionDenied;

  function submit() {
    commands.login(loginId, password);
  }

  return (
    <AuthLayout
      badge="1개 기업 · 1개 콘솔"
      title="기업 코드 기반 승인형 콘솔"
      description="하나의 기업 코드로 운영 데이터와 의사결정 흐름을 관리합니다."
      side={
        <div className="rounded-lg border border-hairline bg-surface-soft p-4 text-body-sm shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-ink">데모 계정</p>
            <Badge tone="neutral">테스트 가능</Badge>
          </div>
          <ul className="mt-3 grid gap-2">
            {demoAccounts.map((account) => (
              <li key={account.loginId}>
                <button
                  className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border border-hairline-soft bg-white px-3 py-2 text-left transition hover:border-primary/40 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  type="button"
                  onClick={() => {
                    setLoginId(account.loginId);
                    setPassword(account.password);
                  }}
                >
                  <span className="truncate font-semibold text-ink">{account.loginId} / {account.password}</span>
                  <Badge tone={account.role === "owner" ? "success" : "info"}>{account.role === "owner" ? "기업 소유자" : "기업 관리자"}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <SectionTitle title="로그인" variant="section" />
      {loginFeedback && (
        <div
          aria-live="assertive"
          className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error"
          role="alert"
        >
          {loginFeedback}
        </div>
      )}
      <AuthField label="아이디">
        <input
          aria-invalid={Boolean(loginFeedback)}
          className={authInputClass(Boolean(loginFeedback))}
          value={loginId}
          onChange={(event) => setLoginId(event.target.value)}
        />
      </AuthField>
      <AuthField label="비밀번호">
        <input
          aria-invalid={Boolean(loginFeedback)}
          className={authInputClass(Boolean(loginFeedback))}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              submit();
            }
          }}
        />
      </AuthField>
      <Button className="w-full" onClick={submit}>로그인</Button>
      <Button variant="secondary" className="w-full" onClick={() => commands.navigate("signup")}>회원가입</Button>
    </AuthLayout>
  );
}

export function SignupScreen() {
  const { commands, state } = usePrototype();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  function submit() {
    commands.signup({ code, email, name, password });
  }

  return (
    <AuthLayout
      badge="회사코드 필수"
      title="승인 대기 계정 신청"
      description="회사코드를 입력해 신청하면 기업 소유자 승인 후 접속할 수 있습니다."
      side={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-hairline bg-surface-soft p-4">
            <p className="text-caption text-muted">신청 단계</p>
            <p className="mt-2 text-title-sm text-ink">회사코드 확인</p>
          </div>
          <div className="rounded-lg border border-hairline bg-surface-soft p-4">
            <p className="text-caption text-muted">접속 기준</p>
            <p className="mt-2 text-title-sm text-ink">소유자 승인 후 로그인</p>
          </div>
        </div>
      }
    >
      <SectionTitle title="회원가입" description="가입 완료 후 로그인 화면에서 승인 대기 안내가 표시됩니다." variant="section" />
      {state.permissionDenied && <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">{state.permissionDenied}</div>}
      <AuthField label="이름">
        <input className={authInputClass()} value={name} onChange={(event) => setName(event.target.value)} />
      </AuthField>
      <AuthField label="이메일">
        <input className={authInputClass()} value={email} onChange={(event) => setEmail(event.target.value)} />
      </AuthField>
      <AuthField label="비밀번호">
        <input className={authInputClass()} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </AuthField>
      <AuthField label="회사코드">
        <input required className={authInputClass()} value={code} onChange={(event) => setCode(event.target.value)} placeholder="예: DONI-NEXT-4821" />
      </AuthField>
      <Button className="w-full" onClick={submit}>승인 요청</Button>
      <Button variant="secondary" className="w-full" onClick={() => commands.navigate("login")}>로그인으로 이동</Button>
    </AuthLayout>
  );
}

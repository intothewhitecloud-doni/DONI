import type { PropsWithChildren } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "orange" | "pink" | "violet" | "emerald";

const toneClass: Record<Tone, string> = {
  neutral: "border-hairline bg-surface-card text-ink",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-error/30 bg-error/10 text-error",
  info: "border-brand-accent/30 bg-brand-accent/10 text-brand-accent",
  orange: "border-badge-orange/30 bg-badge-orange/10 text-badge-orange",
  pink: "border-badge-pink/30 bg-badge-pink/10 text-badge-pink",
  violet: "border-badge-violet/30 bg-badge-violet/10 text-badge-violet",
  emerald: "border-badge-emerald/30 bg-badge-emerald/10 text-badge-emerald"
};

export function Badge({ children, tone = "neutral" }: PropsWithChildren<{ tone?: Tone }>) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass[tone]}`}>{children}</span>;
}


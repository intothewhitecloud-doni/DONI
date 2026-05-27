import type { HTMLAttributes, PropsWithChildren } from "react";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "orange" | "pink" | "violet" | "emerald";

const toneClass: Record<BadgeTone, string> = {
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

export function Badge({
  children,
  className = "",
  tone = "neutral",
  title,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }>) {
  const fallbackTitle = typeof children === "string" ? children : undefined;

  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap ${toneClass[tone]} ${className}`}
      title={title ?? fallbackTitle}
      {...props}
    >
      {children}
    </span>
  );
}

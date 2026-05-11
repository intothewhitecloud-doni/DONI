"use client";

import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Badge } from "./Badge";

type PopupTone = "neutral" | "success" | "warning" | "danger" | "info";
type PopupSize = "sm" | "md" | "lg";

const sizeClass: Record<PopupSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl"
};

export function Popup({
  children,
  closeLabel = "닫기",
  eyebrow = "알림",
  footer,
  onClose,
  size = "md",
  title,
  tone = "info"
}: {
  children: ReactNode;
  closeLabel?: string;
  eyebrow?: string;
  footer?: ReactNode;
  onClose: () => void;
  size?: PopupSize;
  title: string;
  tone?: PopupTone;
}) {
  const titleId = useId();

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6"
      role="dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.section
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={`max-h-[calc(100vh-3rem)] w-full overflow-y-auto rounded-lg border border-hairline-soft bg-canvas p-5 shadow-xl ${sizeClass[size]}`}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge tone={tone}>{eyebrow}</Badge>
            <h2 id={titleId} className="mt-3 text-xl font-bold tracking-tight text-ink">
              {title}
            </h2>
          </div>
          <button
            className="rounded-md px-2 py-1 text-sm font-bold text-muted transition hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            type="button"
            onClick={onClose}
          >
            {closeLabel}
          </button>
        </div>
        <div className="mt-5">{children}</div>
        {footer && <div className="mt-5 border-t border-hairline-soft pt-4">{footer}</div>}
      </motion.section>
    </div>
  );
}

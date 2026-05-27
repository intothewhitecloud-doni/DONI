"use client";

import { useId, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "./Badge";
import { easeOut, modalEnter, motionDurations } from "./motion";

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
  const reducedMotion = useReducedMotion();

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.section
        animate="show"
        className={`max-h-[calc(100vh-3rem)] w-full min-w-0 overflow-y-auto rounded-lg border border-hairline-soft bg-canvas p-5 shadow-xl ${sizeClass[size]}`}
        initial="hidden"
        transition={{ duration: motionDurations.modal, ease: easeOut }}
        variants={modalEnter(Boolean(reducedMotion))}
      >
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <Badge tone={tone}>{eyebrow}</Badge>
            <h2 id={titleId} className="mt-3 text-title-lg text-ink">
              {title}
            </h2>
          </div>
          <button
            className="shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-sm font-bold text-muted transition hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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

"use client";

import type { PropsWithChildren } from "react";
import { motion } from "framer-motion";

export function Card({ children, className = "", delay = 0 }: PropsWithChildren<{ className?: string; delay?: number }>) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay }}
      className={`rounded-xl border border-hairline bg-surface-card p-6 shadow-soft hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 ${className}`}
    >
      {children}
    </motion.section>
  );
}

export function SectionTitle({ eyebrow, title, description, delay = 0 }: { eyebrow?: string; title: string; description?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay }}
      className="space-y-2 mb-2"
    >
      {eyebrow && <p className="text-caption font-bold uppercase tracking-[0.12em] text-brand-accent">{eyebrow}</p>}
      <h1 className="text-display-md text-ink md:text-display-lg tracking-tight">{title}</h1>
      {description && <p className="max-w-3xl text-body-md text-muted">{description}</p>}
    </motion.div>
  );
}


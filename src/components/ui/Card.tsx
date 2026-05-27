"use client";

import type { PropsWithChildren } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cardReveal, easeOut, interactiveLift, motionDurations, pageEnter } from "./motion";

type CardMotion = "none" | "reveal";
type CardDensity = "comfortable" | "compact" | "flush";

const densityClass: Record<CardDensity, string> = {
  comfortable: "p-6",
  compact: "p-4",
  flush: "p-0"
};

export function Card({
  children,
  className = "",
  delay = 0,
  density = "comfortable",
  interactive = false,
  motion: motionMode
}: PropsWithChildren<{
  className?: string;
  delay?: number;
  density?: CardDensity;
  interactive?: boolean;
  motion?: CardMotion;
}>) {
  const reducedMotion = useReducedMotion();
  const effectiveMotion = motionMode ?? (delay > 0 ? "reveal" : "none");
  const shouldReveal = effectiveMotion === "reveal";
  const revealDelay = reducedMotion ? 0 : Math.min(delay, motionDurations.maxStaggerDelay);

  return (
    <motion.section
      animate={shouldReveal ? "show" : undefined}
      className={`rounded-lg border border-hairline bg-surface-card shadow-soft transition-shadow duration-200 ${densityClass[density]} ${interactive ? "hover:shadow-md" : ""} ${className}`}
      initial={shouldReveal ? "hidden" : false}
      transition={{ duration: motionDurations.card, ease: easeOut, delay: revealDelay }}
      variants={shouldReveal ? cardReveal(Boolean(reducedMotion)) : undefined}
      whileHover={interactive ? interactiveLift(Boolean(reducedMotion)) : undefined}
    >
      {children}
    </motion.section>
  );
}

type SectionTitleVariant = "page" | "section" | "compact";

const titleClass: Record<SectionTitleVariant, string> = {
  page: "text-display-sm md:text-display-md",
  section: "text-title-lg",
  compact: "text-title-md"
};

export function SectionTitle({
  delay = 0,
  description,
  eyebrow,
  title,
  variant = "page"
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  delay?: number;
  variant?: SectionTitleVariant;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      animate="show"
      className="mb-2 min-w-0 space-y-2"
      initial="hidden"
      transition={{ duration: motionDurations.page, ease: easeOut, delay }}
      variants={pageEnter(Boolean(reducedMotion))}
    >
      {eyebrow && <p className="text-caption font-bold uppercase text-brand-accent">{eyebrow}</p>}
      <h1 className={`${titleClass[variant]} text-balance text-ink`}>{title}</h1>
      {description && <p className="max-w-3xl text-body-md text-muted">{description}</p>}
    </motion.div>
  );
}

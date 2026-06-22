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
type SectionTitleBaseProps = {
  title: string;
  delay?: number;
};
type SectionTitlePageProps = SectionTitleBaseProps & {
  variant?: "page";
  description?: never;
};
type SectionTitleBodyProps = SectionTitleBaseProps & {
  variant: Exclude<SectionTitleVariant, "page">;
  description?: string;
};
type SectionTitleProps = SectionTitlePageProps | SectionTitleBodyProps;

const titleClass: Record<SectionTitleVariant, string> = {
  page: "text-page-title",
  section: "text-title-lg",
  compact: "text-title-md"
};

export function SectionTitle(props: SectionTitleProps) {
  const { delay = 0, title } = props;
  const variant = props.variant ?? "page";
  const description = props.variant === "section" || props.variant === "compact" ? props.description : undefined;
  const reducedMotion = useReducedMotion();
  const isPageTitle = variant === "page";

  return (
    <motion.div
      animate="show"
      className={isPageTitle ? "mb-1 min-w-0" : "mb-2 min-w-0 space-y-2"}
      initial="hidden"
      transition={{ duration: motionDurations.page, ease: easeOut, delay }}
      variants={pageEnter(Boolean(reducedMotion))}
    >
      {isPageTitle ? (
        <h1 className={`${titleClass[variant]} min-w-0 text-balance text-ink`}>{title}</h1>
      ) : (
        <>
          <h1 className={`${titleClass[variant]} text-balance text-ink`}>{title}</h1>
          {description && <p className="max-w-3xl text-body-md text-muted">{description}</p>}
        </>
      )}
    </motion.div>
  );
}

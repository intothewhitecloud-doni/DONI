import type { TargetAndTransition, Transition, Variants } from "framer-motion";

export const motionDurations = {
  page: 0.28,
  card: 0.24,
  modal: 0.18,
  maxStaggerDelay: 0.16
} as const;

export const easeOut: Transition["ease"] = "easeOut";

export function pageEnter(reducedMotion: boolean): Variants {
  return {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0 }
  };
}

export function cardReveal(reducedMotion: boolean): Variants {
  return {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };
}

export function modalEnter(reducedMotion: boolean): Variants {
  return {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1 }
  };
}

export function interactiveLift(reducedMotion: boolean): TargetAndTransition | undefined {
  if (reducedMotion) {
    return undefined;
  }

  return {
    boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 10px 24px rgba(0,0,0,0.10)"
  };
}

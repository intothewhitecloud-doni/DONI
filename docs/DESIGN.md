---
name: Cal.com Enterprise SaaS System
colors:
  surface: '#f9f9ff'
  surface-dim: '#d0daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff3ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9fd'
  surface-container-highest: '#d9e3f7'
  on-surface: '#121c2a'
  on-surface-variant: '#444748'
  inverse-surface: '#273140'
  inverse-on-surface: '#ebf1ff'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1d1b1a'
  on-tertiary-container: '#868381'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#e6e1df'
  tertiary-fixed-dim: '#cac6c3'
  on-tertiary-fixed: '#1d1b1a'
  on-tertiary-fixed-variant: '#484645'
  background: '#f9f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f7'
  canvas: '#ffffff'
  surface-soft: '#f8f9fa'
  surface-card: '#ffffff'
  surface-strong: '#e2e8f0'
  surface-dark: '#101010'
  surface-dark-elevated: '#1a1a1a'
  ink: '#111111'
  hairline: '#9ca3af'
  hairline-soft: '#d1d5db'
  muted: '#4b5563'
  muted-soft: '#6b7280'
  on-dark-soft: '#a1a1aa'
  brand-accent: '#2563eb'
  badge-orange: '#fb923c'
  badge-pink: '#ec4899'
  badge-violet: '#8b5cf6'
  badge-emerald: '#34d399'
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 64px
    fontWeight: '600'
    lineHeight: '1.05'
    letterSpacing: '0'
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: '0'
  display-md:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: '1.15'
    letterSpacing: '0'
  display-sm:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: '0'
  title-lg:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: '0'
  title-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: '0'
  caption:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: '0'
  nav-link:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: '0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px
---

## Overview

Cal.com's marketing surface is a clean, friendly modern-SaaS interface — white canvas (`{colors.canvas}` — #ffffff) with black primary CTAs (`{colors.primary}` — #111111), **Pretendard** typography, and `{colors.surface-card}` (#ffffff) cards holding product UI fragments with borders and shadows for separation. The system reads as confidently engineered without trying to impress — every band has clear hierarchy, generous whitespace, and a single primary action.

Type voice uses **Pretendard** as the universal typeface for both display and body. Pretendard provides excellent legibility for Korean text and a clean, geometric feel suitable for modern SaaS. Display sizes use zero letter-spacing across breakpoints to preserve Korean readability and prevent responsive wrapping drift in operational console surfaces.

Component voltage comes from **product UI fragments shown directly inside cards** — calendar widgets, scheduling forms, automation diagrams, integration tiles. Cal.com doesn't paint marketing illustrations of the product; it shows the actual product chrome at small scale embedded in the marketing flow.

The footer flips to `{colors.surface-dark}` (#101010) — a deep near-black that visually closes every long-scroll page. The footer is the only dark surface in the system; everything above stays white-with-light-gray-cards.

**Key Characteristics (A11y Enhanced):**
- White canvas with black primary CTA (`{colors.primary}` — #111111). Buttons are `{rounded.md}` (8px) with confident weight-600 labels. Standard friendly-SaaS button.
- **Pretendard** typeface for both headlines and body text, with zero letter-spacing on display sizes.
- White card surfaces (`{colors.surface-card}` — #ffffff) rely on darker hairline borders and shadows to ensure they distinctly contrast against the white canvas, satisfying boundary recognition.
- Product UI fragments embedded directly in cards.
- Nav-pill-group and interactive tabs use `{colors.brand-accent}` (#2563eb) or high-contrast states to clearly indicate active selection.
- Avatars are circular (`{rounded.full}`).
- Borders (`{colors.hairline}`) use a darker gray (#9ca3af) to guarantee a 3:1 contrast ratio against light backgrounds for UI components.
- Footer is dark navy (`{colors.surface-dark}` — #101010) with light text (`{colors.on-dark-soft}` — #a1a1aa). The dark footer closes every page even though the body above is white.
- Spacing rhythm is `{spacing.section}` (96px) between major bands.
- Border radius is hierarchical: `{rounded.md}` (8px), `{rounded.lg}` (12px), `{rounded.xl}` (16px), `{rounded.pill}`.

## Colors

### Brand & Accent
- **Primary** (`{colors.primary}` — #111111): The dominant action color.
- **Brand Accent** (`{colors.brand-accent}` — #2563eb): Used for active tabs, inline links, and focus rings to provide a clear interactive signal.
- **Badge Pastels** — A small pastel set for category badges and avatar fills: `{colors.badge-orange}` (#fb923c), `{colors.badge-pink}` (#ec4899), `{colors.badge-violet}` (#8b5cf6), `{colors.badge-emerald}` (#34d399). These appear on tag pills and small accent moments inside product UI fragments — never on hero CTAs.

### Surface
- **Canvas** (`{colors.canvas}` — #ffffff): The default page floor.
- **Surface Soft** (`{colors.surface-soft}` — #f8f9fa): Very-soft section dividers.
- **Surface Card** (`{colors.surface-card}` — #ffffff): Console cards and product UI fragments. Uses hairline borders and `shadow-soft` for clear distinction against canvas.
- **Surface Strong** (`{colors.surface-strong}` — #e2e8f0): Hover states or disabled background.
- **Surface Dark** (`{colors.surface-dark}` — #101010): The footer background.
- **Surface Dark Elevated** (`{colors.surface-dark-elevated}` — #1a1a1a): Nested dark cards.
- **Hairline** (`{colors.hairline}` — #9ca3af): The 1px border tone on light surfaces (Gray 400). Used on input borders and interactive cards to meet 3:1 WCAG contrast.
- **Hairline Soft** (`{colors.hairline-soft}` — #d1d5db): A softer divider (Gray 300) for structural lines that don't require interactive contrast.

### Text
- **Ink** (`{colors.ink}` — #111111): All headlines and primary text.
- **Body** (`{colors.body}` — #374151): Default running-text color.
- **Muted** (`{colors.muted}` — #4b5563): Secondary text — sub-headings, breadcrumbs. Darkened to Gray 600 for AA contrast.
- **Muted Soft** (`{colors.muted-soft}` — #6b7280): Tertiary text — captions, fine-print. Darkened to Gray 500.

### Semantic
- **Success** (`{colors.success}` — #10b981): Confirmation states, success badges in product UI.
- **Warning** (`{colors.warning}` — #f59e0b): Warning callouts.
- **Error** (`{colors.error}` — #ef4444): Validation errors.

## Typography

### Font Family
The system runs **Pretendard** as the universal typeface. Pretendard handles display, body, buttons, navigation, and captions seamlessly. It provides a geometric, modern character that replaces the original dual-font setup while using zero tracking for stable Korean enterprise UI.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 64px | 600 | 1.05 | 0 | Homepage h1 ("The better way to schedule your meetings") — Pretendard |
| `{typography.display-lg}` | 48px | 600 | 1.1 | 0 | Section heads ("Your all-purpose scheduling app") — Pretendard |
| `{typography.display-md}` | 36px | 600 | 1.15 | 0 | Sub-section heads, card titles — Pretendard |
| `{typography.display-sm}` | 28px | 600 | 1.2 | 0 | CTA-band heads, pricing tier prices — Pretendard |
| `{typography.title-lg}` | 22px | 600 | 1.3 | 0 | Pricing plan names — Pretendard |
| `{typography.title-md}` | 18px | 600 | 1.4 | 0 | Feature card titles, intro paragraphs |
| `{typography.title-sm}` | 16px | 600 | 1.4 | 0 | Small card titles, list labels |
| `{typography.body-md}` | 16px | 400 | 1.5 | 0 | Default running-text |
| `{typography.body-sm}` | 14px | 400 | 1.5 | 0 | Footer body, fine-print |
| `{typography.caption}` | 13px | 500 | 1.4 | 0 | Badge labels, captions |
| `{typography.code}` | 14px | 400 | 1.5 | 0 | Code snippets, API examples — JetBrains Mono |
| `{typography.button}` | 14px | 600 | 1.0 | 0 | Standard button labels |
| `{typography.nav-link}` | 14px | 500 | 1.4 | 0 | Top-nav menu items |

### Principles
Pretendard is the brand voice — every display headline uses it. Pretendard handles the supporting type.

## Layout

### Spacing System
- **Base unit:** 4px.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 96px.
- **Section padding:** `{spacing.section}` (96px).

### Grid & Container
- **Marketing Pages:** Max content width ~1200px centered.
- **Console / Dashboard UI:** Full width (`w-full`) with safe margins (`px-4` to `pr-6`) to maximize data density. Content fills the available space next to the sidebar.
- **Editorial body:** Single 12-column grid; hero band often uses 7/5 split.

### Whitespace Philosophy
Cal.com uses generous but not excessive whitespace — section padding sits at 96px.

## Elevation, Depth & Motion

### Elevation Philosophy
The console uses a distinct **Canvas-to-Card Depth Model** to maximize spatial clarity:
- **Canvas (Background):** `{colors.canvas}` is pure white (#ffffff) to maintain a bright, clean look.
- **Surface Cards:** `{colors.surface-card}` is also pure white (#ffffff), relying on shadows and borders to elevate content visually from the canvas. 
- **Shadows:** Cards use a distinct `shadow-soft` by default and elevate to `shadow-md` on hover to provide an interactive depth cue even on a white-on-white layout.

| Level | Treatment | Use |
|---|---|---|
| Floor | `{colors.canvas}` (#ffffff) | AppShell background, Sidebar |
| Flat | No shadow, 1px border | Inside cards (nested elements) |
| Card Surface | Pure white (`#ffffff`), `shadow-sm`, 1px border | All dashboard metric and feature cards |
| Hover Elevated | `shadow-md` | Interactive cards or actionable rows |

### Framer Motion (Entrance & Stagger)
To amplify the sense of spatial depth, the UI employs **Framer Motion** for load-ins:
- **Card Entrance:** Cards slide up slightly (`y: 15` → `y: 0`) and fade in (`opacity: 0` → `opacity: 1`) using a swift, easing transition (`duration: 0.4, ease: "easeOut"`).
- **Staggered Layout:** Sibling cards (like MetricCards) receive cascading delays (`delay: 0.1, 0.2, 0.3...`) so the layout physically "builds" its depth sequentially rather than appearing flatly all at once.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | Almost no use — reserved for badge accents |
| `{rounded.sm}` | 6px | Small inline buttons, dropdown items |
| `{rounded.md}` | 8px | Standard CTA buttons, text inputs, category tabs |
| `{rounded.lg}` | 12px | Content cards (feature cards, testimonial cards, pricing tier cards) |
| `{rounded.xl}` | 16px | Hero app-mockup card (a slightly larger radius for the marquee component) |
| `{rounded.pill}` | 9999px | Nav-pill-group, badge pills |
| `{rounded.full}` | 9999px / 50% | Avatars, icon buttons |

## Components

### Top Navigation

**`top-nav`** — White nav bar pinned to the top of every page. 64px tall, `{colors.canvas}` background.

**`nav-pill-group`** — A small pill-radius wrapper around 2-3 sub-nav segments.

### Buttons

**`button-primary`** — The signature primary CTA. Background `{colors.primary}` (#111111), text `{colors.on-primary}`.

**`button-secondary`** — White button with hairline outline. Background `{colors.canvas}`, text `{colors.ink}`, 1px hairline border.

**`button-danger`** — Destructive action CTA (e.g. Logout, Leave, Delete). Background `{colors.error}` (#ef4444) or a tinted soft variant (e.g. `bg-error/5` with `text-error`), to clearly indicate irreversible or session-ending actions.

**`button-icon-circular`** — 36 × 36px circular icon button. Background `{colors.canvas}`, hairline border, ink-color icon.

### Cards & Containers

**`hero-band`** — White-canvas hero with a 7-5 grid.

**`hero-app-mockup-card`** — A larger product-UI mockup card showing the actual Cal.com booking widget. Background `{colors.canvas}`, 1px hairline border, rounded `{rounded.xl}` (16px), subtle drop shadow.

**`feature-card`** — Used in 3-up feature grids. Background `{colors.surface-card}` (#ffffff), rounded `{rounded.lg}` (12px), internal padding `{spacing.xl}` (32px), hairline border, and soft shadow.

**`pricing-tier-card-featured`** — The featured tier (typically "Teams"). Background flips to `{colors.surface-dark}` (#101010).

### Inputs & Forms

**`text-input`** — Standard text input. Background `{colors.canvas}`, text `{colors.ink}`, 1px hairline border in `{colors.hairline}`.

**`text-input-focused`** — Focus state. Border thickens or shifts to `{colors.ink}` or `{colors.brand-accent}` for emphasis.

### Tab / Filter

**`category-tab`** + **`category-tab-active`** — Used inside the nav-pill-group. Inactive: transparent background, `{colors.muted}` text. Active: `{colors.brand-accent}` background/text or high-contrast state to clearly indicate active selection.

## Accessibility (A11y) Guidelines
While the base system leans toward soft minimalism, enterprise software must pass basic visual and interactive accessibility standards:
- **Contrast**: `muted` and `hairline` elements must remain legible. The system deviates slightly from raw Cal.com styling by using darker grays (`#4b5563` for muted, `#9ca3af` for hairline) to meet WCAG AA standards.
- **Focus States**: All interactive elements (buttons, inputs, links) must have a clearly visible focus ring (`focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`). Do not rely entirely on the native outline.
- **Color Independence**: Never rely on color alone to convey meaning (e.g., error vs success). Always pair color changes with an icon, thick border, or explicit text badge.

## Do's and Don'ts

### Do
- Reserve `{colors.primary}` (#111111) for primary CTAs and h1/h2 type.
- Keep letter-spacing at 0 on display sizes to preserve Korean readability and responsive stability.
- Embed real product UI fragments inside marketing cards.
- Ensure all interactive elements have focus rings to comply with accessibility.

### Don't
- Don't use rounded radius beyond `{rounded.xl}` (16px) on cards.
- Don't put dark surface cards anywhere except the footer and the featured pricing tier.
- Don't rely exclusively on color to convey error or success states.

## Responsive Behavior
(Same as original Cal.com specs)

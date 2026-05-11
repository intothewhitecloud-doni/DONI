import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClass: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-active",
  secondary: "border border-hairline bg-canvas text-ink hover:bg-surface-soft",
  ghost: "text-muted hover:bg-surface-soft hover:text-ink",
  danger: "bg-error text-white hover:bg-error/90"
};

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-md px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${variantClass[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}


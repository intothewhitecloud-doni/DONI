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
  type = "button",
  variant = "primary",
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>) {
  return (
    <button
      className={`inline-flex h-10 min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-5 text-sm font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${variantClass[variant]} ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

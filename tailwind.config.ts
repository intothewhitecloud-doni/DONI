import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#ffffff",
        primary: "#111111",
        "primary-active": "#242424",
        "brand-accent": "#2563eb",
        "surface-soft": "#f8f9fa",
        "surface-card": "#ffffff",
        "surface-strong": "#e2e8f0",
        "surface-dark": "#101010",
        "surface-dark-elevated": "#1a1a1a",
        hairline: "#9ca3af",
        "hairline-soft": "#d1d5db",
        ink: "#111111",
        body: "#374151",
        muted: "#4b5563",
        "muted-soft": "#6b7280",
        "on-primary": "#ffffff",
        "on-dark": "#ffffff",
        "on-dark-soft": "#a1a1aa",
        "badge-orange": "#fb923c",
        "badge-pink": "#ec4899",
        "badge-violet": "#8b5cf6",
        "badge-emerald": "#34d399",
        success: "#10b981",
        warning: "#f59e0b",
        error: "#ef4444"
      },
      spacing: {
        xxs: "4px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        xxl: "48px",
        section: "96px"
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        pill: "9999px"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.08)"
      },
      fontFamily: {
        sans: ["'Pretendard Variable'", "Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", "Roboto", "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "sans-serif"],
        display: ["'Pretendard Variable'", "Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", "Roboto", "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "sans-serif"]
      },
      fontSize: {
        "display-xl": ["64px", { lineHeight: "1.05", letterSpacing: "-2px", fontWeight: "600" }],
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-1.5px", fontWeight: "600" }],
        "display-md": ["36px", { lineHeight: "1.15", letterSpacing: "-1px", fontWeight: "600" }],
        "display-sm": ["28px", { lineHeight: "1.2", letterSpacing: "-0.5px", fontWeight: "600" }],
        "title-lg": ["22px", { lineHeight: "1.3", letterSpacing: "-0.3px", fontWeight: "600" }],
        "title-md": ["18px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "600" }],
        "title-sm": ["16px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "600" }],
        "body-md": ["16px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        "caption": ["13px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "500" }],
        "button": ["14px", { lineHeight: "1.0", letterSpacing: "0", fontWeight: "600" }],
        "nav-link": ["14px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "500" }]
      }
    }
  },
  plugins: []
};

export default config;

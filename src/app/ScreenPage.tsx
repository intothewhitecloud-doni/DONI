"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "../components/layout/AppShell";
import { screenFromPathname } from "../lib/prototype/routes";

export function ScreenPage() {
  const pathname = usePathname();
  const screen = screenFromPathname(pathname);

  return <AppShell screen={screen} />;
}

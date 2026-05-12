import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@xyflow/react/dist/style.css";
import { PrototypeProvider } from "../lib/prototype/PrototypeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "DONI | 기업 인공지능 의사결정 엔진",
  description: "기업 데이터를 기반으로 의사결정 안건과 검증 기록을 운영하는 콘솔",
  icons: {
    icon: "/assets/ico-logo.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <PrototypeProvider>{children}</PrototypeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "../components/app-shell";
import { ThemeSync } from "../components/theme-sync";

export const metadata: Metadata = {
  title: "BugHoi",
  description: "Personal task tracking app"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeSync />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

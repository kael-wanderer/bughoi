import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { BottomNav } from "../components/bottom-nav";
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
        <div className="app-shell pb-24">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}

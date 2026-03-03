import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Sidebar } from "../components/sidebar";
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
        <div className="desktop-layout">
          <Sidebar />
          <div className="app-shell pb-24 md:pb-0">
            <div className="main-content">{children}</div>
          </div>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}

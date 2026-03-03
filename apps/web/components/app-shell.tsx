"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { getToken } from "../lib/auth-client";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const isLoginPage = useMemo(() => pathname === "/login", [pathname]);

  useEffect(() => {
    const token = getToken();

    if (isLoginPage) {
      if (token) {
        router.replace("/");
        return;
      }
      setReady(true);
      return;
    }

    if (!token) {
      router.replace("/login");
      return;
    }

    setReady(true);
  }, [isLoginPage, router, pathname]);

  if (!ready) {
    return null;
  }

  if (isLoginPage) {
    return <div className="app-shell pb-24 md:pb-0">{children}</div>;
  }

  return (
    <>
      <div className="desktop-layout">
        <Sidebar />
        <div className="app-shell pb-24 md:pb-0">
          <div className="main-content">{children}</div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}

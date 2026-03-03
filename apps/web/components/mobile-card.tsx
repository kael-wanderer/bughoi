import type { ReactNode } from "react";

export function MobileCard({ children }: { children: ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{children}</section>;
}

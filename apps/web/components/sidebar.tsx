"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/tasks", label: "Tasks", icon: "✅" },
  { href: "/goals", label: "Goals", icon: "🎯" },
  { href: "/analytics", label: "Analytics", icon: "📈" },
  { href: "/profile", label: "Profile", icon: "👤" }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 flex-col border-r border-slate-200 bg-white md:flex sticky top-0">
      <div className="flex h-16 items-center px-6">
        <span className="text-xl font-bold text-primary italic">BugHoi</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Version 1.1.0</p>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/goals", label: "Goals" },
  { href: "/analytics", label: "Analytics" },
  { href: "/profile", label: "Profile" }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 mx-auto flex w-full max-w-[430px] gap-1 border-t border-slate-200 bg-white px-2 py-2 safe-bottom md:hidden">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-1 flex-col items-center rounded-lg px-2 py-2 text-[11px] font-semibold ${active ? "text-primary" : "text-slate-500"
              }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/incidents", label: "Browse" },
  { href: "/investigations", label: "Cases" },
  { href: "/files", label: "Files" },
  { href: "/reports", label: "Reports" },
  { href: "/upload", label: "Intake" },
  { href: "/chat", label: "Query" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-48 flex-col border-r border-[#2A2A2C] bg-[#0E0E0F] print:hidden">
      <div className="border-b border-[#2A2A2C] px-4 py-5">
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#F5751E]">BFP–NCR</p>
        <p className="mt-0.5 text-xs text-[#6A6A6E]">Incident Dashboard</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3">
        {LINKS.map((link) => {
          const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`border-l-2 px-3 py-2 font-mono text-xs transition-colors ${
                isActive
                  ? "border-[#F5751E] bg-[#1A1512] text-[#F5751E]"
                  : "border-transparent text-[#8A8A8E] hover:border-[#3A3A3E] hover:bg-[#141415] hover:text-[#EDEDEC]"
              }`}
            >
              {link.label.toUpperCase()}
            </Link>
          );
        })}
      </nav>

      <form action="/api/auth/logout" method="POST" className="border-t border-[#2A2A2C] p-2">
        <button
          type="submit"
          className="w-full border border-[#2A2A2C] px-3 py-2 text-left font-mono text-xs text-[#5A5A5E] transition-colors hover:border-[#E5484D] hover:text-[#E5484D]"
        >
          LOGOUT
        </button>
      </form>
    </aside>
  );
}
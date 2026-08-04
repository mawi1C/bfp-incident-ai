import Link from "next/link";

const LINKS = [
  { href: "/", label: "DASHBOARD" },
  { href: "/incidents", label: "BROWSE" },
  { href: "/files", label: "FILES" },
  { href: "/reports", label: "REPORTS" },
  { href: "/upload", label: "INTAKE" },
  { href: "/investigations", label: "CASES" },
  { href: "/chat", label: "QUERY" },
];

export default function Nav({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-2 font-mono text-xs">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`border px-3 py-1.5 transition-colors ${
            active === link.href
              ? "border-[#F5751E] text-[#F5751E]"
              : "border-[#2A2A2C] text-[#8A8A8E] hover:border-[#F5751E] hover:text-[#EDEDEC]"
          }`}
        >
          {link.label}
        </Link>
      ))}
      <form action="/api/auth/logout" method="POST">
        <button
          type="submit"
          className="border border-[#2A2A2C] px-3 py-1.5 text-[#5A5A5E] transition-colors hover:border-[#E5484D] hover:text-[#E5484D]"
        >
          LOGOUT
        </button>
      </form>
    </nav>
  );
}
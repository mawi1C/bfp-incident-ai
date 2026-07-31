import Link from "next/link";

const LINKS = [
  { href: "/", label: "DASHBOARD" },
  { href: "/incidents", label: "BROWSE" },
  { href: "/upload", label: "INTAKE" },
  { href: "/chat", label: "QUERY" },
];

export default function Nav({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-2 font-mono text-xs">
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
    </nav>
  );
}
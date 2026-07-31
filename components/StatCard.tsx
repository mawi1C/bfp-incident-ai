interface StatCardProps {
  label: string;
  value: string;
  accent?: string;
  sublabel?: string;
}

export default function StatCard({ label, value, accent, sublabel }: StatCardProps) {
  return (
    <div className="border border-[#2A2A2C] bg-[#0E0E0F] px-5 py-4">
      <p className="font-mono text-[11px] tracking-wide text-[#6A6A6E]">{label}</p>
      <p
        className="mt-2 text-3xl font-semibold tracking-tight"
        style={{ color: accent ?? "#EDEDEC" }}
      >
        {value}
      </p>
      {sublabel && <p className="mt-1 font-mono text-[11px] text-[#5A5A5E]">{sublabel}</p>}
    </div>
  );
}
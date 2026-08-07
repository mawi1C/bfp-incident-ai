"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RematchButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleClick = async () => {
    setPending(true);
    setResult(null);
    try {
      const res = await fetch("/api/investigations/rematch", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(
          `Repaired ${data.datesRepaired} date(s) · checked ${data.checked} — ${data.newlyMatched} newly matched, ${data.stillUnmatched} still need review.`
        );
        router.refresh();
      } else {
        setResult(data.error ?? "Re-match failed.");
      }
    } catch {
      setResult("Connection lost.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mb-4">
      <button
        onClick={handleClick}
        disabled={pending}
        className="border border-[#2A2A2C] px-3 py-1.5 font-mono text-[11px] text-[#8A8A8E] transition-colors hover:border-[#F5751E] hover:text-[#EDEDEC] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "REPAIRING & MATCHING…" : "↻ REPAIR DATES & RE-RUN MATCHING"}
      </button>
      {result && <p className="mt-2 font-mono text-[11px] text-[#3EBD6B]">{result}</p>}
    </div>
  );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Candidate {
  id: string;
  date_of_response: string | null;
  station: string | null;
  location: string | null;
  cause_of_fire: string | null;
}

interface Props {
  investigationId: string;
  suggestedDate: string | null;
  suggestedLocation: string | null;
  currentIncidentId: string | null;
}

export default function ManualMatchPicker({
  investigationId,
  suggestedDate,
  suggestedLocation,
  currentIncidentId,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(suggestedLocation ?? "");
  const [dateFilter, setDateFilter] = useState(suggestedDate ?? "");
  const [results, setResults] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  const search = async () => {
    setSearching(true);
    try {
      const sp = new URLSearchParams();
      if (query) sp.set("q", query);
      if (dateFilter) sp.set("date", dateFilter);
      const res = await fetch(`/api/incidents/search?${sp.toString()}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setSearching(false);
    }
  };

  const link = async (incidentId: string | null) => {
    setLinking(incidentId ?? "unlink");
    try {
      await fetch(`/api/investigations/${investigationId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });
      router.refresh();
    } finally {
      setLinking(null);
    }
  };

  return (
    <div className="border border-[#2A2A2C] bg-[#0E0E0F] p-4">
      <p className="mb-3 font-mono text-[11px] tracking-wide text-[#6A6A6E]">
        {currentIncidentId ? "RELINK TO A DIFFERENT INCIDENT" : "MANUALLY MATCH TO AN INCIDENT"}
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search by address…"
          className="min-w-[200px] flex-1 border border-[#2A2A2C] bg-[#141415] px-3 py-1.5 text-sm text-[#EDEDEC] outline-none placeholder:text-[#5A5A5E] focus:border-[#F5751E]"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="border border-[#2A2A2C] bg-[#141415] px-3 py-1.5 text-sm text-[#EDEDEC] outline-none focus:border-[#F5751E]"
        />
        <button
          onClick={search}
          disabled={searching}
          className="border border-[#F5751E] px-4 py-1.5 text-sm font-medium text-[#F5751E] transition-colors hover:bg-[#F5751E] hover:text-[#0A0A0B] disabled:opacity-50"
        >
          {searching ? "…" : "Search"}
        </button>
      </div>

      {currentIncidentId && (
        <button
          onClick={() => link(null)}
          disabled={linking !== null}
          className="mb-3 font-mono text-[11px] text-[#E5484D] hover:underline disabled:opacity-50"
        >
          {linking === "unlink" ? "unlinking…" : "✕ unlink current match"}
        </button>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((c) => (
            <div
              key={c.id}
              className={`flex items-center justify-between gap-3 border px-3 py-2 text-xs ${
                c.id === currentIncidentId ? "border-[#3EBD6B]/50 bg-[#0F1A13]" : "border-[#2A2A2C]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[#C9C9C7]">{c.location ?? "—"}</p>
                <p className="mt-0.5 font-mono text-[10px] text-[#6A6A6E]">
                  {c.date_of_response ?? "no date"} · {c.station ?? "—"} · {c.cause_of_fire ?? "—"}
                </p>
              </div>
              {c.id === currentIncidentId ? (
                <span className="shrink-0 font-mono text-[10px] text-[#3EBD6B]">current match</span>
              ) : (
                <button
                  onClick={() => link(c.id)}
                  disabled={linking !== null}
                  className="shrink-0 border border-[#2A2A2C] px-2 py-1 font-mono text-[10px] text-[#8A8A8E] transition-colors hover:border-[#F5751E] hover:text-[#F5751E] disabled:opacity-50"
                >
                  {linking === c.id ? "linking…" : "link this"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import Link from "next/link";
import PageShell from "@/components/PageShell";
import RematchButton from "@/components/RematchButton";
import { getUnmatchedRecords, getInvestigationStats } from "@/lib/investigationsQueries";

export const metadata = { title: "Case Records — BFP-NCR Incident Dashboard" };
export const dynamic = "force-dynamic";

export default async function InvestigationsPage() {
  const [unmatched, stats] = await Promise.all([getUnmatchedRecords(), getInvestigationStats()]);

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 border-b border-[#2A2A2C] pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[#EDEDEC]">
            Case Records
          </h1>
          <p className="mt-1 max-w-xl text-xs text-[#6A6A6E]">
            Fire Arson Investigation Division data — linked to your incident records where a
            confident match is found by date and address.
          </p>
        </div>

        <Link
          href="/upload?tab=investigation"
          className="mb-6 inline-block border border-[#F5751E] px-4 py-2 font-mono text-xs text-[#F5751E] transition-colors hover:bg-[#F5751E] hover:text-[#0A0A0B]"
        >
          + UPLOAD CASE FILE
        </Link>

        {stats.total > 0 && (
          <p className="mb-4 mt-6 font-mono text-[11px] text-[#5A5A5E]">
            {stats.total.toLocaleString()} case records on file · {stats.matched.toLocaleString()} linked ·{" "}
            <span className={stats.unmatched > 0 ? "text-[#F5A623]" : ""}>
              {stats.unmatched.toLocaleString()} needing review
            </span>
          </p>
        )}

        {unmatched.length > 0 && (
          <div className="mt-8">
            <p className="mb-3 font-mono text-[11px] tracking-wide text-[#F5A623]">
              NEEDS MANUAL REVIEW — {unmatched.length} case{unmatched.length === 1 ? "" : "s"} couldn&apos;t
              be confidently matched to an existing incident
            </p>
            <RematchButton />
            <div className="flex flex-col gap-2">
              {unmatched.map((r) => (
                <div key={r.id} className="border border-[#2A2A2C] bg-[#0E0E0F] px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-[#6A6A6E]">
                    <span>{r.date_of_fire ?? "date unknown"}</span>
                    {r.match_confidence != null && (
                      <span>closest match score: {Math.round(r.match_confidence * 100)}%</span>
                    )}
                    <span>{r.source_file_name}</span>
                  </div>
                  <p className="mt-1 text-[#C9C9C7]">{r.exact_location ?? "—"}</p>
                  <p className="mt-0.5 text-xs text-[#8A8A8E]">
                    {r.cause ?? "cause unknown"}
                    {r.fire_arson_investigator ? ` · investigator: ${r.fire_arson_investigator}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
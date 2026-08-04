import Link from "next/link";
import PageShell from "@/components/PageShell";
import FlagButton from "@/components/FlagButton";
import { getIncidentsPage, getFilterOptions } from "@/lib/incidentsQueries";

export const metadata = { title: "Browse Incidents — BFP-NCR Incident Dashboard" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ station?: string; month?: string; q?: string; flagged?: string; page?: string }>;
}

export default async function IncidentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    station: params.station || undefined,
    month: params.month || undefined,
    q: params.q || undefined,
    flaggedOnly: params.flagged === "1",
    page: params.page ? parseInt(params.page, 10) : 1,
  };

  const [{ rows, totalCount, page, totalPages }, { stations, months }] = await Promise.all([
    getIncidentsPage(filters),
    getFilterOptions(),
  ]);

  const buildPageHref = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (filters.station) sp.set("station", filters.station);
    if (filters.month) sp.set("month", filters.month);
    if (filters.q) sp.set("q", filters.q);
    if (filters.flaggedOnly) sp.set("flagged", "1");
    sp.set("page", String(targetPage));
    return `/incidents?${sp.toString()}`;
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 border-b border-[#2A2A2C] pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[#EDEDEC]">
            Browse Incidents
          </h1>
        </div>

        {/* Filters */}
        <form
          method="GET"
          className="mb-4 flex flex-wrap items-center gap-2 border border-[#2A2A2C] bg-[#141415] p-3"
        >
          <input
            type="text"
            name="q"
            defaultValue={filters.q}
            placeholder="search location or cause…"
            className="min-w-[220px] flex-1 border border-[#2A2A2C] bg-[#0E0E0F] px-3 py-1.5 text-sm text-[#EDEDEC] outline-none placeholder:text-[#5A5A5E] focus:border-[#F5751E]"
          />
          <select
            name="station"
            defaultValue={filters.station ?? ""}
            className="border border-[#2A2A2C] bg-[#0E0E0F] px-3 py-1.5 text-sm text-[#EDEDEC] outline-none focus:border-[#F5751E]"
          >
            <option value="">all stations</option>
            {stations.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            name="month"
            defaultValue={filters.month ?? ""}
            className="border border-[#2A2A2C] bg-[#0E0E0F] px-3 py-1.5 text-sm text-[#EDEDEC] outline-none focus:border-[#F5751E]"
          >
            <option value="">all months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 font-mono text-xs text-[#8A8A8E]">
            <input
              type="checkbox"
              name="flagged"
              value="1"
              defaultChecked={filters.flaggedOnly}
              className="accent-[#F5A623]"
            />
            flagged only
          </label>
          <button
            type="submit"
            className="border border-[#F5751E] px-4 py-1.5 text-sm font-medium text-[#F5751E] transition-colors hover:bg-[#F5751E] hover:text-[#0A0A0B]"
          >
            Filter
          </button>
          {(filters.station || filters.month || filters.q || filters.flaggedOnly) && (
            <Link
              href="/incidents"
              className="font-mono text-xs text-[#6A6A6E] underline decoration-dotted hover:text-[#EDEDEC]"
            >
              clear
            </Link>
          )}
        </form>

        <p className="mb-3 font-mono text-[11px] text-[#5A5A5E]">
          {totalCount.toLocaleString()} incident{totalCount === 1 ? "" : "s"} matched
        </p>

        {/* Results table */}
        <div className="overflow-x-auto border border-[#2A2A2C]">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#2A2A2C] bg-[#141415] font-mono text-[10px] tracking-wide text-[#6A6A6E]">
                <th className="px-3 py-2 font-normal">DATE</th>
                <th className="px-3 py-2 font-normal">STATION</th>
                <th className="px-3 py-2 font-normal">LOCATION</th>
                <th className="px-3 py-2 font-normal">CAUSE</th>
                <th className="px-3 py-2 font-normal">ALARM</th>
                <th className="px-3 py-2 font-normal">CASUALTIES</th>
                <th className="px-3 py-2 font-normal">SOURCE</th>
                <th className="px-3 py-2 font-normal">FLAG</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-[#5A5A5E]">
                    No incidents match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const casualtyTotal =
                    r.casualties_injured_civilian +
                    r.casualties_injured_bfp +
                    r.casualties_death_civilian +
                    r.casualties_death_bfp;
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-[#1A1A1B] text-[#C9C9C7] hover:bg-[#141415] ${
                        r.flagged ? "bg-[#1A1512]/40" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-[#8A8A8E]">
                        {r.date_of_response ?? "—"}
                      </td>
                      <td className="px-3 py-2">{r.station ?? "—"}</td>
                      <td className="max-w-[280px] truncate px-3 py-2" title={r.location ?? ""}>
                        {r.location ?? "—"}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-[#8A8A8E]" title={r.cause_of_fire ?? ""}>
                        {r.cause_of_fire ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-[#8A8A8E]">
                        {r.alarm_status ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {casualtyTotal > 0 ? (
                          <span className="text-[#E5484D]">{casualtyTotal}</span>
                        ) : (
                          <span className="text-[#5A5A5E]">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={r.cloudinary_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[11px] text-[#F5751E] hover:underline"
                        >
                          source
                        </a>
                      </td>
                      <td className="px-3 py-2">
                        <FlagButton id={r.id} flagged={r.flagged} flagNote={r.flag_note} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between font-mono text-xs text-[#8A8A8E]">
            <span>
              page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildPageHref(page - 1)}
                  className="border border-[#2A2A2C] px-3 py-1.5 hover:border-[#F5751E] hover:text-[#EDEDEC]"
                >
                  ← prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildPageHref(page + 1)}
                  className="border border-[#2A2A2C] px-3 py-1.5 hover:border-[#F5751E] hover:text-[#EDEDEC]"
                >
                  next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
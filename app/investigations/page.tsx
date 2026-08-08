import Link from "next/link";
import PageShell from "@/components/PageShell";
import RematchButton from "@/components/RematchButton";
import DeleteInvestigationButton from "@/components/DeleteInvestigationButton";
import {
  getInvestigationRecordsPage,
  getInvestigationFilterOptions,
  getInvestigationStats,
} from "@/lib/investigationsQueries";

export const metadata = { title: "Case Records — BFP-NCR Incident Dashboard" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; city?: string; month?: string; status?: string; page?: string }>;
}

export default async function InvestigationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const statusParam = params.status;

  // 1. Explicitly cast the matchStatus so TypeScript knows it's not a generic string
  const matchStatus = (
    statusParam === "matched" || statusParam === "unmatched"
      ? statusParam
      : undefined
  ) as "matched" | "unmatched" | undefined;

  // 2. Pass it into your filters
  const filters = {
    q: params.q || undefined,
    city: params.city || undefined,
    month: params.month || undefined,
    matchStatus,
    page: params.page ? parseInt(params.page, 10) : 1,
  };

  const [{ rows, totalCount, page, totalPages }, { cities, months }, stats] = await Promise.all([
    getInvestigationRecordsPage(filters),
    getInvestigationFilterOptions(),
    getInvestigationStats(),
  ]);

  const buildPageHref = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (filters.q) sp.set("q", filters.q);
    if (filters.city) sp.set("city", filters.city);
    if (filters.month) sp.set("month", filters.month);
    if (filters.matchStatus) sp.set("status", filters.matchStatus);
    sp.set("page", String(targetPage));
    return `/investigations?${sp.toString()}`;
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#2A2A2C] pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#EDEDEC]">Case Records</h1>
            <p className="mt-1 max-w-xl text-xs text-[#6A6A6E]">
              Fire Arson Investigation Division data, linked to incidents by date and address where a
              confident match is found.
            </p>
          </div>
          <Link
            href="/upload?tab=investigation"
            className="border border-[#F5751E] px-4 py-2 font-mono text-xs text-[#F5751E] transition-colors hover:bg-[#F5751E] hover:text-[#0A0A0B]"
          >
            + UPLOAD CASE FILE
          </Link>
        </div>

        {/* Stats strip */}
        <div className="mb-4 flex gap-6 font-mono text-[11px] text-[#8A8A8E]">
          <span>{stats.total.toLocaleString()} on file</span>
          <span className="text-[#3EBD6B]">{stats.matched.toLocaleString()} linked</span>
          <span className={stats.unmatched > 0 ? "text-[#F5A623]" : "text-[#8A8A8E]"}>
            {stats.unmatched.toLocaleString()} needing review
          </span>
        </div>

        {stats.unmatched > 0 && <RematchButton />}

        {/* Filters */}
        <form
          method="GET"
          className="mb-4 flex flex-wrap items-center gap-2 border border-[#2A2A2C] bg-[#141415] p-3"
        >
          <input
            type="text"
            name="q"
            defaultValue={filters.q}
            placeholder="search location, cause, investigator…"
            className="min-w-[220px] flex-1 border border-[#2A2A2C] bg-[#0E0E0F] px-3 py-1.5 text-sm text-[#EDEDEC] outline-none placeholder:text-[#5A5A5E] focus:border-[#F5751E]"
          />
          <select
            name="city"
            defaultValue={filters.city ?? ""}
            className="border border-[#2A2A2C] bg-[#0E0E0F] px-3 py-1.5 text-sm text-[#EDEDEC] outline-none focus:border-[#F5751E]"
          >
            <option value="">all cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
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
          <select
            name="status"
            defaultValue={filters.matchStatus ?? ""}
            className="border border-[#2A2A2C] bg-[#0E0E0F] px-3 py-1.5 text-sm text-[#EDEDEC] outline-none focus:border-[#F5751E]"
          >
            <option value="">all statuses</option>
            <option value="matched">matched</option>
            <option value="unmatched">unmatched</option>
          </select>
          <button
            type="submit"
            className="border border-[#F5751E] px-4 py-1.5 text-sm font-medium text-[#F5751E] transition-colors hover:bg-[#F5751E] hover:text-[#0A0A0B]"
          >
            Filter
          </button>
          {(filters.q || filters.city || filters.month || filters.matchStatus) && (
            <Link
              href="/investigations"
              className="font-mono text-xs text-[#6A6A6E] underline decoration-dotted hover:text-[#EDEDEC]"
            >
              clear
            </Link>
          )}
          <a
            href={`/api/investigations/export?${new URLSearchParams({
              ...(filters.q ? { q: filters.q } : {}),
              ...(filters.city ? { city: filters.city } : {}),
              ...(filters.month ? { month: filters.month } : {}),
              ...(filters.matchStatus ? { status: filters.matchStatus } : {}),
            }).toString()}`}
            className="ml-auto border border-[#2A2A2C] px-3 py-1.5 font-mono text-xs text-[#8A8A8E] transition-colors hover:border-[#3EBD6B] hover:text-[#3EBD6B]"
          >
            ⭳ EXPORT TO EXCEL
          </a>
        </form>

        <p className="mb-3 font-mono text-[11px] text-[#5A5A5E]">
          {totalCount.toLocaleString()} record{totalCount === 1 ? "" : "s"} matched
        </p>

        {/* Table */}
        <div className="overflow-x-auto border border-[#2A2A2C]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#2A2A2C] bg-[#141415] font-mono text-[10px] tracking-wide text-[#6A6A6E]">
                <th className="px-3 py-2 font-normal">DATE</th>
                <th className="px-3 py-2 font-normal">CITY</th>
                <th className="px-3 py-2 font-normal">LOCATION</th>
                <th className="px-3 py-2 font-normal">CAUSE</th>
                <th className="px-3 py-2 font-normal">INVESTIGATOR</th>
                <th className="px-3 py-2 font-normal">STATUS</th>
                <th className="px-3 py-2 font-normal">SOURCE</th>
                <th className="px-3 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-[#5A5A5E]">
                    No case records match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#1A1A1B] text-[#C9C9C7] hover:bg-[#141415]">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-[#8A8A8E]">
                      {r.date_of_fire ?? "—"}
                    </td>
                    <td className="px-3 py-2">{r.city_municipality ?? "—"}</td>
                    <td className="max-w-[220px] truncate px-3 py-2" title={r.exact_location ?? ""}>
                      <Link href={`/investigations/${r.id}`} className="hover:text-[#F5751E] hover:underline">
                        {r.exact_location ?? "—"}
                      </Link>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-[#8A8A8E]" title={r.cause ?? ""}>
                      {r.cause ?? "—"}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-[#8A8A8E]" title={r.fire_arson_investigator ?? ""}>
                      {r.fire_arson_investigator ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {r.match_status === "matched" ? (
                        <span className="text-[#3EBD6B]">matched</span>
                      ) : (
                        <span className="text-[#F5A623]">unmatched</span>
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
                      <DeleteInvestigationButton id={r.id} location={r.exact_location} />
                    </td>
                  </tr>
                ))
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
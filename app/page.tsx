import Link from "next/link";
import { getDashboardData, getFilterValues } from "@/lib/dashboardQueries";
import StatCard from "@/components/StatCard";
import IncidentsOverTimeChart from "@/components/IncidentsOverTimeChart";
import RankedBarList from "@/components/RankedBarList";
import PageShell from "@/components/PageShell";

export const metadata = {
  title: "Dashboard — BFP-NCR Incident Report",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ month?: string; district?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { months, districts } = await getFilterValues();

  // Allowlist validation: only accept filter values that actually exist in
  // the data. Anything else (typos, tampering, garbage) is silently
  // ignored rather than passed through to a SQL query.
  const month = params.month && months.includes(params.month) ? params.month : undefined;
  const district = params.district && districts.includes(params.district) ? params.district : undefined;

  const data = await getDashboardData({ month, district });

  const buildFilterHref = (next: { month?: string; district?: string }) => {
    const sp = new URLSearchParams();
    if (next.month) sp.set("month", next.month);
    if (next.district) sp.set("district", next.district);
    const qs = sp.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 border-b border-[#2A2A2C] pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[#EDEDEC]">
            Incident Dashboard
          </h1>
        </div>

        {/* Filters */}
        <form
          method="GET"
          className="mb-6 flex flex-wrap items-center gap-2 border border-[#2A2A2C] bg-[#141415] p-3"
        >
          <select
            name="district"
            defaultValue={district ?? ""}
            className="border border-[#2A2A2C] bg-[#0E0E0F] px-3 py-1.5 text-sm text-[#EDEDEC] outline-none focus:border-[#F5751E]"
          >
            <option value="">all districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            name="month"
            defaultValue={month ?? ""}
            className="border border-[#2A2A2C] bg-[#0E0E0F] px-3 py-1.5 text-sm text-[#EDEDEC] outline-none focus:border-[#F5751E]"
          >
            <option value="">all months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="border border-[#F5751E] px-4 py-1.5 text-sm font-medium text-[#F5751E] transition-colors hover:bg-[#F5751E] hover:text-[#0A0A0B]"
          >
            Apply
          </button>
          {(month || district) && (
            <Link
              href="/"
              className="font-mono text-xs text-[#6A6A6E] underline decoration-dotted hover:text-[#EDEDEC]"
            >
              clear filters
            </Link>
          )}
          {(month || district) && (
            <span className="ml-auto font-mono text-[11px] text-[#F5751E]">
              {[district, month].filter(Boolean).join(" · ")}
            </span>
          )}
        </form>

        {data.totalIncidents === 0 ? (
          <div className="border border-[#2A2A2C] bg-[#0E0E0F] px-6 py-16 text-center">
            <p className="text-sm text-[#8A8A8E]">
              {month || district ? "No incidents match this filter." : "No incident data logged yet."}
            </p>
            {!month && !district && (
              <Link
                href="/upload"
                className="mt-4 inline-block border border-[#F5751E] px-4 py-2 font-mono text-xs text-[#F5751E] transition-colors hover:bg-[#F5751E] hover:text-[#0A0A0B]"
              >
                UPLOAD A REPORT
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="TOTAL INCIDENTS" value={data.totalIncidents.toLocaleString()} />
              <StatCard
                label="TOTAL CASUALTIES"
                value={data.totalCasualties.toString()}
                accent={data.totalCasualties > 0 ? "#E5484D" : "#3EBD6B"}
              />
              <StatCard
                label="AVG RESPONSE TIME"
                value={data.avgResponseMinutes != null ? `${data.avgResponseMinutes}m` : "—"}
                sublabel={data.avgResponseMinutes == null ? "insufficient data" : undefined}
              />
              <StatCard
                label="TOP CAUSE"
                value={data.topCause ? truncate(data.topCause, 18) : "—"}
                accent="#F5751E"
              />
            </div>

            {/* Charts row */}
            <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="border border-[#2A2A2C] bg-[#0E0E0F] px-5 py-4">
                <p className="mb-3 font-mono text-[11px] tracking-wide text-[#6A6A6E]">
                  INCIDENTS BY MONTH
                </p>
                <IncidentsOverTimeChart data={data.incidentsByMonth} />
              </div>

              <div className="border border-[#2A2A2C] bg-[#0E0E0F] px-5 py-4">
                <p className="mb-3 font-mono text-[11px] tracking-wide text-[#6A6A6E]">
                  TOP CAUSES OF FIRE
                </p>
                <RankedBarList
                  items={data.topCauses.map((c) => ({ label: c.cause, count: c.count }))}
                  emptyLabel="No cause data recorded yet."
                />
              </div>
            </div>

            {/* Station activity */}
            <div className="border border-[#2A2A2C] bg-[#0E0E0F] px-5 py-4">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-[#6A6A6E]">
                MOST ACTIVE STATIONS
              </p>
              <RankedBarList
                items={data.topStations.map((s) => ({ label: s.station, count: s.count }))}
                emptyLabel="No station data recorded yet."
              />
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
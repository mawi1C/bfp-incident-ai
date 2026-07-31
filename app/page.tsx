import Link from "next/link";
import { getDashboardData } from "@/lib/dashboardQueries";
import StatCard from "@/components/StatCard";
import IncidentsOverTimeChart from "@/components/IncidentsOverTimeChart";
import RankedBarList from "@/components/RankedBarList";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Dashboard — BFP-NCR Incident Report",
};

// Re-fetch fresh data on every visit rather than serving a cached build —
// this dashboard needs to reflect whatever was most recently uploaded.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <main className="min-h-screen bg-[#0A0A0B] px-6 py-12">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#2A2A2C] pb-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-[#F5751E]">BFP–NCR</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#EDEDEC]">
              Incident Dashboard
            </h1>
          </div>
          <Nav active="/" />
        </div>

        {data.totalIncidents === 0 ? (
          <div className="border border-[#2A2A2C] bg-[#0E0E0F] px-6 py-16 text-center">
            <p className="text-sm text-[#8A8A8E]">No incident data logged yet.</p>
            <Link
              href="/upload"
              className="mt-4 inline-block border border-[#F5751E] px-4 py-2 font-mono text-xs text-[#F5751E] transition-colors hover:bg-[#F5751E] hover:text-[#0A0A0B]"
            >
              UPLOAD A REPORT
            </Link>
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
    </main>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
import Link from "next/link";
import PageShell from "@/components/PageShell";
import PrintButton from "@/components/PrintButton";
import StatCard from "@/components/StatCard";
import RankedBarList from "@/components/RankedBarList";
import IncidentsOverTimeChart from "@/components/IncidentsOverTimeChart";
import { getDashboardData, getFilterValues } from "@/lib/dashboardQueries";

export const metadata = { title: "Monthly Report — BFP-NCR Incident Dashboard" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ month?: string; district?: string }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { months, districts } = await getFilterValues();

  const month = params.month && months.includes(params.month) ? params.month : undefined;
  const district = params.district && districts.includes(params.district) ? params.district : undefined;

  const data = await getDashboardData({ month, district });

  const buildHref = (next: { month?: string; district?: string }) => {
    const sp = new URLSearchParams();
    if (next.month) sp.set("month", next.month);
    if (next.district) sp.set("district", next.district);
    const qs = sp.toString();
    return qs ? `/reports?${qs}` : "/reports";
  };

  const scopeLabel = [district, month ? formatMonth(month) : null].filter(Boolean).join(" — ") || "All Recorded Data";

  return (
    <>
      <PageShell>
        <div className="print:hidden">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 border-b border-[#2A2A2C] pb-4">
              <h1 className="text-2xl font-semibold tracking-tight text-[#EDEDEC]">
                Monthly Report
              </h1>
            </div>

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
                    {formatMonth(m)}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="border border-[#F5751E] px-4 py-1.5 text-sm font-medium text-[#F5751E] transition-colors hover:bg-[#F5751E] hover:text-[#0A0A0B]"
              >
                Generate
              </button>
              {(month || district) && (
                <Link
                  href="/reports"
                  className="font-mono text-xs text-[#6A6A6E] underline decoration-dotted hover:text-[#EDEDEC]"
                >
                  clear
                </Link>
              )}
            </form>

            <p className="mb-4 font-mono text-[11px] text-[#5A5A5E]">
              Scope: {scopeLabel} · {data.totalIncidents.toLocaleString()} incidents
            </p>

            {data.totalIncidents === 0 ? (
              <div className="mb-6 border border-[#2A2A2C] bg-[#0E0E0F] px-6 py-16 text-center text-sm text-[#8A8A8E]">
                No incidents match this scope — nothing to report.
              </div>
            ) : (
              <div className="mb-6">
                <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="TOTAL INCIDENTS" value={data.totalIncidents.toLocaleString()} />
                  <StatCard
                    label="TOTAL CASUALTIES"
                    value={data.totalCasualties.toString()}
                    accent={data.totalCasualties > 0 ? "#E5484D" : "#3EBD6B"}
                  />
                  <StatCard
                    label="AVG RESPONSE"
                    value={data.avgResponseMinutes != null ? `${data.avgResponseMinutes}m` : "—"}
                  />
                  <StatCard label="TOP CAUSE" value={data.topCause ? truncate(data.topCause, 16) : "—"} accent="#F5751E" />
                </div>

                <div className="mb-3 border border-[#2A2A2C] bg-[#0E0E0F] px-5 py-4">
                  <p className="mb-3 font-mono text-[11px] tracking-wide text-[#6A6A6E]">INCIDENTS BY MONTH</p>
                  <IncidentsOverTimeChart data={data.incidentsByMonth} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="border border-[#2A2A2C] bg-[#0E0E0F] px-5 py-4">
                    <p className="mb-3 font-mono text-[11px] tracking-wide text-[#6A6A6E]">TOP CAUSES</p>
                    <RankedBarList
                      items={data.topCauses.map((c) => ({ label: c.cause, count: c.count }))}
                      emptyLabel="No cause data."
                    />
                  </div>
                  <div className="border border-[#2A2A2C] bg-[#0E0E0F] px-5 py-4">
                    <p className="mb-3 font-mono text-[11px] tracking-wide text-[#6A6A6E]">TOP STATIONS</p>
                    <RankedBarList
                      items={data.topStations.map((s) => ({ label: s.station, count: s.count }))}
                      emptyLabel="No station data."
                    />
                  </div>
                </div>
              </div>
            )}

            <p className="mb-2 text-xs text-[#5A5A5E]">
              This is the data preview — the printed/PDF page uses a separate formal layout, not this dark theme.
            </p>
            <PrintButton />
          </div>
        </div>
      </PageShell>

      {/* Print document. Sits fully outside PageShell/the sidebar layout so
          no sidebar margin or chrome can bleed into the printed page. */}
      <div className="hidden bg-white px-12 py-10 text-black print:block">
        <div className="mb-6 border-b-2 border-black pb-4 text-center">
          <p className="text-xs">Republic of the Philippines</p>
          <p className="text-xs">Department of the Interior and Local Government</p>
          <p className="text-sm font-bold">BUREAU OF FIRE PROTECTION</p>
          <p className="text-sm font-bold">NATIONAL CAPITAL REGION</p>
          <p className="mt-3 text-base font-bold underline">INCIDENT SUMMARY REPORT</p>
          <p className="text-sm">{scopeLabel}</p>
          <p className="mt-1 text-[10px] text-gray-600">
            Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <table className="mb-6 w-full border-collapse text-sm">
          <tbody>
            <ReportRow label="Total Incidents" value={data.totalIncidents.toLocaleString()} />
            <ReportRow label="Total Casualties" value={data.totalCasualties.toString()} />
            <ReportRow
              label="Average Response Time"
              value={data.avgResponseMinutes != null ? `${data.avgResponseMinutes} minutes` : "Insufficient data"}
            />
            <ReportRow label="Most Common Cause" value={data.topCause ?? "—"} />
          </tbody>
        </table>

        <ReportSection title="Top Causes of Fire">
          <ReportTable rows={data.topCauses.map((c) => [c.cause, c.count.toString()])} />
        </ReportSection>

        <ReportSection title="Most Active Stations">
          <ReportTable rows={data.topStations.map((s) => [s.station, s.count.toString()])} />
        </ReportSection>

        <ReportSection title="Incidents by Month">
          <ReportTable rows={data.incidentsByMonth.map((m) => [m.month, m.count.toString()])} />
        </ReportSection>

        <p className="mt-10 text-[10px] text-gray-500">
          Generated from BFP-NCR Incident Dashboard. Figures reflect uploaded consolidated fire
          incident reports as of the generation date above and may not include the current month
          if not yet uploaded.
        </p>
      </div>
    </>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-gray-300">
      <td className="w-1/2 py-1.5 font-semibold">{label}</td>
      <td className="py-1.5">{value}</td>
    </tr>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 break-inside-avoid">
      <p className="mb-2 border-b border-black pb-1 text-sm font-bold uppercase tracking-wide">
        {title}
      </p>
      {children}
    </div>
  );
}

function ReportTable({ rows }: { rows: [string, string][] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-gray-500">No data recorded.</p>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} className="border-b border-gray-200">
            <td className="py-1">{label}</td>
            <td className="w-16 py-1 text-right font-mono">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}
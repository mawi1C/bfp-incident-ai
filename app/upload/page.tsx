import Link from "next/link";
import PageShell from "@/components/PageShell";
import UploadZone from "@/components/UploadZone";
import InvestigationUploadZone from "@/components/InvestigationUploadZone";

export const metadata = {
  title: "Report Intake — BFP-NCR Incident Dashboard",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function UploadPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const activeTab = params.tab === "investigation" ? "investigation" : "incidents";

  return (
    <PageShell>
      <div className="flex flex-col items-center">
        <div className="w-full max-w-xl">
          <div className="mb-6 border-b border-[#2A2A2C] pb-4">
            <h1 className="text-2xl font-semibold tracking-tight text-[#EDEDEC]">
              Report Intake
            </h1>
          </div>

          {/* Tab switcher — driven entirely by URL, so refresh/back-button/
              bookmarking all behave correctly without any client-side state. */}
          <div className="mb-4 flex border-b border-[#2A2A2C]">
            <Link
              href="/upload?tab=incidents"
              className={`px-4 py-2 font-mono text-xs transition-colors ${
                activeTab === "incidents"
                  ? "border-b-2 border-[#F5751E] text-[#F5751E]"
                  : "text-[#6A6A6E] hover:text-[#EDEDEC]"
              }`}
            >
              CONSOLIDATED REPORT
            </Link>
            <Link
              href="/upload?tab=investigation"
              className={`px-4 py-2 font-mono text-xs transition-colors ${
                activeTab === "investigation"
                  ? "border-b-2 border-[#F5751E] text-[#F5751E]"
                  : "text-[#6A6A6E] hover:text-[#EDEDEC]"
              }`}
            >
              CASE FILE
            </Link>
          </div>

          {activeTab === "incidents" ? (
            <>
              <UploadZone />
              <p className="mt-6 text-xs leading-relaxed text-[#5A5A5E]">
                Upload the station&apos;s consolidated fire incident report for any month.
                The original file is archived and every row is logged for the query
                assistant to search — including rows the parser couldn&apos;t fully
                read, which are kept for manual review rather than dropped silently.
              </p>
            </>
          ) : (
            <>
              <InvestigationUploadZone />
              <p className="mt-6 text-xs leading-relaxed text-[#5A5A5E]">
                Upload a &quot;Monthly Fire Incident Monitoring&quot; workbook from the Fire
                Arson Investigation Division. Each case is matched to an existing incident
                by date and address where possible — unmatched cases are kept for manual
                review on the{" "}
                <Link href="/investigations" className="text-[#F5751E] hover:underline">
                  Case Records
                </Link>{" "}
                page rather than dropped.
              </p>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
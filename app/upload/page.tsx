import UploadZone from "@/components/UploadZone";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Report Intake — BFP-NCR Incident Dashboard",
};

export default function UploadPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[#0A0A0B] px-6 py-16">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex items-end justify-between border-b border-[#2A2A2C] pb-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-[#F5751E]">
              BFP–NCR
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#EDEDEC]">
              Report Intake
            </h1>
          </div>
          <Nav active="/upload" />
        </div>

        <UploadZone />

        <p className="mt-6 text-xs leading-relaxed text-[#5A5A5E]">
          Upload the station&apos;s consolidated fire incident report for any month.
          The original file is archived and every row is logged for the query
          assistant to search — including rows the parser couldn&apos;t fully
          read, which are kept for manual review rather than dropped silently.
        </p>
      </div>
    </main>
  );
}
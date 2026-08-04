import Link from "next/link";
import InvestigationUploadZone from "@/components/InvestigationUploadZone";
import Nav from "@/components/Nav";

export const metadata = { title: "Case Intake — BFP-NCR Incident Dashboard" };

export default function UploadInvestigationPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[#0A0A0B] px-6 py-16">
      <div className="w-full max-w-xl">
        <div className="mb-2">
          <Link href="/investigations" className="font-mono text-[11px] text-[#6A6A6E] hover:text-[#F5751E]">
            ← case records
          </Link>
        </div>
        <div className="mb-8 flex items-end justify-between border-b border-[#2A2A2C] pb-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-[#F5751E]">BFP–NCR</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#EDEDEC]">
              Case Intake
            </h1>
          </div>
          <Nav active="/investigations" />
        </div>

        <InvestigationUploadZone />

        <p className="mt-6 text-xs leading-relaxed text-[#5A5A5E]">
          Upload the Fire Arson Investigation Division&apos;s Monthly Fire Incident Monitoring
          workbook. Each record is automatically matched to an existing incident by date and
          location where possible. Unmatched records are kept and flagged for manual review
          rather than dropped.
        </p>
      </div>
    </main>
  );
}
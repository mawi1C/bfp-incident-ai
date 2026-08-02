"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="border border-[#F5751E] px-4 py-2 text-sm font-medium text-[#F5751E] transition-colors hover:bg-[#F5751E] hover:text-[#0A0A0B] print:hidden"
    >
      Print / Save as PDF
    </button>
  );
}
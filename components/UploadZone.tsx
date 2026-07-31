"use client";

import { useCallback, useRef, useState } from "react";

type UploadStatus = "idle" | "dragging" | "uploading" | "success" | "error";

interface UploadResult {
  success?: boolean;
  fileName?: string;
  reportMonth?: string | null;
  sheetsProcessed?: string[];
  insertedCount?: number;
  duplicateCount?: number;
  skippedRowCount?: number;
  error?: string;
  duplicateType?: "exact";
}

export default function UploadZone() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setStatus("uploading");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data: UploadResult = await res.json();
      if (!res.ok) {
        setResult(data);
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("success");
    } catch {
      setResult({ error: "Connection lost before the file finished uploading." });
      setStatus("error");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="w-full max-w-xl">
      {/* Console header strip */}
      <div className="flex items-center justify-between border border-[#2A2A2C] bg-[#141415] px-4 py-2 font-mono text-[11px] tracking-wide text-[#8A8A8E]">
        <span>INTAKE&nbsp;/&nbsp;01</span>
        <span
          className={
            status === "uploading"
              ? "text-[#F5751E]"
              : status === "success"
              ? "text-[#3EBD6B]"
              : status === "error"
              ? "text-[#E5484D]"
              : "text-[#5A5A5E]"
          }
        >
          {status === "idle" && "STANDBY"}
          {status === "dragging" && "READY"}
          {status === "uploading" && "PARSING…"}
          {status === "success" && "LOGGED"}
          {status === "error" && "REJECTED"}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (status !== "uploading") setStatus("dragging");
        }}
        onDragLeave={() => status === "dragging" && setStatus("idle")}
        onDrop={onDrop}
        onClick={() => status !== "uploading" && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center border border-t-0 px-8 py-14 text-center transition-colors ${
          status === "dragging"
            ? "border-[#F5751E] bg-[#1A1512]"
            : "border-[#2A2A2C] bg-[#0E0E0F] hover:border-[#4A4A4E]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {status === "uploading" ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin border-2 border-[#2A2A2C] border-t-[#F5751E]" />
            <p className="font-mono text-xs text-[#8A8A8E]">reading {fileName}</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex h-10 w-10 items-center justify-center border border-[#3A3A3E] text-[#F5751E]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 3v12M7 10l5-5 5 5M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#EDEDEC]">
              Drop the consolidated incident report here
            </p>
            <p className="mt-1 font-mono text-xs text-[#6A6A6E]">.xlsx · .xls · .csv — click to browse</p>
          </>
        )}
      </div>

      {/* Result readout */}
      {result && (
        <div className="border border-t-0 border-[#2A2A2C] bg-[#141415] px-4 py-3 font-mono text-xs">
          {status === "success" ? (
            <div className="flex flex-col gap-1.5">
              <Row label="FILE" value={result.fileName ?? "—"} />
              <Row label="MONTH" value={result.reportMonth ?? "unrecognized"} />
              <Row label="SHEETS READ" value={(result.sheetsProcessed ?? []).join(", ") || "—"} />
              <Row label="NEW RECORDS" value={`${result.insertedCount ?? 0} logged`} accent="#3EBD6B" />
              {typeof result.duplicateCount === "number" && result.duplicateCount > 0 && (
                <Row
                  label="DUPLICATES"
                  value={`${result.duplicateCount} already on file — skipped`}
                  accent="#8A8A8E"
                />
              )}
              {typeof result.skippedRowCount === "number" && result.skippedRowCount > 0 && (
                <Row
                  label="UNPARSED"
                  value={`${result.skippedRowCount} row(s) unrecognized — see raw_row in DB`}
                  accent="#F5A623"
                />
              )}
            </div>
          ) : (
            <Row label="ERROR" value={result.error ?? "Upload failed."} accent="#E5484D" />
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-28 shrink-0 text-[#5A5A5E]">{label}</span>
      <span style={accent ? { color: accent } : undefined} className="text-[#C9C9C7]">
        {value}
      </span>
    </div>
  );
}
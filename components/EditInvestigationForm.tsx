"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  initial: {
    date_of_fire: string | null;
    exact_location: string | null;
    city_municipality: string | null;
    cause: string | null;
    classification_of_case: string | null;
    fire_arson_investigator: string | null;
    remarks: string | null;
  };
}

export default function EditInvestigationForm({ id, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = (key: keyof typeof form, label: string, type: "text" | "date" = "text") => (
    <div className="mb-3">
      <label className="mb-1 block font-mono text-[11px] text-[#6A6A6E]">{label}</label>
      <input
        type={type}
        value={form[key] ?? ""}
        onChange={(e) => {
          setForm((f) => ({ ...f, [key]: e.target.value }));
          setSaved(false);
        }}
        className="w-full border border-[#2A2A2C] bg-[#0E0E0F] px-3 py-2 text-sm text-[#EDEDEC] outline-none focus:border-[#F5751E]"
      />
    </div>
  );

  const handleSave = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/investigations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Save failed.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Connection lost.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="border border-[#2A2A2C] bg-[#0E0E0F] p-4">
      <p className="mb-3 font-mono text-[11px] tracking-wide text-[#6A6A6E]">EDIT CASE DETAILS</p>
      {field("date_of_fire", "DATE OF FIRE", "date")}
      {field("exact_location", "EXACT LOCATION")}
      {field("city_municipality", "CITY / MUNICIPALITY")}
      {field("cause", "CAUSE")}
      {field("classification_of_case", "CLASSIFICATION OF CASE")}
      {field("fire_arson_investigator", "FIRE ARSON INVESTIGATOR")}
      {field("remarks", "REMARKS")}

      {error && (
        <p className="mb-3 border border-[#E5484D]/40 bg-[#1A1213] px-3 py-2 font-mono text-xs text-[#E5A6A8]">
          {error}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={pending}
        className="border border-[#F5751E] px-4 py-2 text-sm font-medium text-[#F5751E] transition-colors hover:bg-[#F5751E] hover:text-[#0A0A0B] disabled:opacity-50"
      >
        {pending ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
      </button>
    </div>
  );
}
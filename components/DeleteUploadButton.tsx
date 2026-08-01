"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  fileName: string;
  rowCount: number;
}

export default function DeleteUploadButton({ id, fileName, rowCount }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete "${fileName}" and all ${rowCount.toLocaleString()} incidents from it? This cannot be undone.`
    );
    if (!confirmed) return;

    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/uploads/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Delete failed.");
        setPending(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Connection lost.");
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDelete}
        disabled={pending}
        className="border border-[#2A2A2C] px-3 py-1 font-mono text-[11px] text-[#8A8A8E] transition-colors hover:border-[#E5484D] hover:text-[#E5484D] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "DELETING…" : "DELETE"}
      </button>
      {error && <p className="font-mono text-[10px] text-[#E5484D]">{error}</p>}
    </div>
  );
}
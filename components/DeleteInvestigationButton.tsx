"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteInvestigationButton({ id, location }: { id: string; location: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(`Delete this case record${location ? ` (${location})` : ""}? This cannot be undone.`);
    if (!confirmed) return;

    setPending(true);
    try {
      const res = await fetch(`/api/investigations/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error ?? "Delete failed.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="font-mono text-[11px] text-[#5A5A5E] transition-colors hover:text-[#E5484D] disabled:opacity-50"
    >
      {pending ? "…" : "delete"}
    </button>
  );
}
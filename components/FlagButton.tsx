"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  flagged: boolean;
  flagNote: string | null;
}

export default function FlagButton({ id, flagged, flagNote }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    let note: string | null = null;

    if (!flagged) {
      note = window.prompt("Optional note about what looks wrong (leave blank to skip):", "");
      if (note === null) return; // cancelled
    } else {
      const confirmed = window.confirm("Clear this flag?");
      if (!confirmed) return;
    }

    setPending(true);
    try {
      await fetch(`/api/incidents/${id}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagged: !flagged, note: note || undefined }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={flagged ? flagNote ?? "Flagged for review" : "Flag for review"}
      className={`font-mono text-[11px] transition-colors disabled:opacity-50 ${
        flagged ? "text-[#F5A623] hover:text-[#8A8A8E]" : "text-[#3A3A3E] hover:text-[#F5A623]"
      }`}
    >
      {flagged ? "⚑ flagged" : "⚑ flag"}
    </button>
  );
}
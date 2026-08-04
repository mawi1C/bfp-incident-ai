import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { matchIncident } from "@/lib/matchIncident";

export const runtime = "nodejs";

export async function POST() {
  const { data: unmatched, error } = await supabaseAdmin
    .from("investigation_records")
    .select("id, date_of_fire, exact_location")
    .eq("match_status", "unmatched");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let newlyMatched = 0;

  for (const rec of unmatched ?? []) {
    const normalizedLocation = (rec.exact_location ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const { incidentId, confidence } = await matchIncident(rec.date_of_fire, normalizedLocation);

    if (incidentId) {
      await supabaseAdmin
        .from("investigation_records")
        .update({ incident_id: incidentId, match_confidence: confidence, match_status: "matched" })
        .eq("id", rec.id);
      newlyMatched++;
    }
  }

  return NextResponse.json({
    success: true,
    checked: unmatched?.length ?? 0,
    newlyMatched,
    stillUnmatched: (unmatched?.length ?? 0) - newlyMatched,
  });
}
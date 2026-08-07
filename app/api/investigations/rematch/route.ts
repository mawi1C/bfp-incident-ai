import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { matchIncident } from "@/lib/matchIncident";
import { dateToISO } from "@/lib/parseInvestigationReport";

export const runtime = "nodejs";

export async function POST() {
  // Step 1: repair any records with a null date_of_fire by re-parsing the
  // original cell value straight from the stored raw_row JSON. This
  // catches records inserted by an older version of the date parser
  // (before it learned to tolerate typos like "28 FE B 26") without
  // needing the source file re-uploaded — raw_row.col_2 holds exactly
  // what was originally in that cell.
  const { data: nullDateRecords, error: fetchError } = await supabaseAdmin
    .from("investigation_records")
    .select("id, raw_row")
    .is("date_of_fire", null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  let datesRepaired = 0;
  for (const rec of nullDateRecords ?? []) {
    const originalCellValue = (rec.raw_row as Record<string, unknown> | null)?.["col_2"];
    if (originalCellValue == null) continue;

    const { iso, raw } = dateToISO(originalCellValue);
    if (iso) {
      await supabaseAdmin
        .from("investigation_records")
        .update({ date_of_fire: iso, date_of_fire_raw: raw })
        .eq("id", rec.id);
      datesRepaired++;
    }
  }

  // Step 2: attempt matching for every currently-unmatched record,
  // including the ones whose date we just repaired above.
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
    datesRepaired,
    checked: unmatched?.length ?? 0,
    newlyMatched,
    stillUnmatched: (unmatched?.length ?? 0) - newlyMatched,
  });
}
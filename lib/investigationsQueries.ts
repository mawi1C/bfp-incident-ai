import { supabaseAdmin } from "@/lib/supabase";

export interface UnmatchedRecord {
  id: string;
  date_of_fire: string | null;
  exact_location: string | null;
  fire_arson_investigator: string | null;
  cause: string | null;
  match_confidence: number | null;
  source_file_name: string;
}

export async function getUnmatchedRecords(): Promise<UnmatchedRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("investigation_records")
    .select("id, date_of_fire, exact_location, fire_arson_investigator, cause, match_confidence, source_file_name")
    .eq("match_status", "unmatched")
    .order("date_of_fire", { ascending: false });

  if (error) {
    console.error("getUnmatchedRecords failed:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getInvestigationStats(): Promise<{ total: number; matched: number; unmatched: number }> {
  const { count: total } = await supabaseAdmin
    .from("investigation_records")
    .select("*", { count: "exact", head: true });
  const { count: matched } = await supabaseAdmin
    .from("investigation_records")
    .select("*", { count: "exact", head: true })
    .eq("match_status", "matched");

  return {
    total: total ?? 0,
    matched: matched ?? 0,
    unmatched: (total ?? 0) - (matched ?? 0),
  };
}
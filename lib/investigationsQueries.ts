import { supabaseAdmin } from "@/lib/supabase";

const PAGE_SIZE = 25;

export interface InvestigationRow {
  id: string;
  date_of_fire: string | null;
  city_municipality: string | null;
  exact_location: string | null;
  cause: string | null;
  classification_of_case: string | null;
  fire_arson_investigator: string | null;
  match_status: string;
  match_confidence: number | null;
  incident_id: string | null;
  source_file_name: string;
  cloudinary_url: string;
}

export interface InvestigationFilters {
  q?: string;
  city?: string;
  month?: string; // "YYYY-MM"
  matchStatus?: "matched" | "unmatched";
  page?: number;
}

export interface InvestigationPageResult {
  rows: InvestigationRow[];
  totalCount: number;
  page: number;
  totalPages: number;
}

export async function getInvestigationRecordsPage(
  filters: InvestigationFilters
): Promise<InvestigationPageResult> {
  const page = Math.max(filters.page ?? 1, 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabaseAdmin
    .from("investigation_records")
    .select(
      "id, date_of_fire, city_municipality, exact_location, cause, classification_of_case, fire_arson_investigator, match_status, match_confidence, incident_id, source_file_name, cloudinary_url",
      { count: "exact" }
    )
    .order("date_of_fire", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (filters.city) query = query.eq("city_municipality", filters.city);
  if (filters.matchStatus) query = query.eq("match_status", filters.matchStatus);
  if (filters.month) {
    const [year, month] = filters.month.split("-").map(Number);
    const start = `${filters.month}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    query = query.gte("date_of_fire", start).lt("date_of_fire", nextMonth);
  }
  if (filters.q) {
    query = query.or(`exact_location.ilike.%${filters.q}%,cause.ilike.%${filters.q}%,fire_arson_investigator.ilike.%${filters.q}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("getInvestigationRecordsPage failed:", error.message);
    return { rows: [], totalCount: 0, page, totalPages: 0 };
  }

  const totalCount = count ?? 0;
  return {
    rows: (data ?? []) as InvestigationRow[],
    totalCount,
    page,
    totalPages: Math.max(Math.ceil(totalCount / PAGE_SIZE), 1),
  };
}

export async function getInvestigationFilterOptions(): Promise<{ cities: string[]; months: string[] }> {
  const { data: cityRows } = await supabaseAdmin
    .from("investigation_records")
    .select("city_municipality")
    .not("city_municipality", "is", null);

  const { data: monthRows } = await supabaseAdmin.rpc("execute_sql", {
    query: `select distinct to_char(date_of_fire, 'YYYY-MM') as month
            from investigation_records where date_of_fire is not null order by month`,
  });

  const cities = Array.from(
    new Set((cityRows ?? []).map((r: { city_municipality: string | null }) => r.city_municipality).filter(Boolean))
  ).sort() as string[];

  const months = ((monthRows ?? []) as { month: string }[]).map((r) => r.month);

  return { cities, months };
}

export interface InvestigationDetail extends InvestigationRow {
  region: string | null;
  province_district: string | null;
  property_general_category: string | null;
  property_sub_category: string | null;
  name_of_establishment: string | null;
  number_of_storeys: number | null;
  name_of_owner: string | null;
  name_of_occupant: string | null;
  time_of_alarm_raw: string | null;
  time_fire_started_raw: string | null;
  fire_out_raw: string | null;
  injured_firefighter_male: number;
  injured_firefighter_female: number;
  injured_civilian_male: number;
  injured_civilian_female: number;
  fatalities_firefighter_male: number;
  fatalities_firefighter_female: number;
  fatalities_civilian_male: number;
  fatalities_civilian_female: number;
  estimated_cost_of_damage: number | null;
  number_of_affected_structures: number | null;
  alarm_status: string | null;
  remarks: string | null;
  date_of_fire_raw: string | null;
}

export async function getInvestigationRecordById(id: string): Promise<InvestigationDetail | null> {
  const { data, error } = await supabaseAdmin
    .from("investigation_records")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("getInvestigationRecordById failed:", error.message);
    return null;
  }
  return data as InvestigationDetail;
}

export async function getUnmatchedRecords() {
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
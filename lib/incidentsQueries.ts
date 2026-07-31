import { supabaseAdmin } from "@/lib/supabase";

const PAGE_SIZE = 25;

export interface IncidentRow {
  id: string;
  station: string | null;
  date_of_response: string | null;
  location: string | null;
  cause_of_fire: string | null;
  alarm_status: string | null;
  responding_unit_raw: string | null;
  casualties_injured_civilian: number;
  casualties_injured_bfp: number;
  casualties_death_civilian: number;
  casualties_death_bfp: number;
  source_file_name: string;
  cloudinary_url: string;
}

export interface IncidentsPageResult {
  rows: IncidentRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IncidentFilters {
  station?: string;
  month?: string; // "2026-06" format
  q?: string; // free-text search across location + cause
  page?: number;
}

export async function getIncidentsPage(filters: IncidentFilters): Promise<IncidentsPageResult> {
  const page = Math.max(filters.page ?? 1, 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabaseAdmin
    .from("incidents")
    .select(
      "id, station, date_of_response, location, cause_of_fire, alarm_status, responding_unit_raw, casualties_injured_civilian, casualties_injured_bfp, casualties_death_civilian, casualties_death_bfp, source_file_name, cloudinary_url",
      { count: "exact" }
    )
    .order("date_of_response", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (filters.station) {
    query = query.eq("station", filters.station);
  }
  if (filters.month) {
    // filters.month is "YYYY-MM" — build a date range for that calendar month
    const [year, month] = filters.month.split("-").map(Number);
    const start = `${filters.month}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    query = query.gte("date_of_response", start).lt("date_of_response", nextMonth);
  }
  if (filters.q) {
    // search both location and cause_of_fire
    query = query.or(`location.ilike.%${filters.q}%,cause_of_fire.ilike.%${filters.q}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("getIncidentsPage failed:", error.message);
    return { rows: [], totalCount: 0, page, pageSize: PAGE_SIZE, totalPages: 0 };
  }

  const totalCount = count ?? 0;
  return {
    rows: (data ?? []) as IncidentRow[],
    totalCount,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(Math.ceil(totalCount / PAGE_SIZE), 1),
  };
}

export async function getFilterOptions(): Promise<{ stations: string[]; months: string[] }> {
  const [{ data: stationRows }, { data: monthRows }] = await Promise.all([
    supabaseAdmin.from("incidents").select("station").not("station", "is", null),
    supabaseAdmin.rpc("execute_sql", {
      query: `select distinct to_char(date_of_response, 'YYYY-MM') as month
              from incidents where date_of_response is not null order by month`,
    }),
  ]);

  const stations = Array.from(
    new Set((stationRows ?? []).map((r: { station: string | null }) => r.station).filter(Boolean))
  ).sort() as string[];

  const months = ((monthRows ?? []) as { month: string }[]).map((r) => r.month);

  return { stations, months };
}
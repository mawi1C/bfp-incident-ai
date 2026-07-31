import { supabaseAdmin } from "@/lib/supabase";

interface SummaryRow {
  total_incidents: number;
  total_casualties: number;
  avg_response_minutes: number | null;
}

export interface DashboardData {
  totalIncidents: number;
  totalCasualties: number;
  avgResponseMinutes: number | null;
  topCause: string | null;
  incidentsByMonth: { month: string; count: number }[];
  topCauses: { cause: string; count: number }[];
  topStations: { station: string; count: number }[];
}

async function runQuery<T>(sql: string): Promise<T[]> {
  const { data, error } = await supabaseAdmin.rpc("execute_sql", { query: sql.trim() });
  if (error) {
    console.error(
      "Dashboard query failed:",
      JSON.stringify(
        { message: error.message, details: error.details, hint: error.hint, code: error.code },
        null,
        2
      ),
      "\nSQL:",
      sql
    );
    return [];
  }
  return (data ?? []) as T[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const [summaryRows, monthRows, causeRows, stationRows] = await Promise.all([
    runQuery<SummaryRow>(`
      select
        count(*)::int as total_incidents,
        coalesce(sum(
          casualties_injured_civilian + casualties_injured_bfp +
          casualties_death_civilian + casualties_death_bfp
        ), 0)::int as total_casualties,
        round(avg(response_time_minutes)::numeric, 1) as avg_response_minutes
      from incidents
    `),
    runQuery<{ month: string; count: number }>(`
      select
        to_char(date_trunc('month', date_of_response), 'Mon YYYY') as month,
        count(*)::int as count
      from incidents
      where date_of_response is not null
      group by date_trunc('month', date_of_response), to_char(date_trunc('month', date_of_response), 'Mon YYYY')
      order by date_trunc('month', date_of_response)
    `),
    runQuery<{ cause: string; count: number }>(`
      select cause_of_fire as cause, count(*)::int as count
      from incidents
      where cause_of_fire is not null and cause_of_fire <> ''
      group by cause_of_fire
      order by count desc
      limit 6
    `),
    runQuery<{ station: string; count: number }>(`
      select station, count(*)::int as count
      from incidents
      where station is not null
      group by station
      order by count desc
      limit 6
    `),
  ]);

  const summary = summaryRows[0];

  return {
    totalIncidents: summary?.total_incidents ?? 0,
    totalCasualties: summary?.total_casualties ?? 0,
    avgResponseMinutes: summary?.avg_response_minutes ?? null,
    topCause: causeRows[0]?.cause ?? null,
    incidentsByMonth: monthRows,
    topCauses: causeRows,
    topStations: stationRows,
  };
}
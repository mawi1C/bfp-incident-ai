import { supabaseAdmin } from "@/lib/supabase";

export interface DashboardFilters {
  month?: string; // "YYYY-MM", validated against getFilterValues() before use
  district?: string; // validated against getFilterValues() before use
}

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

export async function getFilterValues(): Promise<{ months: string[]; districts: string[] }> {
  const [monthRows, districtRows] = await Promise.all([
    runQuery<{ month: string }>(`
      select distinct to_char(date_of_response, 'YYYY-MM') as month
      from incidents where date_of_response is not null order by month
    `),
    runQuery<{ district: string }>(`
      select distinct fire_district as district
      from incidents where fire_district is not null order by district
    `),
  ]);
  return {
    months: monthRows.map((r) => r.month),
    districts: districtRows.map((r) => r.district),
  };
}

/** Builds a SQL WHERE clause from filters ALREADY validated against
 * getFilterValues() by the caller. Never call this with raw, unvalidated
 * user input — the values get interpolated directly into SQL text since
 * execute_sql only accepts a single query string, not bound parameters. */
function buildWhereClause(filters: DashboardFilters): string {
  const conditions: string[] = [];
  if (filters.month) {
    conditions.push(`to_char(date_of_response, 'YYYY-MM') = '${filters.month}'`);
  }
  if (filters.district) {
    conditions.push(`fire_district = '${filters.district.replace(/'/g, "''")}'`);
  }
  return conditions.length ? `where ${conditions.join(" and ")}` : "";
}

export async function getDashboardData(filters: DashboardFilters = {}): Promise<DashboardData> {
  const where = buildWhereClause(filters);
  const andWhere = where ? where.replace("where", "and") : "";

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
      ${where}
    `),
    runQuery<{ month: string; count: number }>(`
      select
        to_char(date_trunc('month', date_of_response), 'Mon YYYY') as month,
        count(*)::int as count
      from incidents
      where date_of_response is not null
      ${andWhere}
      group by date_trunc('month', date_of_response), to_char(date_trunc('month', date_of_response), 'Mon YYYY')
      order by date_trunc('month', date_of_response)
    `),
    runQuery<{ cause: string; count: number }>(`
      select cause_of_fire as cause, count(*)::int as count
      from incidents
      where cause_of_fire is not null and cause_of_fire <> ''
      ${andWhere}
      group by cause_of_fire
      order by count desc
      limit 6
    `),
    runQuery<{ station: string; count: number }>(`
      select station, count(*)::int as count
      from incidents
      where station is not null
      ${andWhere}
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
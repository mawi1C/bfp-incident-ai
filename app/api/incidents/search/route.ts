import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const date = req.nextUrl.searchParams.get("date") ?? "";

  let query = supabaseAdmin
    .from("incidents")
    .select("id, date_of_response, station, location, cause_of_fire")
    .order("date_of_response", { ascending: false })
    .limit(20);

  if (date) {
    // Default to the exact date, but widen to ±1 day too — mirrors the
    // matcher's own tolerance, since the two source documents sometimes
    // disagree on the calendar day for the same fire near midnight.
    const d = new Date(date);
    const prev = new Date(d);
    prev.setDate(d.getDate() - 1);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    query = query.gte("date_of_response", prev.toISOString().slice(0, 10)).lte(
      "date_of_response",
      next.toISOString().slice(0, 10)
    );
  }
  if (q) {
    query = query.ilike("location", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
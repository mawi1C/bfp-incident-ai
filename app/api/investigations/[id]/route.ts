import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Fields an officer is allowed to correct via the edit form. Deliberately
// a whitelist rather than accepting the whole request body — prevents a
// client from overwriting internal bookkeeping fields (incident_id,
// match_status, investigation_key, raw_row, etc.) through this endpoint.
const EDITABLE_FIELDS = [
  "date_of_fire",
  "exact_location",
  "city_municipality",
  "province_district",
  "cause",
  "classification_of_case",
  "fire_arson_investigator",
  "name_of_owner",
  "name_of_occupant",
  "estimated_cost_of_damage",
  "number_of_affected_structures",
  "remarks",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No editable fields provided." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("investigation_records").update(updates).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { error } = await supabaseAdmin.from("investigation_records").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
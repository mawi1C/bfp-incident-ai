import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { incidentId } = (await req.json()) as { incidentId: string | null };

  const { error } = await supabaseAdmin
    .from("investigation_records")
    .update({
      incident_id: incidentId,
      match_status: incidentId ? "matched" : "unmatched",
      // A manual link doesn't come from the similarity algorithm, so there's
      // no meaningful confidence score — null distinguishes "an officer
      // confirmed this by hand" from "the matcher scored this automatically".
      match_confidence: null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
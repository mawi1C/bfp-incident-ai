import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { flagged, note } = (await req.json()) as { flagged: boolean; note?: string };

  const { error } = await supabaseAdmin
    .from("incidents")
    .update({
      flagged,
      flag_note: flagged ? note ?? null : null,
      flagged_at: flagged ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
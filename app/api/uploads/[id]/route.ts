import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateCache } from "@/lib/queryCache";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing file id." }, { status: 400 });
  }

  // Explicit delete rather than relying on ON DELETE CASCADE — that
  // constraint was found not to fire reliably on this project's live
  // table earlier, so this is the same manual two-step approach used
  // during cleanup throughout development.
  const { error: incidentsError } = await supabaseAdmin
    .from("incidents")
    .delete()
    .eq("source_file_id", id);

  if (incidentsError) {
    return NextResponse.json(
      { error: `Failed to delete incidents: ${incidentsError.message}` },
      { status: 500 }
    );
  }

  const { error: fileError } = await supabaseAdmin.from("source_files").delete().eq("id", id);

  if (fileError) {
    return NextResponse.json(
      { error: `Failed to delete source file: ${fileError.message}` },
      { status: 500 }
    );
  }

  // Removing data invalidates any cached chatbot answers computed against it.
  await invalidateCache();

  return NextResponse.json({ success: true });
}
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";
import { supabaseAdmin } from "@/lib/supabase";
import { parseWorkbook } from "@/lib/parseIncidentReport";
import { invalidateCache } from "@/lib/queryCache";

export const runtime = "nodejs"; // xlsx parsing needs Node, not the Edge runtime

const BATCH_SIZE = 500; // Supabase/Postgres insert batching to avoid oversized payloads

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const allowedExt = [".xlsx", ".xls", ".csv"];
    const hasAllowedExt = allowedExt.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasAllowedExt) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload .xlsx, .xls, or .csv." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = createHash("sha256").update(buffer).digest("hex");

    // Exact duplicate: this precise file (byte-for-byte) was already
    // uploaded before — no point re-parsing/re-checking anything.
    const { data: exactDuplicate } = await supabaseAdmin
      .from("source_files")
      .select("id, file_name, uploaded_at")
      .eq("file_hash", fileHash)
      .maybeSingle();

    if (exactDuplicate) {
      return NextResponse.json(
        {
          error: `This exact file was already uploaded (as "${exactDuplicate.file_name}" on ${new Date(
            exactDuplicate.uploaded_at
          ).toLocaleDateString()}). No new records were added.`,
          duplicateType: "exact",
        },
        { status: 409 }
      );
    }

    // Parse the workbook into normalized incident records. Each record
    // carries an incident_key fingerprint (station+date+location+unit) —
    // this is what actually protects against duplicates now, not any
    // file-level check. It correctly handles a file bundling multiple
    // months, two differently-named files with overlapping data, etc.
    const { incidents, reportMonth, skippedRowCount, sheetsProcessed } = parseWorkbook(buffer);

    if (incidents.length === 0) {
      const { url: cloudinaryUrl } = await uploadBufferToCloudinary(buffer, file.name);
      return NextResponse.json(
        {
          error:
            "No incident rows could be parsed from this file. The file was still saved to Cloudinary for manual review.",
          cloudinaryUrl,
          sheetsProcessed,
        },
        { status: 422 }
      );
    }

    const { url: cloudinaryUrl } = await uploadBufferToCloudinary(buffer, file.name);

    const { data: sourceFile, error: sourceFileError } = await supabaseAdmin
      .from("source_files")
      .insert({
        file_name: file.name,
        cloudinary_url: cloudinaryUrl,
        file_hash: fileHash,
        report_month: reportMonth,
        row_count: incidents.length,
      })
      .select()
      .single();

    if (sourceFileError || !sourceFile) {
      throw new Error(`Failed to record source file: ${sourceFileError?.message}`);
    }

    const rowsToInsert = incidents.map((inc) => ({
      ...inc,
      source_file_id: sourceFile.id,
      source_file_name: file.name,
      cloudinary_url: cloudinaryUrl,
    }));

    // Upsert with ignoreDuplicates: true == "INSERT ... ON CONFLICT (incident_key)
    // DO NOTHING". Rows whose incident_key already exists (from ANY previous
    // upload, regardless of filename) are silently skipped rather than
    // erroring or duplicating. We diff the returned rows against the batch
    // to know how many were actually new vs. skipped as already-present.
    let insertedCount = 0;
    let duplicateCount = 0;
    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("incidents")
        .upsert(batch, { onConflict: "incident_key", ignoreDuplicates: true })
        .select("id");

      if (insertError) {
        throw new Error(`Batch insert failed at row ${i}: ${insertError.message}`);
      }
      const actuallyInserted = inserted?.length ?? 0;
      insertedCount += actuallyInserted;
      duplicateCount += batch.length - actuallyInserted;
    }

    // New data (even partially new) means cached chatbot answers may be
    // stale — clear so the next question re-queries fresh.
    await invalidateCache();

    return NextResponse.json({
      success: true,
      fileName: file.name,
      cloudinaryUrl,
      reportMonth,
      sheetsProcessed,
      insertedCount,
      duplicateCount,
      skippedRowCount,
    });
  } catch (err) {
    console.error("Upload/ingestion error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error during ingestion." },
      { status: 500 }
    );
  }
}
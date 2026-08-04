import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";
import { supabaseAdmin } from "@/lib/supabase";
import { parseInvestigationWorkbook } from "@/lib/parseInvestigationReport";
import { matchIncident } from "@/lib/matchIncident";

export const runtime = "nodejs";
const BATCH_SIZE = 200;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const allowedExt = [".xlsm", ".xlsx", ".xls"];
    if (!allowedExt.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload .xlsm, .xlsx, or .xls." },
        { status: 400 }
      );
    }

    // Exact-duplicate file check via content hash (same proven pattern as
    // the main incidents pipeline) — stronger than a filename check, since
    // it catches re-uploads under a renamed file too.
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = createHash("sha256").update(buffer).digest("hex");

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
        },
        { status: 409 }
      );
    }

    const { records, sheetFound } = parseInvestigationWorkbook(buffer);

    if (!sheetFound) {
      return NextResponse.json(
        {
          error:
            'This file doesn\'t look like a "Monthly Fire Incident Monitoring" workbook — no "MonitoringSheet2" sheet was found.',
        },
        { status: 422 }
      );
    }

    if (records.length === 0) {
      return NextResponse.json(
        { error: "No investigation records could be parsed from this file." },
        { status: 422 }
      );
    }

    const { url: cloudinaryUrl } = await uploadBufferToCloudinary(buffer, file.name);

    // Record in source_files too, for citation/audit consistency with the
    // main incidents pipeline (report_month left null — this template's
    // scope doesn't map cleanly onto that field).
    const { error: sourceFileError } = await supabaseAdmin.from("source_files").insert({
      file_name: file.name,
      cloudinary_url: cloudinaryUrl,
      file_hash: fileHash,
      row_count: records.length,
    });

    if (sourceFileError) {
      throw new Error(`Failed to record source file: ${sourceFileError.message}`);
    }

    let matchedCount = 0;
    let unmatchedCount = 0;
    let insertedCount = 0;
    let duplicateCount = 0;

    const rowsToInsert = [];
    for (const rec of records) {
      const { incidentId, confidence } = await matchIncident(rec._matchDate, rec._matchLocation);
      if (incidentId) matchedCount++;
      else unmatchedCount++;

      // Strip the internal-only matching fields before insert.
      const { _matchDate, _matchLocation, ...dbFields } = rec;

      rowsToInsert.push({
        ...dbFields,
        incident_id: incidentId,
        match_confidence: confidence,
        match_status: incidentId ? "matched" : "unmatched",
        source_file_name: file.name,
        cloudinary_url: cloudinaryUrl,
      });
    }

    // Upsert with ignoreDuplicates == "INSERT ... ON CONFLICT (investigation_key)
    // DO NOTHING" — same proven pattern as the main incidents pipeline. This
    // means re-uploading the same file under a different name (rather than
    // being caught by the filename check above) still won't create
    // duplicate case records; already-known rows are silently skipped.
    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("investigation_records")
        .upsert(batch, { onConflict: "investigation_key", ignoreDuplicates: true })
        .select("id");

      if (insertError) {
        throw new Error(`Batch insert failed at row ${i}: ${insertError.message}`);
      }
      const actuallyInserted = inserted?.length ?? 0;
      insertedCount += actuallyInserted;
      duplicateCount += batch.length - actuallyInserted;
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      cloudinaryUrl,
      totalRecords: records.length,
      insertedCount,
      duplicateCount,
      matchedCount,
      unmatchedCount,
    });
  } catch (err) {
    console.error("Investigation upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error during ingestion." },
      { status: 500 }
    );
  }
}
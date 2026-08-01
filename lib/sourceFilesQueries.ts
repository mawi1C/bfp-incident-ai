import { supabaseAdmin } from "@/lib/supabase";

export interface SourceFile {
  id: string;
  file_name: string;
  cloudinary_url: string;
  report_month: string | null;
  row_count: number;
  uploaded_at: string;
}

export async function getSourceFiles(): Promise<SourceFile[]> {
  const { data, error } = await supabaseAdmin
    .from("source_files")
    .select("id, file_name, cloudinary_url, report_month, row_count, uploaded_at")
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("getSourceFiles failed:", error.message);
    return [];
  }
  return data ?? [];
}
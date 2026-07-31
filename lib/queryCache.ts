import { supabaseAdmin } from "@/lib/supabase";

/** Collapses whitespace and lowercases so trivial differences (extra spaces,
 * capitalization, a trailing "?") don't count as cache misses. */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[?.!]+$/, "");
}

export interface CachedAnswer {
  answer: string;
  sql_generated: string;
  row_count: number;
}

export async function getCachedAnswer(question: string): Promise<CachedAnswer | null> {
  const normalized = normalizeQuestion(question);
  const { data, error } = await supabaseAdmin
    .from("query_cache")
    .select("answer, sql_generated, row_count")
    .eq("question_normalized", normalized)
    .maybeSingle();

  if (error) {
    console.error("Cache lookup failed (continuing without cache):", error);
    return null;
  }
  return data;
}

export async function saveCachedAnswer(
  question: string,
  sql: string,
  answer: string,
  rowCount: number
): Promise<void> {
  const normalized = normalizeQuestion(question);
  const { error } = await supabaseAdmin
    .from("query_cache")
    .upsert(
      {
        question_normalized: normalized,
        question_original: question,
        sql_generated: sql,
        answer,
        row_count: rowCount,
      },
      { onConflict: "question_normalized" }
    );

  if (error) {
    // Non-fatal — the officer already has their answer, caching is
    // best-effort. Just log it so it's visible during development.
    console.error("Failed to save cache entry:", error);
  }
}

/** Clears the whole cache. Call this after any successful data ingestion,
 * since previously cached answers may no longer reflect the current data. */
export async function invalidateCache(): Promise<void> {
  const { error } = await supabaseAdmin.from("query_cache").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) {
    console.error("Failed to invalidate query cache:", error);
  }
}
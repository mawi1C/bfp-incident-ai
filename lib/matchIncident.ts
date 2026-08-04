import { supabaseAdmin } from "@/lib/supabase";

const MATCH_THRESHOLD = 0.4; // minimum Jaccard similarity to accept a match

// Common Philippine address abbreviation variants that should be treated
// as identical when comparing two independently-typed versions of the
// same address. Discovered by inspecting real unmatched records where a
// human would obviously recognize the same address (e.g. "4th Street
// corner 12th Avenue" vs "4TH ST., COR. 12 AVE.") but raw token overlap
// missed it entirely.
const ADDRESS_SYNONYMS: Record<string, string> = {
  street: "st",
  avenue: "ave",
  corner: "cor",
  barangay: "brgy",
  block: "blk",
  extension: "ext",
  road: "rd",
  building: "bldg",
  compound: "cmpd",
  subdivision: "subd",
  boulevard: "blvd",
};

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[.,#/()]/g, " ")
      // Strip ordinal suffixes attached to numbers: "4th" -> "4", "12th" -> "12" —
      // one source often writes "4th Street", another writes "4 ST", and
      // without this these never share a token.
      .replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1")
      .split(/\s+/)
      .filter((t) => t.length >= 2)
      .map((t) => ADDRESS_SYNONYMS[t] ?? t)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface MatchResult {
  incidentId: string | null;
  confidence: number | null;
}

/**
 * Finds the best-matching incident for a given date + location, restricted
 * to candidates on the SAME date (a reasonable hard constraint -- two
 * genuinely different fires happening at the same address on the same day
 * is vanishingly unlikely, and this keeps the candidate pool small enough
 * that a simple token-overlap score is good enough without needing a real
 * fuzzy-string-matching library).
 */
export async function matchIncident(date: string | null, normalizedLocation: string): Promise<MatchResult> {
  if (!date || !normalizedLocation) {
    return { incidentId: null, confidence: null };
  }

  const { data: candidates, error } = await supabaseAdmin
    .from("incidents")
    .select("id, location")
    .eq("date_of_response", date);

  if (error || !candidates || candidates.length === 0) {
    return { incidentId: null, confidence: null };
  }

  const targetTokens = tokenize(normalizedLocation);
  let best: { id: string; score: number } | null = null;

  for (const c of candidates) {
    if (!c.location) continue;
    const score = jaccardSimilarity(targetTokens, tokenize(c.location));
    if (!best || score > best.score) {
      best = { id: c.id, score };
    }
  }

  if (best && best.score >= MATCH_THRESHOLD) {
    return { incidentId: best.id, confidence: Math.round(best.score * 100) / 100 };
  }

  return { incidentId: null, confidence: null };
}
import { supabaseAdmin } from "@/lib/supabase";

const MATCH_THRESHOLD = 0.4; // minimum Jaccard similarity for a same-date match
const FALLBACK_MATCH_THRESHOLD = 0.55; // stricter bar for the ±1-day fallback tier below

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

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function bestMatch(candidates: { id: string; location: string | null }[], targetTokens: Set<string>) {
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    if (!c.location) continue;
    const score = jaccardSimilarity(targetTokens, tokenize(c.location));
    if (!best || score > best.score) {
      best = { id: c.id, score };
    }
  }
  return best;
}

export interface MatchResult {
  incidentId: string | null;
  confidence: number | null;
}

/**
 * Finds the best-matching incident for a given date + location.
 *
 * Tries the exact date first (candidate pool restricted to same-day
 * incidents, since two genuinely different fires at the same address on
 * the same day is vanishingly unlikely). If nothing clears the threshold,
 * falls back to date ±1 day with a STRICTER threshold — confirmed against
 * real data that BFP's two systems sometimes disagree by one calendar day
 * for fires occurring near midnight (one logs "date of response", the
 * other logs the fire's official date, and a late-night call can fall on
 * either side of midnight depending on which timestamp each system uses).
 */
export async function matchIncident(date: string | null, normalizedLocation: string): Promise<MatchResult> {
  if (!date || !normalizedLocation) {
    return { incidentId: null, confidence: null };
  }

  const targetTokens = tokenize(normalizedLocation);

  const { data: sameDayCandidates } = await supabaseAdmin
    .from("incidents")
    .select("id, location")
    .eq("date_of_response", date);

  const sameDayBest = sameDayCandidates ? bestMatch(sameDayCandidates, targetTokens) : null;
  if (sameDayBest && sameDayBest.score >= MATCH_THRESHOLD) {
    return { incidentId: sameDayBest.id, confidence: Math.round(sameDayBest.score * 100) / 100 };
  }

  const { data: nearbyCandidates } = await supabaseAdmin
    .from("incidents")
    .select("id, location")
    .in("date_of_response", [shiftDate(date, -1), shiftDate(date, 1)]);

  const nearbyBest = nearbyCandidates ? bestMatch(nearbyCandidates, targetTokens) : null;
  if (nearbyBest && nearbyBest.score >= FALLBACK_MATCH_THRESHOLD) {
    return { incidentId: nearbyBest.id, confidence: Math.round(nearbyBest.score * 100) / 100 };
  }

  return { incidentId: null, confidence: null };
}
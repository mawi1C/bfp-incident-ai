import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Configurable so you can bump models without touching call sites.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

// Describes the queryable shape of the database to the model. Keep this in
// sync with supabase/schema.sql — if you add/rename columns there, update
// this too, or Gemini will generate SQL against columns that don't exist.
const SCHEMA_DESCRIPTION = `
Table: incidents
  fire_district              text   -- e.g. "FIRE DISTRICT I"
  station                    text   -- e.g. "MANILA", "QUEZON CITY"
  date_of_response            date   -- use this for date filtering/grouping
  location                    text   -- exact address of the incident
  responding_unit_raw         text
  time_received_call_raw      text
  time_dispatched_raw         text
  time_arrival_raw            text
  response_time_minutes       numeric -- best-effort parsed minutes; may be null
  distance_from_station_raw   text
  alarm_status                text   -- e.g. "FOUA", "1ST ALARM", "2ND ALARM"
  type_of_occupancy           text
  casualties_injured_civilian integer
  casualties_injured_bfp      integer
  casualties_death_civilian   integer
  casualties_death_bfp        integer
  cause_of_fire               text   -- e.g. "ELECTRICAL POLE", "RUBBISH", "OPEN FLAME FROM COOKING..."
  source_file_name            text   -- cite this when answering
  cloudinary_url              text   -- link to the original uploaded file

Notes:
  - date_of_response can be NULL for rows whose original date text couldn't be parsed;
    prefer WHERE date_of_response IS NOT NULL when doing date range/aggregate queries.
  - cause_of_fire values are free text from BFP officers, not a fixed enum — use
    ILIKE '%term%' for matching rather than exact equality when the user asks about
    a general cause category (e.g. "electrical" should match "ELECTRICAL POLE",
    "ELECTRICAL IGNITION CAUSED BY ARCING", etc.)
  - Casualty columns default to 0, not NULL, when a source row had no casualties.
`;

/** Strips markdown code fences a model sometimes wraps SQL in, despite instructions not to. */
function stripCodeFence(text: string): string {
  return text
    .replace(/^```(sql)?/i, "")
    .replace(/```$/, "")
    .trim();
}

export interface ConversationTurn {
  question: string;
  answer: string;
}

export async function generateSQL(question: string, history: ConversationTurn[] = []): Promise<string> {
  const historyBlock =
    history.length > 0
      ? `\nRecent conversation (for resolving references like "what about last month" or "same district"):\n${history
          .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`)
          .join("\n\n")}\n`
      : "";

  const prompt = `You are a PostgreSQL expert helping a fire department officer query an incident database.

${SCHEMA_DESCRIPTION}
${historyBlock}
Given the officer's CURRENT question below, write ONE valid PostgreSQL SELECT statement that answers it. If the question references something from the recent conversation above (e.g. "what about May", "same station", "and last year"), resolve that reference using the conversation context — but the SQL should stand alone and fully answer the current question by itself.

Rules:
- Output ONLY the raw SQL statement. No markdown, no code fences, no explanation, no trailing semicolon commentary.
- Only SELECT statements — never INSERT, UPDATE, DELETE, DROP, or ALTER.
- Always query the "incidents" table (it's the only table available to you).
- Use LIMIT 50 unless the question clearly asks for a count/aggregate (in which case no LIMIT is needed).
- If the question is ambiguous, make a reasonable interpretation rather than asking for clarification.

Officer's current question: "${question}"

SQL:`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  const sql = stripCodeFence(response.text ?? "");
  if (!sql.toLowerCase().startsWith("select")) {
    throw new Error("Model did not return a valid SELECT statement.");
  }
  return sql;
}

export interface CitedRow {
  source_file_name?: string;
  cloudinary_url?: string;
  [key: string]: unknown;
}

export async function generateAnswer(
  question: string,
  sql: string,
  rows: CitedRow[]
): Promise<string> {
  // Collect distinct source files actually present in the result set, so the
  // model can cite only what it used rather than inventing sources.
  const sources = Array.from(
    new Map(
      rows
        .filter((r) => r.source_file_name)
        .map((r) => [r.source_file_name, r.cloudinary_url])
    ).entries()
  );

  const prompt = `You are a helpful assistant for a fire department officer. You already ran a database query for them.

Officer's original question: "${question}"

The SQL query that was run:
${sql}

The result (as JSON, up to 50 rows):
${JSON.stringify(rows).slice(0, 8000)}

Source files these results came from:
${sources.map(([name]) => `- ${name}`).join("\n") || "(no rows found)"}

Write a clear, direct answer to the officer's question based on this data. Rules:
- Speak plainly, like a colleague summarizing findings — no "based on the SQL query" preamble.
- Plain prose only — do NOT use markdown syntax (no **bold**, no bullet asterisks, no # headers, no numbered lists with periods). This is rendered as plain text, not markdown, so any markdown symbols will show up literally to the officer.
- If you need to list several items, write them as a simple comma-separated sentence or use a line break and a dash "-", not asterisks.
- If you cite a specific fact, mention which source file it came from, e.g. "(from ${sources[0]?.[0] ?? "the report"})".
- If the result set is empty, say so plainly and suggest the officer rephrase or check whether that month's data has been uploaded.
- Do not invent data that isn't in the result set above.
- Keep it concise — a few sentences or a short list, not a report.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  // Defensive backstop in case the model still slips in markdown despite
  // instructions — strip common markdown syntax before it reaches the UI.
  const rawText = response.text ?? "I couldn't generate an answer for that.";
  return rawText
    .replace(/\*\*(.*?)\*\*/g, "$1") // **bold**
    .replace(/^\s*\*\s+/gm, "- ")     // "* item" -> "- item"
    .replace(/^#{1,6}\s+/gm, "");     // markdown headers
}
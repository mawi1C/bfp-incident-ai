/**
 * Parser for BFP-NCR "Consolidated Fire Incident Report" Excel files.
 *
 * Handles the real-world variations observed across actual uploaded files:
 *  - Workbooks split across multiple sheets ("Table 1", "Table 2", ...) where
 *    a data table continues across sheets, sometimes with a repeated header,
 *    sometimes with none at all.
 *  - Workbooks with one sheet per month ("Jan'26", "Feb'26", ...).
 *  - Header text that drifts slightly between files/months
 *    ("RESPONSE TIME (B-A) in MINS" vs "in MIN" vs "inMINutes").
 *  - Station names written only once per block, blank on subsequent rows
 *    (forward-fill required), same for "FIRE DISTRICT ..." section headers.
 *  - Multi-unit incidents: a single row can contain several responding units
 *    and per-unit timestamps, newline-separated within one cell.
 *  - Dates stored either as real Date objects or as free text ("01 JAN 2026").
 *  - Casualty cells that are sometimes blank (no incident) and sometimes 0.
 *  - Junk rows: title/letterhead rows, "Prepared by/Certified/Noted by"
 *    signature blocks, and per-station subtotal / grand-total rows.
 *
 * Strategy: map columns by matching header text (fuzzy, case/space-insensitive)
 * rather than by fixed column index, classify each row, and forward-fill
 * district/station context as we scan down the sheet.
 */

import * as XLSX from "xlsx";
import { createHash } from "crypto";

export interface ParsedIncident {
  fire_district: string | null;
  station: string | null;
  date_of_response: string | null; // ISO date, best-effort
  date_of_response_raw: string | null;
  location: string | null;
  responding_unit_raw: string | null;
  time_received_call_raw: string | null;
  time_dispatched_raw: string | null;
  time_arrival_raw: string | null;
  response_time_minutes: number | null;
  response_time_raw: string | null;
  distance_from_station_raw: string | null;
  alarm_status: string | null;
  last_alarm_status_raw: string | null;
  type_of_occupancy: string | null;
  casualties_injured_civilian: number;
  casualties_injured_bfp: number;
  casualties_death_civilian: number;
  casualties_death_bfp: number;
  cause_of_fire: string | null;
  incident_key: string;
  raw_row: Record<string, unknown>;
}

export interface ParseResult {
  incidents: ParsedIncident[];
  reportMonth: string | null;
  skippedRowCount: number;
  sheetsProcessed: string[];
}

// --- Header matching -------------------------------------------------

// Canonical field -> array of substrings we accept (normalized: lowercase, whitespace collapsed)
const HEADER_MATCHERS: Record<string, string[]> = {
  station: ["station"],
  date: ["date of response"],
  location: ["exact location", "address of fire incident"],
  unit: ["responding unit"],
  timeReceived: ["a. time received", "time received call"],
  timeDispatched: ["time dispatch"],
  timeArrival: ["b. time of arrival", "time of arrival at scene"],
  responseTimeMinutes: ["response time"], // matches both the labeled and blank-paired columns
  distance: ["approximate distance", "distance of fire incident"],
  alarmStatus: ["alarm status upon arrival"],
  lastAlarmStatus: ["last alarm status", "time/date"],
  occupancy: ["type of occupancy"],
  casualties: ["casualties"], // anchor column; the 4 actual sub-columns (injured/death x civilian/bfp)
                                // are positional offsets from this one — see detectHeaderRow.
  remarks: ["remarks"],
};

function normalizeHeader(v: unknown): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Removes ALL whitespace, for matching headers like "R E M A R K S" against "remarks". */
function squash(v: string): string {
  return v.replace(/\s+/g, "");
}

function headerCellMatches(cellText: string, needle: string): boolean {
  return cellText.includes(needle) || squash(cellText).includes(squash(needle));
}

/** Scans a block of rows looking for a header row, and builds a column index map. */
function detectHeaderRow(
  rows: unknown[][],
  maxScan = 20
): { headerRowIndex: number; colMap: Record<string, number[]> } | null {
  for (let r = 0; r < Math.min(maxScan, rows.length); r++) {
    const row = rows[r] || [];
    const normalized = row.map(normalizeHeader);
    const hasStation = normalized.some((c) => c === "station");
    const hasDate = normalized.some((c) => c.includes("date of response"));
    const hasLocation = normalized.some((c) => c.includes("exact location") || c.includes("address of fire"));
    if (hasStation && hasDate && hasLocation) {
      const colMap: Record<string, number[]> = {};
      normalized.forEach((cellText, colIdx) => {
        for (const [field, needles] of Object.entries(HEADER_MATCHERS)) {
          if (needles.some((n) => headerCellMatches(cellText, n))) {
            colMap[field] = colMap[field] || [];
            colMap[field].push(colIdx);
          }
        }
      });

      // CASUALTIES is a single merged header cell; the actual 4 sub-columns
      // (INJURED-CIVILIAN, INJURED-BFP, DEATH-CIVILIAN, DEATH-BFP) are
      // labeled in the two rows *below* this header row, not in it — so we
      // can't detect them by text. Every source file observed uses this
      // same fixed order immediately following the CASUALTIES anchor cell.
      const casualtiesCol = colMap.casualties?.[0];
      if (casualtiesCol !== undefined) {
        colMap.injuredCivilian = [casualtiesCol];
        colMap.injuredBfp = [casualtiesCol + 1];
        colMap.deathCivilian = [casualtiesCol + 2];
        colMap.deathBfp = [casualtiesCol + 3];
      }

      return { headerRowIndex: r, colMap };
    }
  }
  return null;
}

// --- Row classification -----------------------------------------------

const SIGNATURE_KEYWORDS = [
  "prepared by",
  "certified correct",
  "noted by",
  "acting regional director",
  "regional director",
  "chief, regional operations",
  "republic of the philippines",
  "department of the interior",
  "bureau of fire protection",
  "grand total", // e.g. "_321_ FIRE INCIDENTS GRAND TOTAL 53 3 6" — a
                 // month-wide summary row, not a real incident. Its casualty
                 // columns hold the WHOLE MONTH'S totals, which would get
                 // double-counted on top of every individual incident's own
                 // casualties if not filtered out here.
];

function isSignatureOrLetterheadRow(row: unknown[]): boolean {
  const joined = row.map((c) => String(c ?? "").toLowerCase()).join(" ");
  return SIGNATURE_KEYWORDS.some((k) => joined.includes(k));
}

function isBlankRow(row: unknown[]): boolean {
  return row.every((c) => c === null || c === undefined || String(c).trim() === "");
}

/**
 * A "section header" row is a station or "FIRE DISTRICT ..." row: only the
 * first cell is populated, everything else blank.
 */
function isSectionHeaderRow(row: unknown[]): { isHeader: boolean; text: string } {
  const first = row[0];
  const rest = row.slice(1);
  const restBlank = rest.every((c) => c === null || c === undefined || String(c).trim() === "");
  if (first && String(first).trim() !== "" && restBlank) {
    return { isHeader: true, text: String(first).trim() };
  }
  return { isHeader: false, text: "" };
}

/**
 * Subtotal/grand-total rows: numeric-only casualty tallies with no date,
 * no location, no responding unit. We detect by absence of a location AND
 * absence of a parseable date-like value in the date column.
 */
function isSubtotalRow(row: unknown[], colMap: Record<string, number[]>): boolean {
  const dateCol = colMap.date?.[0];
  const locationCol = colMap.location?.[0];
  const hasDate = dateCol !== undefined && row[dateCol] !== null && String(row[dateCol] ?? "").trim() !== "";
  const hasLocation = locationCol !== undefined && row[locationCol] !== null && String(row[locationCol] ?? "").trim() !== "";
  return !hasDate && !hasLocation;
}

// --- Value parsing helpers ---------------------------------------------

function excelDateToISO(value: unknown): { iso: string | null; raw: string } {
  if (value instanceof Date && !isNaN(value.getTime())) {
    // IMPORTANT: do not use .toISOString() here. It converts through UTC,
    // which shifts the calendar date backward by one day for any positive
    // UTC offset (e.g. Philippines, UTC+8) whenever the cell represents
    // local midnight — which Excel date cells with no time component
    // always do. Reading the LOCAL date components directly avoids any
    // timezone conversion entirely, since these Date objects were built
    // from a timezone-naive Excel serial number in the first place.
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return { iso: `${year}-${month}-${day}`, raw: value.toDateString() };
  }
  const raw = String(value ?? "").trim();
  if (!raw) return { iso: null, raw };

  // Formats seen: "01 JAN 2026", "20 JANUARY 2026"
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const m = raw.match(/(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const monKey = m[2].slice(0, 3).toLowerCase();
    const month = months[monKey];
    const year = m[3];
    if (month) return { iso: `${year}-${month}-${day}`, raw };
  }

  // Fallback for numeric formats like "09-06-26" or "09/06/2026" (DD-MM-YY[YY]),
  // in case a date cell still arrives pre-formatted as text rather than a Date.
  const numeric = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (numeric) {
    const day = numeric[1].padStart(2, "0");
    const month = numeric[2].padStart(2, "0");
    let year = numeric[3];
    if (year.length === 2) year = (parseInt(year, 10) < 50 ? "20" : "19") + year;
    return { iso: `${year}-${month}-${day}`, raw };
  }

  return { iso: null, raw };
}

function toNumberOrZero(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseResponseMinutes(value: unknown): number | null {
  if (typeof value === "number") return value;
  const raw = String(value ?? "");
  const m = raw.match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Builds a stable fingerprint identifying "the same real-world incident,"
 * independent of which file it was uploaded in. Used for insert-time dedup
 * via the incidents.incident_key unique index (ON CONFLICT DO NOTHING).
 *
 * Deliberately excludes fields likely to vary between re-transcriptions of
 * the same report (e.g. free-text remarks/cause, which officers sometimes
 * edit for clarity) and focuses on facts that shouldn't change: where, when,
 * and which unit responded.
 */
function buildIncidentKey(fields: {
  station: string | null;
  dateISO: string | null;
  dateRaw: string;
  location: unknown;
  unit: unknown;
}): string {
  const normalize = (v: unknown) =>
    String(v ?? "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const parts = [
    normalize(fields.station),
    fields.dateISO ?? normalize(fields.dateRaw), // fall back to raw date text if unparsed
    normalize(fields.location),
    normalize(fields.unit),
  ];

  return createHash("sha256").update(parts.join("|")).digest("hex");
}

// --- Main entry point ----------------------------------------------------

export function parseWorkbook(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const incidents: ParsedIncident[] = [];
  const sheetsProcessed: string[] = [];
  let skippedRowCount = 0;

  // Carry-forward context across sheets, since a data table can continue
  // onto a subsequent sheet without repeating the district/station headers.
  let currentDistrict: string | null = null;
  let currentStation: string | null = null;
  let activeColMap: Record<string, number[]> | null = null;
  const monthsFound = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    // raw: true is important here — with raw: false, SheetJS formats each
    // cell using ITS OWN Excel number format (e.g. "dd-mm-yy") rather than
    // any dateNF override, which produced ambiguous text like "09-06-26"
    // that couldn't be reliably parsed back into a date. With raw: true and
    // cellDates: true (set at workbook read time above), date cells come
    // through as actual JS Date objects instead.
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    if (!rows.length) continue;

    // Skip obvious non-data sheets (pure template/reference tabs).
    const joinedSheet = rows.slice(0, 15).map((r) => r.join(" ")).join(" ").toLowerCase();
    if (joinedSheet.includes("insert region") || joinedSheet.includes("insert address")) {
      continue; // blank template sheet
    }

    // Try to detect a month label near the top, e.g. "FOR THE MONTH OF JUNE 2026"
    let monthFoundInTitle = false;
    for (const row of rows.slice(0, 15)) {
      const text = row.join(" ");
      const monthMatch = text.match(/FOR THE MONTH OF\s+([A-Za-z]+\.?\s*\d{4})/i);
      if (monthMatch) {
        monthsFound.add(monthMatch[1].trim().toUpperCase());
        monthFoundInTitle = true;
        break;
      }
    }
    // Fallback: workbooks with one sheet per month (e.g. "Jan'26") don't
    // always repeat the title block on every tab — use the sheet name.
    if (!monthFoundInTitle) {
      const sheetNameMatch = sheetName.match(/^([A-Za-z]{3,9})'?\.?\s*(\d{2,4})$/);
      if (sheetNameMatch) {
        monthsFound.add(`${sheetNameMatch[1].toUpperCase()} 20${sheetNameMatch[2].slice(-2)}`);
      }
    }

    const detected = detectHeaderRow(rows);
    let dataStartIndex: number;

    if (detected) {
      activeColMap = detected.colMap;
      dataStartIndex = detected.headerRowIndex + 1;
      // Some files have 2-3 extra sub-header rows (CIVILIAN/BFP labels etc.)
      // right after the main header — skip rows until we see real data or
      // hit a section header.
      while (
        dataStartIndex < rows.length &&
        isBlankRow(rows[dataStartIndex].slice(1)) === false &&
        rows[dataStartIndex].filter((c) => c !== null && String(c).trim() !== "").length <= 5 &&
        !isSectionHeaderRow(rows[dataStartIndex]).isHeader
      ) {
        // heuristic bail-out after a couple of tries to avoid infinite loop
        break;
      }
    } else {
      // No header on this sheet (continuation sheet) — reuse the last
      // known column map from a previous sheet in this same workbook.
      dataStartIndex = 0;
    }

    if (!activeColMap) {
      // We never found a header anywhere yet in this workbook and this
      // sheet has none either — nothing we can reliably parse.
      continue;
    }

    sheetsProcessed.push(sheetName);
    const colMap = activeColMap;

    for (let r = dataStartIndex; r < rows.length; r++) {
      const row = rows[r] || [];

      if (isBlankRow(row)) continue;
      if (isSignatureOrLetterheadRow(row)) continue;

      const sectionHeader = isSectionHeaderRow(row);
      if (sectionHeader.isHeader) {
        const text = sectionHeader.text.toUpperCase();
        if (text.startsWith("FIRE DISTRICT")) {
          currentDistrict = text;
          currentStation = null;
        } else {
          currentStation = text;
        }
        continue;
      }

      if (isSubtotalRow(row, colMap)) {
        continue; // per-station subtotal or grand-total row
      }

      const get = (field: string, occurrence = 0): unknown => {
        const idx = colMap[field]?.[occurrence];
        return idx !== undefined ? row[idx] : null;
      };

      const stationCell = get("station");
      if (stationCell && String(stationCell).trim() !== "") {
        currentStation = String(stationCell).trim().toUpperCase();
      }

      const { iso: dateISO, raw: dateRaw } = excelDateToISO(get("date"));

      // The CASUALTIES block's 4 sub-columns are mapped positionally in
      // detectHeaderRow (their text labels live 2 rows below the header
      // row we scan, so they can't be matched by text at extraction time).
      const injCivIdx = colMap.injuredCivilian?.[0];
      const injBfpIdx = colMap.injuredBfp?.[0];
      const deathCivIdx = colMap.deathCivilian?.[0];
      const deathBfpIdx = colMap.deathBfp?.[0];

      const record: ParsedIncident = {
        fire_district: currentDistrict,
        station: currentStation,
        date_of_response: dateISO,
        date_of_response_raw: dateRaw || null,
        location: (get("location") as string) || null,
        responding_unit_raw: (get("unit") as string) || null,
        time_received_call_raw: (get("timeReceived") as string) || null,
        time_dispatched_raw: (get("timeDispatched") as string) || null,
        time_arrival_raw: (get("timeArrival") as string) || null,
        response_time_minutes: parseResponseMinutes(get("responseTimeMinutes")),
        response_time_raw: (get("responseTimeMinutes") as string) || null,
        distance_from_station_raw: (get("distance") as string) || null,
        alarm_status: (get("alarmStatus") as string) || null,
        last_alarm_status_raw: (get("lastAlarmStatus") as string) || null,
        type_of_occupancy: (get("occupancy") as string) || null,
        casualties_injured_civilian: toNumberOrZero(injCivIdx !== undefined ? row[injCivIdx] : null),
        casualties_injured_bfp: toNumberOrZero(injBfpIdx !== undefined ? row[injBfpIdx] : null),
        casualties_death_civilian: toNumberOrZero(deathCivIdx !== undefined ? row[deathCivIdx] : null),
        casualties_death_bfp: toNumberOrZero(deathBfpIdx !== undefined ? row[deathBfpIdx] : null),
        cause_of_fire: (get("remarks") as string) || null,
        incident_key: buildIncidentKey({
          station: currentStation,
          dateISO,
          dateRaw: dateRaw ?? "",
          location: get("location"),
          unit: get("unit"),
        }),
        raw_row: Object.fromEntries(row.map((v, i) => [`col_${i}`, v])),
      };

      // A real incident row must at minimum have a location or a date;
      // otherwise treat as junk we couldn't classify.
      if (!record.location && !record.date_of_response && !record.date_of_response_raw) {
        skippedRowCount++;
        continue;
      }

      incidents.push(record);
    }
  }

  const sortedMonths = Array.from(monthsFound).sort();
  const reportMonth =
    sortedMonths.length === 0
      ? null
      : sortedMonths.length === 1
      ? sortedMonths[0]
      : `${sortedMonths[0]} – ${sortedMonths[sortedMonths.length - 1]} (multi-month file)`;

  return { incidents, reportMonth, skippedRowCount, sheetsProcessed };
}
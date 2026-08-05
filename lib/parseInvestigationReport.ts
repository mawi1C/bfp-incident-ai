/**
 * Parser for the "Monthly Fire Incident Monitoring" template
 * (BFP Directorate for Investigation and Intelligence / Fire Arson
 * Investigation Division).
 *
 * Structurally distinct from the "Consolidated Fire Incident Report"
 * template handled by parseIncidentReport.ts:
 *  - Single sheet holds real data: "MonitoringSheet2". All other sheets
 *    are either pre-computed pivot summaries derived from that data, or a
 *    "List" reference sheet for Excel dropdown validation — neither is
 *    real incident data and both are skipped entirely.
 *  - Header spans THREE rows (18-20), not one.
 *  - No forward-fill station concept — every row is fully self-contained.
 *  - Times are stored as bare integers without zero-padding (e.g. 8 means
 *    00:08, 944 means 09:44), not the "0008H"-style text used elsewhere.
 *  - Column positions were verified identical across two real source
 *    files (January and February 2026), so they're hardcoded here rather
 *    than detected by header text — the header text itself is also far
 *    less unique/matchable than the other template's (e.g. "Nr of
 *    Injured" alone doesn't disambiguate firefighter vs. civilian,
 *    male vs. female — that's only resolvable from row 19/20 sub-headers
 *    at fixed offsets from the row-18 anchor).
 */

import * as XLSX from "xlsx";
import { createHash } from "crypto";

export interface ParsedInvestigationRecord {
  source_row_nr: number | null;
  date_of_fire: string | null;
  date_of_fire_raw: string | null;
  time_of_alarm_raw: string | null;
  region: string | null;
  province_district: string | null;
  city_municipality: string | null;
  exact_location: string | null;
  property_general_category: string | null;
  property_sub_category: string | null;
  name_of_establishment: string | null;
  number_of_storeys: number | null;
  name_of_owner: string | null;
  name_of_occupant: string | null;
  time_fire_started_raw: string | null;
  fire_out_raw: string | null;
  injured_firefighter_male: number;
  injured_firefighter_female: number;
  injured_civilian_male: number;
  injured_civilian_female: number;
  fatalities_firefighter_male: number;
  fatalities_firefighter_female: number;
  fatalities_civilian_male: number;
  fatalities_civilian_female: number;
  estimated_cost_of_damage: number | null;
  number_of_affected_structures: number | null;
  alarm_status: string | null;
  cause: string | null;
  classification_of_case: string | null;
  fire_arson_investigator: string | null;
  date_report_spot_raw: string | null;
  date_report_progress_raw: string | null;
  date_report_final_raw: string | null;
  remarks: string | null;
  raw_row: Record<string, unknown>;
  // Dedup fingerprint — mirrors incidents.incident_key, protects against
  // re-uploading the same monthly file twice.
  investigation_key: string;
  // Fields used for matching against `incidents`, not stored directly:
  _matchDate: string | null;
  _matchLocation: string;
}

export interface InvestigationParseResult {
  records: ParsedInvestigationRecord[];
  sheetFound: boolean;
}

const DATA_START_ROW = 21;
const REQUIRED_SHEET_NAME = "MonitoringSheet2";

// Column indices (1-based, matching Excel column numbers) — verified
// against two real source files before hardcoding, per the note above.
const COL = {
  nr: 1,
  dateOfFire: 2,
  timeOfAlarm: 3,
  region: 4,
  provinceDistrict: 5,
  cityMunicipality: 6,
  exactLocation: 7,
  propertyGeneral: 8,
  propertySub: 9,
  nameOfEstablishment: 10,
  numberOfStoreys: 11,
  nameOfOwner: 12,
  nameOfOccupant: 13,
  timeFireStartedTime: 15,
  fireOutTime: 17,
  injuredFFMale: 18,
  injuredFFFemale: 19,
  injuredCivMale: 21,
  injuredCivFemale: 22,
  fatalFFMale: 24,
  fatalFFFemale: 25,
  fatalCivMale: 27,
  fatalCivFemale: 28,
  estimatedCost: 30,
  affectedStructures: 31,
  alarm: 32,
  cause: 33,
  classification: 34,
  investigator: 35,
  reportSpot: 36,
  reportProgress: 37,
  reportFinal: 38,
  remarks: 39,
};

/** Same timezone-safe date extraction used in parseIncidentReport.ts —
 * .toISOString() would shift the calendar date backward by a day in any
 * UTC+ timezone, which was a real bug found and fixed earlier. */
const MONTH_LOOKUP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Parses text-form dates like "25 February 2026" or "28 FEB 26". Also
 * tolerates a stray space typo'd into the month name itself (e.g. the
 * real source data had "28 FE B 26") by allowing single-space breaks
 * inside the month token and squashing them before matching — same
 * whitespace-tolerance approach used for the header-matching fix in the
 * main incidents parser (the "R E M A R K S" issue). */
function parseTextDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\s+([A-Za-z](?:\s*[A-Za-z]){1,10})\.?\s+(\d{2,4})/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const monthKey = m[2].replace(/\s+/g, "").toLowerCase().slice(0, 3);
  const month = MONTH_LOOKUP[monthKey];
  if (!month) return null;
  let year = m[3];
  if (year.length === 2) year = (parseInt(year, 10) < 50 ? "20" : "19") + year;
  return `${year}-${month}-${day}`;
}

function dateToISO(value: unknown): { iso: string | null; raw: string | null } {
  if (value instanceof Date && !isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return { iso: `${year}-${month}-${day}`, raw: value.toDateString() };
  }
  const raw = value != null ? String(value).trim() : null;
  if (raw) {
    const iso = parseTextDate(raw);
    if (iso) return { iso, raw };
  }
  return { iso: null, raw };
}

/** Converts the source's bare-integer time encoding (e.g. 8, 944, 1026)
 * into "HH:MM" text. Returns the original raw text if it doesn't look
 * like a plausible HHMM integer. */
function formatBareTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 2359) return value != null ? String(value) : null;
  const padded = String(Math.round(num)).padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

function toNumberOrZero(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function textOrNull(value: unknown): string | null {
  const s = value != null ? String(value).trim() : "";
  return s === "" ? null : s;
}

function buildInvestigationKey(fields: {
  city: string | null;
  dateISO: string | null;
  dateRaw: string | null;
  location: string | null;
}): string {
  const normalize = (v: string | null) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const parts = [normalize(fields.city), fields.dateISO ?? normalize(fields.dateRaw), normalize(fields.location)];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function parseInvestigationWorkbook(buffer: Buffer): InvestigationParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });

  if (!wb.SheetNames.includes(REQUIRED_SHEET_NAME)) {
    return { records: [], sheetFound: false };
  }

  const ws = wb.Sheets[REQUIRED_SHEET_NAME];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  const records: ParsedInvestigationRecord[] = [];

  for (let r = DATA_START_ROW - 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    const dateVal = row[COL.dateOfFire - 1];
    const locationVal = row[COL.exactLocation - 1];

    // A real data row must have at least a date — this is how we detect
    // the end of actual data among the thousands of pre-formatted blank
    // rows Excel left below it.
    if (dateVal === null || dateVal === undefined) continue;

    const { iso: dateISO, raw: dateRaw } = dateToISO(dateVal);
    const location = textOrNull(locationVal);
    const city = textOrNull(row[COL.cityMunicipality - 1]);

    const record: ParsedInvestigationRecord = {
      source_row_nr: toNumberOrNull(row[COL.nr - 1]),
      date_of_fire: dateISO,
      date_of_fire_raw: dateRaw,
      time_of_alarm_raw: formatBareTime(row[COL.timeOfAlarm - 1]),
      region: textOrNull(row[COL.region - 1]),
      province_district: textOrNull(row[COL.provinceDistrict - 1]),
      city_municipality: textOrNull(row[COL.cityMunicipality - 1]),
      exact_location: location,
      property_general_category: textOrNull(row[COL.propertyGeneral - 1]),
      property_sub_category: textOrNull(row[COL.propertySub - 1]),
      name_of_establishment: textOrNull(row[COL.nameOfEstablishment - 1]),
      number_of_storeys: toNumberOrNull(row[COL.numberOfStoreys - 1]),
      name_of_owner: textOrNull(row[COL.nameOfOwner - 1]),
      name_of_occupant: textOrNull(row[COL.nameOfOccupant - 1]),
      time_fire_started_raw: formatBareTime(row[COL.timeFireStartedTime - 1]),
      fire_out_raw: formatBareTime(row[COL.fireOutTime - 1]),
      injured_firefighter_male: toNumberOrZero(row[COL.injuredFFMale - 1]),
      injured_firefighter_female: toNumberOrZero(row[COL.injuredFFFemale - 1]),
      injured_civilian_male: toNumberOrZero(row[COL.injuredCivMale - 1]),
      injured_civilian_female: toNumberOrZero(row[COL.injuredCivFemale - 1]),
      fatalities_firefighter_male: toNumberOrZero(row[COL.fatalFFMale - 1]),
      fatalities_firefighter_female: toNumberOrZero(row[COL.fatalFFFemale - 1]),
      fatalities_civilian_male: toNumberOrZero(row[COL.fatalCivMale - 1]),
      fatalities_civilian_female: toNumberOrZero(row[COL.fatalCivFemale - 1]),
      estimated_cost_of_damage: toNumberOrNull(row[COL.estimatedCost - 1]),
      number_of_affected_structures: toNumberOrNull(row[COL.affectedStructures - 1]),
      alarm_status: textOrNull(row[COL.alarm - 1]),
      cause: textOrNull(row[COL.cause - 1]),
      classification_of_case: textOrNull(row[COL.classification - 1]),
      fire_arson_investigator: textOrNull(row[COL.investigator - 1]),
      date_report_spot_raw: dateToISO(row[COL.reportSpot - 1]).raw,
      date_report_progress_raw: dateToISO(row[COL.reportProgress - 1]).raw,
      date_report_final_raw: dateToISO(row[COL.reportFinal - 1]).raw,
      remarks: textOrNull(row[COL.remarks - 1]),
      raw_row: Object.fromEntries(row.map((v, i) => [`col_${i + 1}`, v])),
      investigation_key: buildInvestigationKey({ city, dateISO, dateRaw, location }),
      _matchDate: dateISO,
      _matchLocation: (location ?? "").toLowerCase().replace(/\s+/g, " ").trim(),
    };

    records.push(record);
  }

  return { records, sheetFound: true };
}
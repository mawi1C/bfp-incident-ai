-- ============================================================
-- BFP Fire Incident Dashboard — Supabase Schema
-- Run this in Supabase SQL Editor (Project → SQL Editor → New Query)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Table: source_files
-- One row per uploaded Excel/CSV file (for citation + audit trail)
-- ------------------------------------------------------------
create table if not exists source_files (
  id              uuid primary key default gen_random_uuid(),
  file_name       text not null,
  cloudinary_url  text not null,
  file_hash       text,              -- SHA-256 of file content, for exact-duplicate detection
  report_month    text,              -- e.g. "JUNE 2026", parsed from sheet title when available
  uploaded_by     text,              -- officer name/email if you add auth later
  uploaded_at     timestamptz not null default now(),
  row_count       integer default 0 -- how many incidents were successfully parsed from this file
);

-- Prevents the exact same file content from being ingested twice.
-- Partial index (WHERE file_hash IS NOT NULL) so it doesn't block rows
-- inserted before this column existed.
create unique index if not exists idx_source_files_hash
  on source_files (file_hash) where file_hash is not null;

-- ------------------------------------------------------------
-- Table: incidents
-- One row per fire incident. Raw/original text is preserved in
-- *_raw columns because source formatting is inconsistent across
-- months (free-text distances, multi-unit cells, etc). Normalized
-- columns are best-effort parses used for querying/aggregation.
-- ------------------------------------------------------------
create table if not exists incidents (
  id                    uuid primary key default gen_random_uuid(),
  source_file_id        uuid references source_files(id) on delete cascade,
  source_file_name      text not null,        -- denormalized for easy citation by the chatbot
  cloudinary_url        text not null,        -- denormalized for easy citation by the chatbot

  fire_district         text,                 -- e.g. "FIRE DISTRICT I" (section header above station)
  station               text,                 -- e.g. "MANILA" (forward-filled from station header row)

  date_of_response       date,                 -- best-effort parsed date
  date_of_response_raw    text,                 -- original text, e.g. "01 JAN 2026"

  location               text,                 -- exact location/address

  responding_unit_raw    text,                 -- raw cell, may contain multiple units separated by \n

  time_received_call_raw text,
  time_dispatched_raw    text,
  time_arrival_raw       text,

  response_time_minutes  numeric,              -- best-effort parsed number of minutes
  response_time_raw      text,                 -- e.g. "5MINS"

  distance_from_station_raw text,              -- e.g. "1.7 KM", "450M" — left as text, unit inconsistent

  alarm_status           text,                 -- e.g. "FOUA", "1ST ALARM"
  last_alarm_status_raw  text,                 -- full text incl. date/time/alarm level

  type_of_occupancy      text,

  casualties_injured_civilian integer default 0,
  casualties_injured_bfp      integer default 0,
  casualties_death_civilian   integer default 0,
  casualties_death_bfp        integer default 0,

  cause_of_fire           text,                 -- the "REMARKS" column

  -- Fingerprint used for incident-level dedup, independent of which file it
  -- came from. Built from station + date + location + responding unit,
  -- normalized (lowercased, whitespace-collapsed). This is what actually
  -- prevents the same real-world fire from being logged twice — file-level
  -- checks alone can't handle a file that bundles multiple months, or two
  -- differently-named files that happen to contain overlapping data.
  incident_key             text,

  raw_row                 jsonb,                -- full original row as JSON, safety net for anything unmapped

  created_at              timestamptz not null default now()
);

-- Plain (non-partial) unique index. This matters: PostgreSQL's ON CONFLICT
-- target inference (used by our upsert-based dedup in app/api/upload/route.ts)
-- only auto-detects non-partial unique indexes. A WHERE clause here would
-- require repeating that exact predicate in every ON CONFLICT call, which
-- the Supabase JS client's .upsert() doesn't support. Safe without the
-- NULL-filter regardless — Postgres unique indexes already treat NULL as
-- distinct from every other NULL, so rows without a computed key never
-- conflict with each other.
create unique index if not exists idx_incidents_dedup_key
  on incidents (incident_key);

create index if not exists idx_incidents_date on incidents (date_of_response);
create index if not exists idx_incidents_station on incidents (station);
create index if not exists idx_incidents_district on incidents (fire_district);
create index if not exists idx_incidents_cause on incidents (cause_of_fire);
create index if not exists idx_incidents_occupancy on incidents (type_of_occupancy);

-- ------------------------------------------------------------
-- Table: query_cache
-- Caches (question -> generated SQL -> answer) so repeated/identical
-- officer questions skip both Gemini calls entirely. Cleared whenever
-- new incident data is ingested (see app/api/upload/route.ts), since
-- cached answers would otherwise go stale against the new data.
-- ------------------------------------------------------------
create table if not exists query_cache (
  id                uuid primary key default gen_random_uuid(),
  question_normalized text not null unique, -- lowercased, whitespace-collapsed question
  question_original   text not null,
  sql_generated       text not null,
  answer              text not null,
  row_count           integer not null default 0,
  created_at          timestamptz not null default now()
);

create index if not exists idx_query_cache_normalized on query_cache (question_normalized);

-- ------------------------------------------------------------
-- RPC: execute_sql
-- Used by the Text-to-SQL chatbot backend. Gemini generates a
-- SELECT statement; the Next.js server calls this RPC to run it.
--
-- SECURITY NOTE: this function only allows read-only SELECT
-- statements. It rejects anything else to reduce (not eliminate)
-- the risk of the LLM generating a destructive query. Still call
-- this only from server-side code with the service_role key —
-- never expose it to the browser directly.
-- ------------------------------------------------------------
create or replace function execute_sql(query text)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
  normalized text;
begin
  -- IMPORTANT: plain trim() only strips space characters, NOT newlines or
  -- tabs. A multi-line SQL string (e.g. from a JS template literal) would
  -- still start with "\n" after trim() and falsely fail the '^select' check
  -- below. regexp_replace with \s strips all whitespace correctly.
  normalized := lower(regexp_replace(query, '^\s+|\s+$', '', 'g'));

  if normalized !~ '^select' then
    raise exception 'Only SELECT statements are allowed.';
  end if;

  if normalized ~ '(;.*select|insert |update |delete |drop |alter |truncate |grant |revoke )' then
    raise exception 'Query contains disallowed keywords.';
  end if;

  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', query) into result;
  return result;
end;
$$;

-- Restrict who can call it (adjust roles as your auth setup evolves)
revoke all on function execute_sql(text) from public;
grant execute on function execute_sql(text) to service_role;
grant execute on function execute_sql(text) to authenticated;
CREATE TABLE treasury.program_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES treasury.municipalities(id) ON DELETE CASCADE,
  name_key text NOT NULL,
  program_name text NOT NULL,
  enabling_bill text,
  enabling_bill_url text,
  public_law text,
  public_law_url text,
  enacted_year smallint,
  sponsor text,
  sponsor_url text,
  cosponsors_count integer,
  cosponsors_url text,
  details jsonb,
  source_api text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipality_id, name_key)
);

COMMENT ON TABLE treasury.program_details IS 'Tier 2 program origins (v2.0): enabling statute, public law, sponsor — structured from Congress.gov/GovInfo. Every claim field has a paired _url; nothing here may come from model memory.';
COMMENT ON COLUMN treasury.program_details.details IS 'Extensible claims beyond the structured columns. Convention: array of {field, value, source_url} objects — a claim without source_url must not be stored.';
COMMENT ON COLUMN treasury.program_details.source_api IS 'Which official API produced this row: congress.gov | govinfo';

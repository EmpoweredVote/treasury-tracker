-- The registry patterns, mirrored so the database can ask the same question
-- the loaders ask.
--
-- ⚠⚠ WHY A MIRROR AT ALL: the four axis registries are JavaScript modules
-- holding regexes, and the gate runs inside treasury_sync_city_budget. There
-- is no single JS write path to put a guard in — 34 call sites invoke the RPC
-- directly across 61 files — so the RPC is the only chokepoint that holds for
-- a loader written next year by someone who never read the design.
--
-- ⚠ Postgres `~` uses ARE, not bare POSIX ERE, so the patterns are stored
-- VERBATIM as the JS `regex.source`. (?:…), \d{4}, escaped parens and the em
-- dash all work unchanged; only a JS `i` flag is expressed, as an inline
-- (?i) prefix. Translating them would add exactly the drift surface this gate
-- exists to prevent: a pattern that silently fails to match is a green check
-- over unlabelled data. scripts/verifyRegistryPatternParity.mjs proves JS and
-- Postgres agree across every live family.
--
-- Synced by scripts/syncRegisteredFamilies.mjs. A stale mirror is itself a
-- failure mode — it would refuse a family that IS registered — so the sync
-- has a --check mode that exits non-zero on drift.

create table if not exists treasury.registered_source_families (
  axis       text not null,
  entry_id   text not null,
  pattern    text not null,
  synced_at  timestamptz not null default now(),
  primary key (axis, entry_id),
  constraint registered_source_families_axis_known
    check (axis in ('audit_grade', 'fund_scope', 'basis', 'accounting_basis'))
);

comment on table treasury.registered_source_families is
  'Mirror of the four axis registries in scripts/data/*Registry.mjs. Patterns '
  'are JS regex sources, matched with ~ (Postgres ARE). Synced by '
  'scripts/syncRegisteredFamilies.mjs; never hand-edited.';

create index if not exists registered_source_families_axis_idx
  on treasury.registered_source_families (axis);

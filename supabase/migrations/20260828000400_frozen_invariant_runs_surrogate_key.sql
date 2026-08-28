-- ⚠ `ran_at timestamptz primary key default now()` was wrong.
--
-- now() returns TRANSACTION time, not statement time, so two checks inside one
-- transaction produce the same value and the second insert violates the primary
-- key. The check would then fail with a duplicate-key error rather than
-- reporting on the invariant — a check that breaks when exercised twice.
--
-- Found by actually running the failure path instead of assuming it worked: the
-- run that proves the gate fires is, by construction, a second run in the same
-- transaction as the healthy one. A gate nobody has watched fail is not a gate.
alter table treasury.frozen_invariant_runs drop constraint frozen_invariant_runs_pkey;

alter table treasury.frozen_invariant_runs
  add column id bigint generated always as identity primary key;

-- clock_timestamp() advances within a transaction, so ordering stays meaningful
-- even for runs recorded microseconds apart.
alter table treasury.frozen_invariant_runs alter column ran_at set default clock_timestamp();

create index if not exists frozen_invariant_runs_ran_at_idx
  on treasury.frozen_invariant_runs (ran_at desc);

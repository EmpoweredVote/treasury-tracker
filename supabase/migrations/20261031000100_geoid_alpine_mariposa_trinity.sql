-- Geoids for the three CA counties seeded on 2026-10-31 (issue #313).
--
-- Alpine, Mariposa and Trinity are California's three counties with no
-- incorporated cities, so seedCountyLinks.js — a seed-AND-LINK helper driven by
-- city membership — had never created them. They were seeded with geoid NULL,
-- and a county with no geoid is unmatched in Civic Spaces.
--
-- ⚠ VALUES ARE NOT HAND-TYPED. They are the three rows that
-- `node scripts/backfillGeoids.mjs --state CA` resolved from the Census PEP
-- county bulk file once the entities had data; the other 533 rows it emits
-- already carry these exact values, so only these three are applied.
--
-- ⚠ Mountain House is deliberately NOT here. It incorporated 2024-07-01 and the
-- PEP 2024 vintage has no place record for it, so the backfill leaves it NULL:
-- null is a correct answer, a wrong geoid points a reader at another
-- government's budget. It needs the next census vintage.
--
-- Idempotent: re-applying sets the same values.

UPDATE treasury.municipalities AS m
SET geoid = v.geoid, geoid_basis = v.basis
FROM (VALUES
  ('7b9ad6c4-5809-43e1-9cf3-f09351092738'::uuid, '06003', 'census-pep-050-exact'),
  ('32f01121-d1d6-4f0e-a6c4-884667b9c12c'::uuid, '06043', 'census-pep-050-exact'),
  ('552d9ca5-4d7a-455c-9cc5-b12a06826184'::uuid, '06105', 'census-pep-050-exact')
) AS v(id, geoid, basis)
WHERE m.id = v.id;

-- Mountain House's geoid — the thing 20261031000100 said needed the next
-- census vintage.
--
-- Mountain House (San Joaquin County, CA) incorporated 2024-07-01. PEP Vintage
-- 2024 carries boundaries as of 2024-01-01 and has NO place record for it, so
-- the backfill correctly left the geoid NULL rather than guess. PEP Vintage
-- 2025, published 2026-05-14, names it:
--
--   162,06,000,49582,00000,00000,0,A,Mountain House city,California
--   157,06,077,49582,00000,00000,1,A,Mountain House city,California
--
-- County 077 is San Joaquin, which ties: this is the right government.
--
-- ⚠ THE VALUE IS NOT HAND-TYPED. backfillGeoids.mjs now consults the forward
-- vintage after a clean miss and resolves this itself; the row below is the one
-- row its output gained. The other 10,412 are byte-identical to the previous
-- run — measured by writing the SQL both ways and diffing, with ZERO geoids
-- changed.
--
-- ⚠⚠ THE BASE VINTAGE WAS DELIBERATELY NOT MOVED TO 2025. Straight-bumping it
-- resolves FOUR FEWER entities: the Census reclassified Penn Hills and Mt
-- Lebanon (PA) from township MCDs to places (Penn Hills: MCD 59032 -> place
-- 59040), and drops Wheatland borough (PA) and Fort Johnson village (NY)
-- entirely. Those two look like dissolutions but are NOT confirmed, and a
-- reclassification is not a dissolution. See the header of backfillGeoids.mjs.
--
-- Population is left alone: 28,795 is the SCO ByTheNumbers figure the entity
-- was seeded with, and PEP V2025 estimates 25,315. That disagreement is a
-- separate question from which government this is.
--
-- Idempotent: re-applying sets the same value.

UPDATE treasury.municipalities AS m
SET geoid = v.geoid, geoid_basis = v.basis
FROM (VALUES
  ('e6191740-3785-4e7c-9240-ccb68c3c2add'::uuid, '0649582', 'census-pep-162-exact')
) AS v(id, geoid, basis)
WHERE m.id = v.id;

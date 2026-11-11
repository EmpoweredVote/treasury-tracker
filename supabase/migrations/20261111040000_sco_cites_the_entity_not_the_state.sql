-- 24,354 budgets cited a statewide dataset as their source.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠⚠⚠ EVERY CA STATE CONTROLLER BUDGET POINTED AT THE SAME FOUR URLs
-- ─────────────────────────────────────────────────────────────────────────────
-- 480 cities and 57 counties, FY2003-2025, all citing one of:
--
--     https://bythenumbers.sco.ca.gov/d/ju3w-4gxp     city expenditures
--     https://bythenumbers.sco.ca.gov/d/rrtv-rsj9     city revenues
--     https://bythenumbers.sco.ca.gov/d/uctr-c2j8     county expenditures
--     https://bythenumbers.sco.ca.gov/d/emxv-k8xv     county revenues
--
-- A reader of Torrance FY2023 clicked "source" and arrived at a grid of every
-- city in California for every year. #380's lesson one level up: a landing page
-- is not a weaker citation, it is a wrong one.
--
-- ⚠ This was logged as "87 CA entities share two source_urls" — the slice the
-- ev-accounts registry bug touched. The real population is 24,354 budgets.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⭐⭐ THE PUBLISHER HAS A PER-ENTITY VIEW, AND IT TIES TO THE DOLLAR
-- ─────────────────────────────────────────────────────────────────────────────
-- cities.bythenumbers.sco.ca.gov and counties.bythenumbers.sco.ca.gov are the
-- SCO's own per-entity apps. Their totals for an entity-year equal what TT
-- stores — checked for EVERY row before this migration was written, via one
-- API call per (corpus, branch, year):
--
--     24,352 of 24,354 tie exactly     0 entity labels unmatched
--
-- ⛔ The two that did not tie were a real defect, not a citation problem:
-- Berkeley FY2014 and FY2015 expenditures published $0 against the publisher's
-- $293,986,462 and $303,130,296. Those rows held Berkeley's OWN open-data feed
-- (data.cityofberkeley.info/gy8t-iqc4 — 11,894 and 11,559 line items, matching
-- that feed's row counts exactly, carrying approved amounts with no actuals)
-- under an SCO label that a past bulk operation had stamped on them. They were
-- repaired in place first, keeping budgets.id, and now tie.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠⚠ THESE URLs CANNOT BE LIVENESS-CHECKED. THAT IS A PROPERTY OF THE
-- PUBLISHER, NOT A SHORTCUT.
-- ─────────────────────────────────────────────────────────────────────────────
-- The per-entity view is an Angular `#!` route, and a fragment NEVER REACHES
-- THE SERVER. Measured: a real entity, a fake entity and complete nonsense all
-- return the same 236,927-byte shell. So an HTTP probe cannot tell a correct
-- citation from a typo, and probing 24,354 of them would add hours to every
-- gate run and ~24k requests to a state government site to learn nothing.
--
-- ⭐ So the family is exempt from per-URL liveness and verified a STRONGER way:
-- scripts/verifySourceUrls.mjs now ties every stored figure to the publisher's
-- own totals API. A 200 says a server answered; a tie says the number is
-- theirs. ⛔ The exemption is NOT "we gave up on checking these" — it is
-- replacing a check that cannot fail with one that can.
--
-- ⚠ 8,622 TT-derived "Total Governmental" budgets are deliberately NOT touched.
-- Their figure is a SUBSET of the entity's all-funds total, so this page would
-- show a reader a different headline number than the chip. Reproducible from
-- the publisher's own category breakdown (Torrance FY2023: the non-enterprise,
-- non-internal-service categories sum to 299,713,225, exactly TT's derived
-- figure) — but that is a per-budget verification and its own piece of work.

do $$
declare
  v_before   bigint;
  v_updated  bigint;
  v_derived  bigint;
  v_bad      bigint;
  v_after    bigint;
  v_expected bigint := 24354;
begin
  select count(*) into v_before
    from treasury.budgets
   where source_url like 'https://bythenumbers.sco.ca.gov/d/%'
     and data_source not like 'Treasury Tracker derived%';
  if v_before <> v_expected then
    raise exception 'expected % direct SCO citation(s), found % — the population moved under this migration',
      v_expected, v_before;
  end if;

  -- FENCE 1: ⚠ every affected entity must be resolvable to a publisher label.
  -- A county is "Merced" there and "Merced County" here; a city is itself. If
  -- any name would survive the transform empty, or a county lacked the suffix,
  -- the URL would name no entity — and because the shell answers 200 whatever
  -- it is sent, nothing downstream would ever notice.
  select count(*) into v_bad
    from treasury.budgets b
    join treasury.municipalities m on m.id = b.municipality_id
   where b.source_url like 'https://bythenumbers.sco.ca.gov/d/%'
     and b.data_source not like 'Treasury Tracker derived%'
     and (
       m.name is null
       or btrim(m.name) = ''
       or (m.entity_type = 'county' and m.name !~ ' County$')
       or btrim(regexp_replace(m.name, '\s+County$', '')) = ''
     );
  if v_bad <> 0 then
    raise exception '% budget(s) have an entity name this migration cannot turn into a publisher label', v_bad;
  end if;

  -- FENCE 2: the fiscal year must be four digits — it is a path segment.
  select count(*) into v_bad
    from treasury.budgets b
   where b.source_url like 'https://bythenumbers.sco.ca.gov/d/%'
     and b.data_source not like 'Treasury Tracker derived%'
     and b.fiscal_year::text !~ '^\d{4}$';
  if v_bad <> 0 then
    raise exception '% budget(s) have a fiscal_year that is not four digits', v_bad;
  end if;

  update treasury.budgets b
     set source_url =
           'https://'
           || case when m.entity_type = 'county' then 'counties' else 'cities' end
           || '.bythenumbers.sco.ca.gov/#!/year/' || b.fiscal_year::text
           || '/' || case when b.dataset_type = 'revenue' then 'revenue' else 'operating' end
           || '/0/entity_name/'
           || replace(
                case when m.entity_type = 'county'
                     then regexp_replace(m.name, '\s+County$', '')
                     else m.name end,
                ' ', '%20')
           || '/0/category'
    from treasury.municipalities m
   where m.id = b.municipality_id
     and b.source_url like 'https://bythenumbers.sco.ca.gov/d/%'
     and b.data_source not like 'Treasury Tracker derived%';
  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then
    raise exception 'updated % row(s), expected %', v_updated, v_expected;
  end if;

  -- FENCE 3: every written URL must match the shape the loaders and the gate
  -- agree on (scripts/lib/scoEntityCitation.mjs SCO_ENTITY_URL_RE). A stray
  -- space would make a URL no browser resolves, and nothing would 404.
  select count(*) into v_bad
    from treasury.budgets
   where source_url like 'https://cities.bythenumbers.sco.ca.gov/%'
      or source_url like 'https://counties.bythenumbers.sco.ca.gov/%';
  if v_bad <> v_expected then
    raise exception 'expected % per-entity citation(s) after the update, found %', v_expected, v_bad;
  end if;

  select count(*) into v_bad
    from treasury.budgets
   where (source_url like 'https://cities.bythenumbers.sco.ca.gov/%'
          or source_url like 'https://counties.bythenumbers.sco.ca.gov/%')
     and source_url !~ '^https://(cities|counties)\.bythenumbers\.sco\.ca\.gov/#!/year/\d{4}/(operating|revenue)/0/entity_name/[^/[:space:]]+/0/category$';
  if v_bad <> 0 then
    raise exception '% written URL(s) do not match the agreed per-entity shape', v_bad;
  end if;

  -- FENCE 4: ⛔ THE DERIVED ROWS MUST BE UNTOUCHED. Their figure is a subset of
  -- the entity total, so this page would contradict their chip.
  select count(*) into v_derived
    from treasury.budgets
   where source_url like 'https://bythenumbers.sco.ca.gov/d/%'
     and data_source like 'Treasury Tracker derived%';
  if v_derived <> 8622 then
    raise exception 'expected 8,622 derived SCO citation(s) left alone, found %', v_derived;
  end if;

  -- FENCE 5: blast radius. Nothing may still cite a bare dataset page except
  -- those derived rows.
  select count(*) into v_after
    from treasury.budgets
   where source_url like 'https://bythenumbers.sco.ca.gov/d/%';
  if v_after <> v_derived then
    raise exception '% budget(s) still cite a bare dataset page, expected only the % derived', v_after, v_derived;
  end if;

  raise notice 'SCO citations: % repointed to the entity view, % derived rows left on the dataset page',
    v_updated, v_derived;
end $$;

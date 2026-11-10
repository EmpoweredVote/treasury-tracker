-- Cornelius, OR FY2022 and FY2023 — the two ACFRs the City took down.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠⚠⚠ READ THIS BEFORE THE NEXT OREGON REPAIR: ELEVEN OF THE THIRTEEN
-- "DEAD" OREGON CITATIONS WERE NEVER DEAD.
-- ─────────────────────────────────────────────────────────────────────────────
-- The gate listed 13 dead Oregon citations — Hillsboro 5, Tigard 4, Cornelius 4.
-- Asking the publishers directly, 11 of them answered 200 with a PDF. The gate
-- was wrong, not the data, and the cause is fixed in the same commit:
-- `probeUrl` believed a 404 from a HEAD request. CivicPlus DocumentCenter
-- answers HEAD with 404 for a file it serves in full on a GET.
--
-- Had this migration been written to the gate's list, it would have rewritten
-- ELEVEN CORRECT CITATIONS. That is the third time the same error has been
-- caught in three PRs (#373 a down publisher, #374 a rate limit, now a HEAD),
-- and each time the tell was the same: ASK THE PUBLISHER, NOT OUR OWN TOOLING.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT IS ACTUALLY WRONG — AND IT IS NOT A MOVE
-- ─────────────────────────────────────────────────────────────────────────────
-- Cornelius FY2022 (DocumentCenter id 463) and FY2023 (id 462) answer 404 to
-- HEAD, to a ranged GET and to a plain GET alike. They are genuinely gone, and
-- unlike South Carolina and Anchorage they did NOT move. Measured 2026-11-10:
--
--   • The publisher is UP — www.corneliusor.gov/ returns 200 "Cornelius, OR".
--   • It is not an id-block purge — neighbouring id 460 still serves a PDF.
--   • The City's OWN index of financial reports, /258/Financial-Reporting,
--     now lists FY2024 and FY2025 only. FY2022 and FY2023 are not on it.
--   • The retired Drupal tree /sites/default/files/fileattachments/… is gone
--     entirely; even cafr2019.pdf, which search engines still index, 404s.
--   • The sitemap lists 227 pages and no documents at all.
--   • The Federal Audit Clearinghouse holds, for FY2022, only a THREE-PAGE
--     CSLFRF compliance examination — right city, right period, wrong document,
--     with zero fund statements in it — and nothing at all for FY2023.
--
-- So the City withdrew two audited reports from publication. That is the
-- City's call to make, and it is not our place to paper over it.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT WE CITE INSTEAD, AND WHY IT IS STILL THE PUBLISHER'S OWN DOCUMENT
-- ─────────────────────────────────────────────────────────────────────────────
-- The Internet Archive captured both files at the City's own URL on
-- 2026-02-15. These are not a substitute document: they are the City's file,
-- the same bytes, reachable. Both were downloaded and read back before being
-- written here — a 200 is not proof:
--
--   FY2022   148 pages   2,665,615 B   "Annual Comprehensive Financial Report"
--                                      "Cornelius" "Oregon" "June 30, 2022"
--   FY2023   147 pages   2,339,643 B   same, "June 30, 2023"
--
-- ⭐ This is established practice in TT, not a new idea: nine citations already
-- point at web.archive.org captures of a publisher's own file (New Hampshire
-- DAS ×8, King County ×1), in the same raw `id_`/`if_` form used here.
--
-- ⚠ The cost is real and is accepted knowingly: web.archive.org RATE LIMITS
-- automated clients, so these two citations will intermittently come back 429 →
-- `unreachable`. That is the honest verdict for "we could not ask today", a
-- reader with a browser can still open them, and it is strictly better than
-- `dead`, which would order a repair that cannot be performed.
--
-- ⛔ A TARGETED UPDATE, NEVER A RE-LOAD. #372 is the worked example. The
-- hardcoded table in scripts/processCornelius.js is corrected in the same
-- commit, or the next run restores the dead links.
--
-- ⭐ `base_url` was checked by hand, because no gate reads it: the loader's
-- 'https://www.corneliusor.gov/258/Financial-Reporting' returns 200 and is
-- still the right landing page. That check is only a habit so far — the other
-- 155 base_urls remain unwatched.

do $$
declare
  v_rows     int;
  v_budgets  int;
  v_expected int := 4;  -- 2 documents x {General Fund, General Fund Revenue}
begin
  create temp table corn_citation_fix (
    old_url text primary key,
    new_url text not null
  ) on commit drop;

  insert into corn_citation_fix (old_url, new_url) values
    ('https://www.corneliusor.gov/DocumentCenter/View/463/Annual-Comprehensive-Financial-Report-FY2022-PDF',
     'https://web.archive.org/web/20260215072618id_/https://www.corneliusor.gov/DocumentCenter/View/463/Annual-Comprehensive-Financial-Report-FY2022-PDF'),
    ('https://www.corneliusor.gov/DocumentCenter/View/462/Annual-Comprehensive-Financial-Report-FY2023-PDF',
     'https://web.archive.org/web/20260215072617id_/https://www.corneliusor.gov/DocumentCenter/View/462/Annual-Comprehensive-Financial-Report-FY2023-PDF');

  select count(*) into v_rows from corn_citation_fix;
  if v_rows <> 2 then
    raise exception 'expected 2 citation pairs, built %', v_rows;
  end if;

  -- FENCE 1: every old URL must still be in use. If the set has drifted,
  -- somebody has already touched these rows and this migration is stale.
  select count(*) into v_rows
    from corn_citation_fix f
   where not exists (select 1 from treasury.budgets b where b.source_url = f.old_url);
  if v_rows <> 0 then
    raise exception '% of 2 old citation(s) are no longer present — refusing to guess', v_rows;
  end if;

  -- FENCE 2: refuse to collapse two citations into one.
  select count(*) into v_rows
    from treasury.budgets b
    join corn_citation_fix f on b.source_url = f.new_url;
  if v_rows <> 0 then
    raise exception '% budget(s) already cite a replacement URL — would merge citations', v_rows;
  end if;

  -- FENCE 3: the blast radius must be exactly Cornelius's FY2022+FY2023.
  select count(*) into v_budgets
    from treasury.budgets b
    join corn_citation_fix f on b.source_url = f.old_url;
  if v_budgets <> v_expected then
    raise exception 'expected % budget(s) to repair, found %', v_expected, v_budgets;
  end if;

  -- FENCE 4: ⚠⚠⚠ THE ELEVEN. This migration must not touch a single citation
  -- that was only ever "dead" because of the HEAD defect. Hillsboro, Tigard and
  -- Cornelius FY2024/FY2025 all answer 200 from the publisher right now, and
  -- every one of them must still cite the publisher directly when this is done.
  select count(*) into v_rows
    from treasury.budgets
   where source_url in (
     'https://www.corneliusor.gov/DocumentCenter/View/1301/Annual-Comprehensive-Financial-Report-FY2024-PDF',
     'https://www.corneliusor.gov/DocumentCenter/View/2002/Annual-Comprehensive-Financial-Report-FY2025-PDF',
     'https://www.hillsboro-oregon.gov/home/showpublisheddocument/27594/637746586154900000',
     'https://www.hillsboro-oregon.gov/home/showpublisheddocument/29088/638060879017770000',
     'https://www.hillsboro-oregon.gov/home/showpublisheddocument/30121/638372968010970000',
     'https://www.hillsboro-oregon.gov/home/showpublisheddocument/31331/638699517637570000',
     'https://www.hillsboro-oregon.gov/home/showdocument?id=32248&t=639009654787414827',
     'https://www.tigard-or.gov/home/showpublisheddocument/3113/638210414060600000',
     'https://www.tigard-or.gov/home/showpublisheddocument/4240/638481922257230000',
     'https://www.tigard-or.gov/home/showpublisheddocument/5021/638712267566470000',
     'https://www.tigard-or.gov/home/showpublisheddocument/6307/639051272038830000'
   );
  if v_rows <> 22 then
    raise exception
      'expected the 11 never-dead Oregon citations to cover 22 budgets, found % — '
      'do NOT proceed: either they have been rewritten, or the set has changed', v_rows;
  end if;

  update treasury.budgets b
     set source_url = f.new_url
    from corn_citation_fix f
   where b.source_url = f.old_url;

  get diagnostics v_rows = row_count;
  if v_rows <> v_expected then
    raise exception 'updated % row(s), expected %', v_rows, v_expected;
  end if;

  -- FENCE 5: nothing may still cite the two withdrawn DocumentCenter ids.
  select count(*) into v_rows
    from treasury.budgets
   where source_url in (
     'https://www.corneliusor.gov/DocumentCenter/View/463/Annual-Comprehensive-Financial-Report-FY2022-PDF',
     'https://www.corneliusor.gov/DocumentCenter/View/462/Annual-Comprehensive-Financial-Report-FY2023-PDF'
   );
  if v_rows <> 0 then
    raise exception '% budget(s) still cite a withdrawn Cornelius document', v_rows;
  end if;

  raise notice 'Cornelius: re-cited % withdrawn document(s) across % budget(s); 11 Oregon citations left untouched', 2, v_expected;
end $$;

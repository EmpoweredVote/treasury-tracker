-- Massachusetts and California: 24,508 budgets that cited nothing now cite the
-- publisher — per municipality-year for MA, per annual export for CA.
--
-- ⚠⚠⚠ FOUR FAMILIES WERE 97.5% OF EVERY LINKLESS BUDGET IN THE FLEET
--
--   MA General Fund Expenditures                   8,408   351 munis, FY2002-2025
--   Government Compensation in California          7,682   482 cities, FY2009-2024
--   MA General Fund Revenues                       6,663   351 munis, FY2002-2020
--   MA DLS General Fund Revenue by Source          1,755   351 munis, FY2021-2025
--                                                 24,508   of 24,806 uncited
--
-- ⚠ A TARGETED UPDATE ON source_url, NEVER A RE-LOAD. Re-running a loader
-- re-mints budgets.id and stales the id-keyed frozen registry (#372).
--
-- CALIFORNIA: the citation is the file the loader read —
-- gcc.sco.ca.gov/RawExport/<year>_City.zip. All 16 downloaded, every city's
-- total rebuilt with the loader's own D-02 rule: 7,682 of 7,682 tie exactly.
--
-- MASSACHUSETTS: the DLS Gateway addresses ONE municipality-year by GET, so
-- this is a per-row citation, not a landing page (#381). All three MA families
-- read ScheduleA.GeneralFund — including the one named after
-- RevenueBySource.RBS.RevbySource2, whose figures are Schedule A "Total
-- Revenues" to the dollar. ⛔ The family cannot be liveness-checked: measured
-- 2026-11-13, a real row, a bad DOR code, a bad year, nonsense and A REPORT
-- NAME THAT DOES NOT EXIST all answer HTTP 200. verify:source-urls exempts it
-- and ties every figure instead. See scripts/lib/maDlsCitation.mjs.
--
-- ⛔⛔ ELEVEN MA BUDGETS ARE DELIBERATELY LEFT UNCITED. 16,815 of 16,826 tie;
-- these eleven do not, and each was re-asked on its own page, which agreed:
--   Hudson FY2024/FY2025, Holyoke FY2025, Florida FY2025, Gill FY2025,
--   Gosnold FY2025 — the publisher now prints 0 (not filed, not zero dollars)
--   Holyoke FY2024, Brockton FY2025, Hopedale FY2025, Orange FY2025 — restated
--   Abington FY2025 Expenditures — 69,061,344 vs 69,061,343, one dollar
-- citeNonStatementSources.mjs established the rule: probe before you write and
-- write only what answered. The analogue is TIE before you write. They are not
-- repaired here either — a figure owns a category tree that must be re-derived
-- with it — so they stay linkless, named, and in the uncited baseline.

do $$
declare
  v_ca_before      bigint;
  v_ca_updated     bigint;
  v_ma_before      bigint;
  v_ma_updated     bigint;
  v_roster_missing bigint;
  v_bad_type       bigint;
  v_left           bigint;
  v_malformed      bigint;
  v_ca_expected    bigint := 7682;
  v_ma_uncited     bigint := 16826;
  v_ma_expected    bigint := 16815;  -- 16,826 less the eleven that do not tie
begin
  -- ⚠ tt_name is UNIQUE as well as the code: the update joins on the name, and
  -- two roster rows sharing one would multiply the join and let Postgres pick a
  -- DOR code arbitrarily — a wrong citation at HTTP 200.
  create temporary table ma_dls_roster (
    dor_code text primary key,
    tt_name  text not null unique
  ) on commit drop;
  insert into ma_dls_roster (dor_code, tt_name) values
    ('001', 'Abington'),
    ('002', 'Acton'),
    ('003', 'Acushnet'),
    ('004', 'Adams'),
    ('005', 'Agawam Town'),
    ('006', 'Alford'),
    ('007', 'Amesbury'),
    ('008', 'Amherst Town'),
    ('009', 'Andover'),
    ('010', 'Arlington'),
    ('011', 'Ashburnham'),
    ('012', 'Ashby'),
    ('013', 'Ashfield'),
    ('014', 'Ashland'),
    ('015', 'Athol'),
    ('016', 'Attleboro'),
    ('017', 'Auburn'),
    ('018', 'Avon'),
    ('019', 'Ayer'),
    ('020', 'Barnstable Town'),
    ('021', 'Barre'),
    ('022', 'Becket'),
    ('023', 'Bedford'),
    ('024', 'Belchertown'),
    ('025', 'Bellingham'),
    ('026', 'Belmont'),
    ('027', 'Berkley'),
    ('028', 'Berlin'),
    ('029', 'Bernardston'),
    ('030', 'Beverly'),
    ('031', 'Billerica'),
    ('032', 'Blackstone'),
    ('033', 'Blandford'),
    ('034', 'Bolton'),
    ('035', 'Boston'),
    ('036', 'Bourne'),
    ('037', 'Boxborough'),
    ('038', 'Boxford'),
    ('039', 'Boylston'),
    ('040', 'Braintree Town'),
    ('041', 'Brewster'),
    ('042', 'Bridgewater Town'),
    ('043', 'Brimfield'),
    ('044', 'Brockton'),
    ('045', 'Brookfield'),
    ('046', 'Brookline'),
    ('047', 'Buckland'),
    ('048', 'Burlington'),
    ('049', 'Cambridge'),
    ('050', 'Canton'),
    ('051', 'Carlisle'),
    ('052', 'Carver'),
    ('053', 'Charlemont'),
    ('054', 'Charlton'),
    ('055', 'Chatham'),
    ('056', 'Chelmsford'),
    ('057', 'Chelsea'),
    ('058', 'Cheshire'),
    ('059', 'Chester'),
    ('060', 'Chesterfield'),
    ('061', 'Chicopee'),
    ('062', 'Chilmark'),
    ('063', 'Clarksburg'),
    ('064', 'Clinton'),
    ('065', 'Cohasset'),
    ('066', 'Colrain'),
    ('067', 'Concord'),
    ('068', 'Conway'),
    ('069', 'Cummington'),
    ('070', 'Dalton'),
    ('071', 'Danvers'),
    ('072', 'Dartmouth'),
    ('073', 'Dedham'),
    ('074', 'Deerfield'),
    ('075', 'Dennis'),
    ('076', 'Dighton'),
    ('077', 'Douglas'),
    ('078', 'Dover'),
    ('079', 'Dracut'),
    ('080', 'Dudley'),
    ('081', 'Dunstable'),
    ('082', 'Duxbury'),
    ('083', 'East Bridgewater'),
    ('084', 'East Brookfield'),
    ('085', 'East Longmeadow'),
    ('086', 'Eastham'),
    ('087', 'Easthampton'),
    ('088', 'Easton'),
    ('089', 'Edgartown'),
    ('090', 'Egremont'),
    ('091', 'Erving'),
    ('092', 'Essex'),
    ('093', 'Everett'),
    ('094', 'Fairhaven'),
    ('095', 'Fall River'),
    ('096', 'Falmouth'),
    ('097', 'Fitchburg'),
    ('098', 'Florida'),
    ('099', 'Foxborough'),
    ('100', 'Framingham'),
    ('101', 'Franklin Town'),
    ('102', 'Freetown'),
    ('103', 'Gardner'),
    ('104', 'Aquinnah'),
    ('105', 'Georgetown'),
    ('106', 'Gill'),
    ('107', 'Gloucester'),
    ('108', 'Goshen'),
    ('109', 'Gosnold'),
    ('110', 'Grafton'),
    ('111', 'Granby'),
    ('112', 'Granville'),
    ('113', 'Great Barrington'),
    ('114', 'Greenfield'),
    ('115', 'Groton'),
    ('116', 'Groveland'),
    ('117', 'Hadley'),
    ('118', 'Halifax'),
    ('119', 'Hamilton'),
    ('120', 'Hampden'),
    ('121', 'Hancock'),
    ('122', 'Hanover'),
    ('123', 'Hanson'),
    ('124', 'Hardwick'),
    ('125', 'Harvard'),
    ('126', 'Harwich'),
    ('127', 'Hatfield'),
    ('128', 'Haverhill'),
    ('129', 'Hawley'),
    ('130', 'Heath'),
    ('131', 'Hingham'),
    ('132', 'Hinsdale'),
    ('133', 'Holbrook'),
    ('134', 'Holden'),
    ('135', 'Holland'),
    ('136', 'Holliston'),
    ('137', 'Holyoke'),
    ('138', 'Hopedale'),
    ('139', 'Hopkinton'),
    ('140', 'Hubbardston'),
    ('141', 'Hudson'),
    ('142', 'Hull'),
    ('143', 'Huntington'),
    ('144', 'Ipswich'),
    ('145', 'Kingston'),
    ('146', 'Lakeville'),
    ('147', 'Lancaster'),
    ('148', 'Lanesborough'),
    ('149', 'Lawrence'),
    ('150', 'Lee'),
    ('151', 'Leicester'),
    ('152', 'Lenox'),
    ('153', 'Leominster'),
    ('154', 'Leverett'),
    ('155', 'Lexington'),
    ('156', 'Leyden'),
    ('157', 'Lincoln'),
    ('158', 'Littleton'),
    ('159', 'Longmeadow'),
    ('160', 'Lowell'),
    ('161', 'Ludlow'),
    ('162', 'Lunenburg'),
    ('163', 'Lynn'),
    ('164', 'Lynnfield'),
    ('165', 'Malden'),
    ('166', 'Manchester By The Sea'),
    ('167', 'Mansfield'),
    ('168', 'Marblehead'),
    ('169', 'Marion'),
    ('170', 'Marlborough'),
    ('171', 'Marshfield'),
    ('172', 'Mashpee'),
    ('173', 'Mattapoisett'),
    ('174', 'Maynard'),
    ('175', 'Medfield'),
    ('176', 'Medford'),
    ('177', 'Medway'),
    ('178', 'Melrose'),
    ('179', 'Mendon'),
    ('180', 'Merrimac'),
    ('181', 'Methuen'),
    ('182', 'Middleborough'),
    ('183', 'Middlefield'),
    ('184', 'Middleton'),
    ('185', 'Milford'),
    ('186', 'Millbury'),
    ('187', 'Millis'),
    ('188', 'Millville'),
    ('189', 'Milton'),
    ('190', 'Monroe'),
    ('191', 'Monson'),
    ('192', 'Montague'),
    ('193', 'Monterey'),
    ('194', 'Montgomery'),
    ('195', 'Mount Washington'),
    ('196', 'Nahant'),
    ('197', 'Nantucket'),
    ('198', 'Natick'),
    ('199', 'Needham'),
    ('200', 'New Ashford'),
    ('201', 'New Bedford'),
    ('202', 'New Braintree'),
    ('203', 'New Marlborough'),
    ('204', 'New Salem'),
    ('205', 'Newbury'),
    ('206', 'Newburyport'),
    ('207', 'Newton'),
    ('208', 'Norfolk'),
    ('209', 'North Adams'),
    ('210', 'North Andover'),
    ('211', 'North Attleborough Town'),
    ('212', 'North Brookfield'),
    ('213', 'North Reading'),
    ('214', 'Northampton'),
    ('215', 'Northborough'),
    ('216', 'Northbridge'),
    ('217', 'Northfield'),
    ('218', 'Norton'),
    ('219', 'Norwell'),
    ('220', 'Norwood'),
    ('221', 'Oak Bluffs'),
    ('222', 'Oakham'),
    ('223', 'Orange'),
    ('224', 'Orleans'),
    ('225', 'Otis'),
    ('226', 'Oxford'),
    ('227', 'Palmer Town'),
    ('228', 'Paxton'),
    ('229', 'Peabody'),
    ('230', 'Pelham'),
    ('231', 'Pembroke'),
    ('232', 'Pepperell'),
    ('233', 'Peru'),
    ('234', 'Petersham'),
    ('235', 'Phillipston'),
    ('236', 'Pittsfield'),
    ('237', 'Plainfield'),
    ('238', 'Plainville'),
    ('239', 'Plymouth'),
    ('240', 'Plympton'),
    ('241', 'Princeton'),
    ('242', 'Provincetown'),
    ('243', 'Quincy'),
    ('244', 'Randolph Town'),
    ('245', 'Raynham'),
    ('246', 'Reading'),
    ('247', 'Rehoboth'),
    ('248', 'Revere'),
    ('249', 'Richmond'),
    ('250', 'Rochester'),
    ('251', 'Rockland'),
    ('252', 'Rockport'),
    ('253', 'Rowe'),
    ('254', 'Rowley'),
    ('255', 'Royalston'),
    ('256', 'Russell'),
    ('257', 'Rutland'),
    ('258', 'Salem'),
    ('259', 'Salisbury'),
    ('260', 'Sandisfield'),
    ('261', 'Sandwich'),
    ('262', 'Saugus'),
    ('263', 'Savoy'),
    ('264', 'Scituate'),
    ('265', 'Seekonk'),
    ('266', 'Sharon'),
    ('267', 'Sheffield'),
    ('268', 'Shelburne'),
    ('269', 'Sherborn'),
    ('270', 'Shirley'),
    ('271', 'Shrewsbury'),
    ('272', 'Shutesbury'),
    ('273', 'Somerset'),
    ('274', 'Somerville'),
    ('275', 'South Hadley'),
    ('276', 'Southampton'),
    ('277', 'Southborough'),
    ('278', 'Southbridge Town'),
    ('279', 'Southwick'),
    ('280', 'Spencer'),
    ('281', 'Springfield'),
    ('282', 'Sterling'),
    ('283', 'Stockbridge'),
    ('284', 'Stoneham'),
    ('285', 'Stoughton'),
    ('286', 'Stow'),
    ('287', 'Sturbridge'),
    ('288', 'Sudbury'),
    ('289', 'Sunderland'),
    ('290', 'Sutton'),
    ('291', 'Swampscott'),
    ('292', 'Swansea'),
    ('293', 'Taunton'),
    ('294', 'Templeton'),
    ('295', 'Tewksbury'),
    ('296', 'Tisbury'),
    ('297', 'Tolland'),
    ('298', 'Topsfield'),
    ('299', 'Townsend'),
    ('300', 'Truro'),
    ('301', 'Tyngsborough'),
    ('302', 'Tyringham'),
    ('303', 'Upton'),
    ('304', 'Uxbridge'),
    ('305', 'Wakefield'),
    ('306', 'Wales'),
    ('307', 'Walpole'),
    ('308', 'Waltham'),
    ('309', 'Ware'),
    ('310', 'Wareham'),
    ('311', 'Warren'),
    ('312', 'Warwick'),
    ('313', 'Washington'),
    ('314', 'Watertown'),
    ('315', 'Wayland'),
    ('316', 'Webster'),
    ('317', 'Wellesley'),
    ('318', 'Wellfleet'),
    ('319', 'Wendell'),
    ('320', 'Wenham'),
    ('321', 'West Boylston'),
    ('322', 'West Bridgewater'),
    ('323', 'West Brookfield'),
    ('324', 'West Newbury'),
    ('325', 'West Springfield Town'),
    ('326', 'West Stockbridge'),
    ('327', 'West Tisbury'),
    ('328', 'Westborough'),
    ('329', 'Westfield'),
    ('330', 'Westford'),
    ('331', 'Westhampton'),
    ('332', 'Westminster'),
    ('333', 'Weston'),
    ('334', 'Westport'),
    ('335', 'Westwood'),
    ('336', 'Weymouth Town'),
    ('337', 'Whately'),
    ('338', 'Whitman'),
    ('339', 'Wilbraham'),
    ('340', 'Williamsburg'),
    ('341', 'Williamstown'),
    ('342', 'Wilmington'),
    ('343', 'Winchendon'),
    ('344', 'Winchester'),
    ('345', 'Windsor'),
    ('346', 'Winthrop Town'),
    ('347', 'Woburn'),
    ('348', 'Worcester'),
    ('349', 'Worthington'),
    ('350', 'Wrentham'),
    ('351', 'Yarmouth');

  if (select count(*) from ma_dls_roster) <> 351 then
    raise exception 'the DLS roster must carry all 351 municipalities, found %',
      (select count(*) from ma_dls_roster);
  end if;

  -- ⛔ The eleven whose stored figure the publisher no longer prints.
  create temporary table ma_dls_untied (
    tt_name     text not null,
    fiscal_year int  not null,
    amount_type text not null
  ) on commit drop;
  insert into ma_dls_untied (tt_name, fiscal_year, amount_type) values
    ('Hudson',   2024, 'Revenues'),
    ('Hudson',   2025, 'Revenues'),
    ('Holyoke',  2024, 'Revenues'),
    ('Holyoke',  2025, 'Revenues'),
    ('Florida',  2025, 'Revenues'),
    ('Gill',     2025, 'Revenues'),
    ('Gosnold',  2025, 'Revenues'),
    ('Brockton', 2025, 'Revenues'),
    ('Hopedale', 2025, 'Revenues'),
    ('Orange',   2025, 'Revenues'),
    ('Abington', 2025, 'Expenditures');

  -- ── FENCE 1: the populations must be the ones this migration was written
  -- against. A family that moved underneath it is a reason to stop, not to
  -- write a citation onto rows nobody measured.
  select count(*) into v_ca_before
    from treasury.budgets
   where data_source = 'CA State Controller — Government Compensation in California (publicpay.ca.gov)'
     and source_url is null;
  if v_ca_before <> v_ca_expected then
    raise exception 'expected % uncited publicpay budget(s), found %', v_ca_expected, v_ca_before;
  end if;

  select count(*) into v_ma_before
    from treasury.budgets
   where source_url is null
     and (data_source like '%MA General Fund Expenditures'
       or data_source like '%MA General Fund Revenues'
       or data_source like '%MA DLS General Fund Revenue by Source');
  if v_ma_before <> v_ma_uncited then
    raise exception 'expected % uncited MA budget(s), found %', v_ma_uncited, v_ma_before;
  end if;

  -- ── FENCE 2: ⚠⚠ every affected MA municipality must resolve to a DOR code.
  -- A name the roster does not know would otherwise be skipped SILENTLY by the
  -- join, and silence here reads as "already cited" on the next census.
  select count(*) into v_roster_missing
    from treasury.budgets b
    join treasury.municipalities m on m.id = b.municipality_id
   where b.source_url is null
     and (b.data_source like '%MA General Fund Expenditures'
       or b.data_source like '%MA General Fund Revenues'
       or b.data_source like '%MA DLS General Fund Revenue by Source')
     and not exists (select 1 from ma_dls_roster r where r.tt_name = m.name);
  if v_roster_missing > 0 then
    raise exception '% MA budget(s) belong to a municipality with no DOR code', v_roster_missing;
  end if;

  -- ── FENCE 3: ⛔ the Revenues/Expenditures toggle is DERIVED, so an
  -- unexpected dataset_type must stop the migration rather than pick a side.
  select count(*) into v_bad_type
    from treasury.budgets b
   where b.source_url is null
     and (b.data_source like '%MA General Fund Expenditures'
       or b.data_source like '%MA General Fund Revenues'
       or b.data_source like '%MA DLS General Fund Revenue by Source')
     and b.dataset_type not in ('operating', 'revenue');
  if v_bad_type > 0 then
    raise exception '% MA budget(s) carry a dataset_type with no Schedule A column', v_bad_type;
  end if;

  -- ── CALIFORNIA ────────────────────────────────────────────────────────────
  update treasury.budgets b
     set source_url = 'https://gcc.sco.ca.gov/RawExport/' || b.fiscal_year::text || '_City.zip'
   where b.data_source = 'CA State Controller — Government Compensation in California (publicpay.ca.gov)'
     and b.source_url is null
     and b.fiscal_year between 2009 and 2024;
  get diagnostics v_ca_updated = row_count;

  -- ── MASSACHUSETTS ─────────────────────────────────────────────────────────
  update treasury.budgets b
     set source_url =
           'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GeneralFund'
           || '&iclMuni=' || r.dor_code
           || '&islYear=' || b.fiscal_year::text
           || '&islAmountType=' || (case b.dataset_type
                                      when 'revenue'   then 'Revenues'
                                      when 'operating' then 'Expenditures'
                                    end)
    from treasury.municipalities m
    join ma_dls_roster r on r.tt_name = m.name
   where m.id = b.municipality_id
     and m.state = 'MA'
     and b.source_url is null
     and b.fiscal_year between 2002 and 2026
     and (b.data_source like '%MA General Fund Expenditures'
       or b.data_source like '%MA General Fund Revenues'
       or b.data_source like '%MA DLS General Fund Revenue by Source')
     -- ⛔ tie before you write, and write only what tied
     and not exists (
       select 1 from ma_dls_untied u
        where u.tt_name = m.name
          and u.fiscal_year = b.fiscal_year
          and u.amount_type = (case b.dataset_type
                                 when 'revenue'   then 'Revenues'
                                 when 'operating' then 'Expenditures'
                               end));
  get diagnostics v_ma_updated = row_count;

  if v_ca_updated <> v_ca_expected then
    raise exception 'CA: wrote % citation(s), expected %', v_ca_updated, v_ca_expected;
  end if;
  if v_ma_updated <> v_ma_expected then
    raise exception 'MA: wrote % citation(s), expected %', v_ma_updated, v_ma_expected;
  end if;

  -- ── FENCE 4: ⚠⚠ exactly the eleven named rows may still cite nothing, and
  -- they must BE those eleven. "11 left" alone would pass if eleven DIFFERENT
  -- budgets had been missed and eleven untied ones cited.
  select count(*) into v_left
    from treasury.budgets b
    join treasury.municipalities m on m.id = b.municipality_id
   where b.source_url is null
     and (b.data_source = 'CA State Controller — Government Compensation in California (publicpay.ca.gov)'
       or b.data_source like '%MA General Fund Expenditures'
       or b.data_source like '%MA General Fund Revenues'
       or b.data_source like '%MA DLS General Fund Revenue by Source')
     and not exists (
       select 1 from ma_dls_untied u
        where u.tt_name = m.name
          and u.fiscal_year = b.fiscal_year
          and u.amount_type = (case b.dataset_type
                                 when 'revenue'   then 'Revenues'
                                 when 'operating' then 'Expenditures'
                               end));
  if v_left > 0 then
    raise exception '% budget(s) in the four families cite nothing and are not on the untied list', v_left;
  end if;

  select count(*) into v_left
    from treasury.budgets b
    join treasury.municipalities m on m.id = b.municipality_id
    join ma_dls_untied u
      on u.tt_name = m.name
     and u.fiscal_year = b.fiscal_year
     and u.amount_type = (case b.dataset_type
                            when 'revenue'   then 'Revenues'
                            when 'operating' then 'Expenditures'
                          end)
   where b.source_url is null
     and (b.data_source like '%MA General Fund Expenditures'
       or b.data_source like '%MA General Fund Revenues'
       or b.data_source like '%MA DLS General Fund Revenue by Source');
  if v_left <> 11 then
    raise exception 'expected the 11 untied MA budget(s) to be left linkless, found %', v_left;
  end if;

  -- ── FENCE 5: ⚠⚠ EVERY URL WRITTEN MUST MATCH THE SHAPE THE GATE RECOGNISES.
  -- verify:source-urls SKIPS the liveness probe for the MA family, so a URL
  -- outside the shape would be neither probed nor tied. This is the SQL half of
  -- MA_DLS_URL_RE in scripts/lib/maDlsCitation.mjs.
  select count(*) into v_malformed
    from treasury.budgets
   where (data_source like '%MA General Fund Expenditures'
       or data_source like '%MA General Fund Revenues'
       or data_source like '%MA DLS General Fund Revenue by Source')
     and source_url is not null
     and source_url !~ ('^https://dls-gw\.dor\.state\.ma\.us/reports/rdPage\.aspx'
                     || '\?rdReport=ScheduleA\.GeneralFund'
                     || '&iclMuni=[0-9]{3}&islYear=[0-9]{4}&islAmountType=(Revenues|Expenditures)$');
  if v_malformed > 0 then
    raise exception '% MA citation(s) do not match the shape the gate recognises', v_malformed;
  end if;

  select count(*) into v_malformed
    from treasury.budgets
   where data_source = 'CA State Controller — Government Compensation in California (publicpay.ca.gov)'
     and source_url !~ '^https://gcc\.sco\.ca\.gov/RawExport/[0-9]{4}_City\.zip$';
  if v_malformed > 0 then
    raise exception '% publicpay citation(s) do not match the expected shape', v_malformed;
  end if;

  raise notice 'cited % CA and % MA budget(s)', v_ca_updated, v_ma_updated;
end $$;

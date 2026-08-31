import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * ⚠⚠ `treasury_sync_city_budget` DECIDES UPDATE-VS-INSERT ON THE AXIS PAIR.
 *
 * Its target lookup is, verbatim from the function definition:
 *
 *   SELECT id INTO v_budget_id FROM treasury.budgets
 *   WHERE municipality_id = p_municipality_id
 *     AND fiscal_year     = p_fiscal_year
 *     AND dataset_type    = p_dataset_type
 *     AND fund_scope      = p_fund_scope     -- DEFAULT 'unknown'
 *     AND basis           = p_basis;         -- DEFAULT 'unknown'
 *
 * A caller that omits the two axis parameters is therefore asking for the row
 * whose scope and basis are BOTH still `'unknown'`. That is fine on a first
 * load — the row does not exist yet, so the INSERT branch is correct — and it
 * silently becomes a duplicate-generator the moment the axis stampers classify
 * the family. Nothing warns: the RPC returns `status: success` and reports the
 * rows it inserted.
 *
 * ⚠ THE GUARD PEOPLE REMEMBER IS THE WRONG ONE. `project_sync_city_budget_not_source_safe`
 * trained everyone to think about `data_source`, and `findConflictingBudget`
 * checks exactly that. But `data_source` is NOT in the lookup key; the axis pair
 * is. A loader can pass every source-safety check and still duplicate.
 *
 * Found 2026-08-29 in the Knight session-3 Florida loader, which omitted them —
 * harmless only because its rows did not exist yet. The label-strip re-run would
 * have inserted 190 phantom rows. The audit that followed found four more
 * exposed families totalling 30,786 rows.
 *
 * ⚠ Measured read-only before anything was changed: for Columbus, OH FY2024
 * operating, the omitted-params lookup matched **0** rows and the passed-params
 * lookup matched **1**. The bug was real, not theoretical — and no duplicate
 * existed anywhere in the table, so it had never actually fired.
 *
 * ── WHY SOME CALLERS MUST *NOT* PASS THEM ───────────────────────────────────
 *
 * The rule is not "always pass". It is **"pass exactly what the family's rows
 * carry."** A loader whose family is still wholly `unknown`/`unknown` would be
 * BROKEN by passing real values — its lookup would stop matching and it would
 * duplicate in the other direction. Those callers are exempt below, each with
 * the measurement that justifies it, and each must be revisited if its family is
 * ever stamped.
 */

/** Callers that legitimately omit the axis params, with the reason. */
const EXEMPT = {
  'loadCASalaries.js':
    'publicpay compensation, 7,682 rows, measured 2026-08-29: fund_scope and basis are '
    + 'BOTH still unknown on every row. Passing real values would stop the lookup matching.',
  'sweepCASalaries.js': 'Same publicpay family as loadCASalaries.js — unstamped.',
  'sweepOCSalaries.js': 'Same publicpay family as loadCASalaries.js — unstamped.',
  'loadLACountySalaries.js':
    '"LA County Open Data - Employee Salaries", 1 row, unknown/unknown.',
  'loadUtahTransparency.js':
    '"Transparent Utah", 539 rows, unknown/unknown (measured 2026-08-29).',
  'loadVAComparativeReport.js':
    '"Virginia APA Comparative Report", 608 rows, unknown/unknown.',
  'loadWICMREB.js':
    'Wisconsin DOR CMREB, 20 rows, unknown/unknown.',
};

/**
 * Callers that MUST pass the axis pair, with the family and the row count that
 * would be duplicated by a re-run if they stopped.
 */
const REQUIRED = {
  // ⚠ Georgia is the first REQUIRED caller whose pair is MIXED — `unknown`
  // scope with a real `actual` basis — so it is worth being explicit about why
  // it is not EXEMPT. EXEMPT means "omits the params because the family is
  // wholly unknown/unknown"; this loader PASSES both, and its rows are born
  // unknown/actual. Omitting them would ask for unknown/unknown, match nothing
  // on a re-run, and duplicate all 66 rows.
  // ⚠ fund_scope is `unknown` DELIBERATELY, not pending: RLGF Part V excludes
  // debt service, so the figures understate a true total_governmental by ~5.5%
  // and there is no registry entry claiming otherwise. If a scope is ever
  // asserted for this family, THIS LOADER MUST CHANGE IN THE SAME COMMIT.
  'loadGeorgiaRLGF.mjs': 'Georgia DCA RLGF — 66 rows, unknown/actual (scope unknown on purpose)',
  // Knight session 5. Both families are NEW — no rows existed before this load —
  // so the first run takes the INSERT branch and every later run matches on the
  // values written here. ⚠ Pennsylvania carries TWO scopes in one loader:
  // municipalities are all_funds (DCED folds enterprise into its totals and
  // publishes no removable enterprise subtotal) and counties are
  // total_governmental (the county report says so in its column names). Both are
  // read from the source, so `fundScopeFor()` resolves per entity and the RPC is
  // passed whichever that entity's rows actually carry.
  'loadPaDced.mjs': 'PA DCED CLGS-30 — 58 rows, all_funds (municipal) + total_governmental (county) / actual',
  // Knight session 7a. A NEW family — no Michigan local rows existed before this
  // load — so the first run INSERTs and every later run matches on the values
  // written here.
  // ⚠⚠ THE FIRST LOADER IN TT TO WRITE TWO SCOPES FOR THE SAME ENTITY-YEAR, and
  // therefore the caller with the most to lose if the pair were omitted. The
  // RPC's lookup key is fund_scope + basis (NOT data_source), which is exactly
  // what makes the two series coexist rather than overwrite each other: one
  // general_fund/actual row and one total_governmental/actual row per entity per
  // year per dataset type. Omit p_fund_scope and both series would collapse onto
  // the same unknown/unknown lookup — the first run would have them fight for
  // one row and a re-run would DUPLICATE all 128.
  'loadMichiganF65.mjs': 'MI Treasury F-65 — 128 rows, general_fund + total_governmental / actual',
  // Knight session 7b. Kansas is a NEW family; Colorado EXTENDS the existing
  // `co-local-acfr-gf`, whose 64 pre-existing rows were measured in the live
  // table as general_fund/actual before this load and are unchanged by it — so
  // the 24 new Colorado rows key identically to the rows already there, which
  // is exactly what makes the extension safe rather than a collision.
  'loadCoKsAcfrs.mjs': 'CO+KS local ACFRs — 108 rows, general_fund / actual',
  // ⚠ Knight session 8. `basis` here is `actual` like every other ACFR family —
  // it is the ACTUALS-vs-APPROPRIATION axis, NOT the accounting basis. Brown
  // County's modified-cash fact lives on `audit_grade` (`audited_ocboa`) and in
  // its data_source label, never on this axis. Passing anything else here would
  // change the RPC's lookup key and duplicate the rows on a re-run.
  'loadSdAcfrs.mjs': 'SD local ACFRs (Brown County) — 8 rows, general_fund / actual',
  'loadIndianaGateway.mjs': 'Indiana Gateway AFR — 78 rows, total_governmental/actual',
  // Knight session 6a. A NEW family — South Carolina held only its state node
  // before this load — so the first run inserts and every later run matches on
  // the values written here.
  // ⚠ Like Georgia, the pair is MIXED: `unknown` scope with a real `actual`
  // basis, and the scope is unknown DELIBERATELY rather than pending. RFA drops
  // utility sales REVENUE from the report while keeping utility SPENDING (form
  // line 970, "Public Works (Utility Systems, Public Transit)"), so the two
  // money columns are on different scopes by construction — which is why RFA
  // itself warns the data must not be used to relate revenues to expenditures.
  // If a scope is ever asserted for this family, THIS LOADER MUST CHANGE IN THE
  // SAME COMMIT.
  'loadScRfa.mjs': 'SC RFA Local Government Finance Report — 52 rows, unknown/actual (scope unknown on purpose)',
  'loadFloridaDFS.mjs': 'Florida DFS AFR — 190 rows, total_governmental/actual',
  'loadOhioAOS.js': 'Ohio AOS — 6,616 rows, total_governmental/actual',
  'loadMNOSA.js': 'MN OSA — 21,794 rows, total_governmental/actual',
  'loadCountyBudget.js': 'CA SCO county expenditures + revenues — 2,376 rows, all_funds/actual',
  'loadLACountyOperating.js': 'CA SCO county expenditures — 1,188 rows, all_funds/actual',
  'loadLACountyRevenue.js': 'CA SCO county revenues — 1,188 rows, all_funds/actual',
  'bulkLoadStateController.js': 'CA SCO city expenditures + revenues — 20,904 rows',
  'deriveTotalGovernmental.mjs': 'SCOPE-04 derived rows — 7,650 rows, total_governmental/actual',
};

/** Every file under scripts/ that calls the RPC, with whether it passes the pair. */
function callers() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = path.join(dir, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(mjs|js)$/.test(e)) continue;
      const src = readFileSync(p, 'utf8');
      let i = src.indexOf("rpc('treasury_sync_city_budget'");
      while (i !== -1) {
        // The call's argument object ends at the first `});` after it.
        const end = src.indexOf('});', i);
        const seg = end === -1 ? src.slice(i) : src.slice(i, end);
        out.push({
          file: e,
          rel: path.relative(ROOT, p).replace(/\\/g, '/'),
          hasFundScope: seg.includes('p_fund_scope'),
          hasBasis: seg.includes('p_basis'),
        });
        i = src.indexOf("rpc('treasury_sync_city_budget'", i + 1);
      }
    }
  };
  walk(path.join(ROOT, 'scripts'));
  return out;
}

describe('treasury_sync_city_budget callers pass the axis pair that is in its lookup key', () => {
  const found = callers();

  it('finds the call sites at all, so this guard cannot pass vacuously', () => {
    // A guard that silently stops matching is worse than no guard — the exact
    // failure the Florida verifier made when it printed "Oracle green" after
    // measuring nothing.
    expect(found.length).toBeGreaterThanOrEqual(14);
  });

  it('every caller is either REQUIRED or EXEMPT — no unclassified ones', () => {
    const unclassified = [...new Set(found.map((c) => c.file))]
      .filter((f) => !(f in REQUIRED) && !(f in EXEMPT))
      .sort();
    expect(unclassified, 'a NEW caller of treasury_sync_city_budget appeared. Measure its '
      + "family's fund_scope/basis in the live table, then add it to REQUIRED (pass the "
      + 'values it carries) or EXEMPT (still unknown/unknown) with the measurement.')
      .toEqual([]);
  });

  for (const [file, why] of Object.entries(REQUIRED)) {
    it(`${file} passes p_fund_scope and p_basis — ${why}`, () => {
      const sites = found.filter((c) => c.file === file);
      expect(sites.length, `${file} no longer calls the RPC; update REQUIRED`).toBeGreaterThan(0);
      for (const s of sites) {
        expect(s.hasFundScope, `${s.rel} omits p_fund_scope — a re-run would DUPLICATE`).toBe(true);
        expect(s.hasBasis, `${s.rel} omits p_basis — a re-run would DUPLICATE`).toBe(true);
      }
    });
  }

  for (const [file, why] of Object.entries(EXEMPT)) {
    it(`${file} is exempt and must stay exempt while its family is unstamped — ${why}`, () => {
      const sites = found.filter((c) => c.file === file);
      if (sites.length === 0) return; // file removed; harmless
      for (const s of sites) {
        // ⚠ Passing them here would be the INVERSE defect: the lookup would stop
        // matching rows that really are unknown/unknown, and duplicate anyway.
        expect(s.hasFundScope,
          `${s.rel} now passes p_fund_scope. That is only correct if its family has been `
          + 'stamped — re-measure the live table and move it to REQUIRED.').toBe(false);
      }
    });
  }
});

describe('the sibling RPC is keyed differently, and that is why cron is safe', () => {
  it('documents that treasury_sync_budget_tree has no axis in its key', () => {
    // treasury_sync_budget_tree — 256 call sites, including the Socrata edge
    // functions that run on cron — keys on (municipality, fiscal_year,
    // dataset_type, period_label, data_source) and takes no p_fund_scope at all.
    // Its p_basis is written as COALESCE(p_basis, basis), so a silent caller
    // cannot reset it either. The hazard above is confined to the MANUAL RPC.
    //
    // This test is a docstring with a filename in it: if that function ever
    // gains a fund_scope key, this is where someone should look first.
    const migrations = path.join(ROOT, 'supabase/migrations');
    expect(existsSync(migrations)).toBe(true);
    const keyed = readdirSync(migrations)
      .filter((f) => f.includes('budget_tree_key_on_data_source'));
    expect(keyed.length, 'the migration that put data_source in the budget-tree key is gone')
      .toBeGreaterThan(0);
  });
});

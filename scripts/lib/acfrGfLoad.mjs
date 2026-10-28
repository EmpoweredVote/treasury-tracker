/**
 * Shared loader core for per-entity ACFR General Fund loads.
 * NO SHEBANG — library module under scripts/lib/.
 *
 * Serves four entities across two states, each with a thin driver that supplies
 * an `EntityConfig`:
 *
 *   TX (Oct-Sep fiscal year)   processAustin.js, processTravis.js
 *   CO (calendar fiscal year)  processColoradoSprings.js, processElPasoCounty.js
 *
 * Drives the entity's `scripts/extract<Entity>.py` and writes General Fund
 * `operating` + `revenue` trees through the source-safe
 * `treasury_sync_budget_tree` RPC.
 *
 * -- WHY THE FISCAL CALENDAR IS A REQUIRED CONFIG FIELD ----------------------
 * `state`, `fyEndMonthDay` and `fiscalYearStartMonth` are ASSERTED PRESENT by
 * `assertConfig` rather than defaulted. This file was originally TX-only and
 * hardcoded `09-30` / month 10; leaving those as defaults while adding a
 * calendar-year state would have stamped a September period end and an October
 * start month onto Colorado rows that close December 31 -- the exact defect
 * class `fixAcfrFiscalYearStartMonth.mjs` had to sweep 1,719 rows to undo. A
 * missing field is a loud startup failure instead.
 *
 * Never `treasury_sync_city_budget` — that RPC overwrites existing
 * (muni, fy, dataset) rows and keeps the stale `data_source` label
 * (auto-memory project_sync_city_budget_not_source_safe).
 *
 * ── THE FIVE GUARDS ─────────────────────────────────────────────────────────
 *
 * 1. TIE GATE ($0, never widened). The extractor already exits non-zero on a
 *    non-zero `tie_delta`; this core re-asserts it on the parsed JSON so a
 *    future extractor change that downgrades the exit code cannot slip a
 *    mis-parse through. A tie proves ARITHMETIC ONLY — not labels, not
 *    nesting, not units.
 *
 * 2. FISCAL-YEAR ASSERTION. The extracted `fiscal_year` must equal the year in
 *    the filename, or the year is skipped. This is not belt-and-braces for
 *    Austin: its statement page renders its own period with ciphered digit
 *    glyphs ("September 32, 2222" for September 30, 2024), so the shared
 *    module's priority-1 read fails and it falls through to a
 *    whole-document scan that is documented as able to latch onto a
 *    true-but-unrelated year — exactly how King County FY2024 once loaded as
 *    FY2023.
 *
 * 3. PER-CAPITA PLAUSIBILITY — the ONLY check that can catch a wrong `units`.
 *    `tie_delta` compares a computed sum against a printed total read through
 *    the SAME multiplier, so it is 0 whether or not the scaling is right, and
 *    a wrong `units` ships a silently 1000x-wrong row. The two entities here
 *    genuinely differ (Austin prints "(In thousands)" -> units=1000; Travis
 *    prints whole dollars -> units=1), so this is a live risk in this
 *    milestone rather than a hypothetical one. At FY2024 the true figures are
 *    ~$1,289/capita (Austin) and ~$756/capita (Travis); a 1000x slip lands at
 *    ~$1.3M/capita and is rejected.
 *
 * 4. SANITY CEILING. A per-FY absolute maximum aborts the run rather than
 *    loading an implausible figure from a parse blow-up.
 *
 * 5. IDEMPOTENCE, AND IT KEEPS THE ROW. The ephemeral data_source is NAMED with
 *    the same label the budgets row is stamped with, which is the key
 *    `treasury_sync_budget_tree` reuses an existing row by — so a second run
 *    rewrites the same `budgets.id` in place rather than replacing it. The id
 *    matters: the frozen-figure registry is keyed on it. A post-RPC gate
 *    refuses if a row that existed before comes back under a different id.
 *
 * 6. THE CLASSIFICATION AXES ARE STAMPED FROM THE REGISTRIES, not hardcoded.
 *    `fund_scope` and `basis` are read from `fundScopeRegistry.mjs` and
 *    `basisRegistry.mjs` through the same classifiers the SCOPE-01 and SCOPE-02
 *    sweeps use, so the loader and the sweeps cannot disagree, and an axis
 *    neither registry can classify is LEFT ALONE rather than written `unknown`.
 *    `basis` was missing until 2026-10-28, which is why 139 Alaska rows read
 *    `unknown` while their Texas and Colorado siblings read `actual`.
 *
 * `data_sources` rows are EPHEMERAL: created per dataset_type at the start of a
 * live run and deleted in a `finally` block. `budgets` rows carry the durable
 * text-stamp provenance, so a surviving data_sources row is unreferenceable
 * residue.
 *
 * Every loaded row is stamped with the `source_url` RECORDED BY THE FETCHER in
 * `docs/<entity>/manifest.json` — the URL that actually served the bytes that
 * were parsed, not a URL rebuilt from a naming rule. Travis is why: its
 * filenames switch from `-cafr.pdf` to `-acfr.pdf` at FY2019 and the loader has
 * no business knowing where that boundary falls. `source_date` is the
 * fiscal-year end (September 30) — an honest period end, never a fabricated
 * issue date.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { resolvePython } from './pythonBin.mjs';
import { classify, SCOPE } from './fundScope.mjs';
import { FUND_SCOPE_REGISTRY } from '../data/fundScopeRegistry.mjs';
import { BASIS, BASIS_VALUES, classifyAxis } from './budgetAxes.mjs';
import { BASIS_REGISTRY } from '../data/basisRegistry.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');

/**
 * Absolute per-FY ceiling. The largest General Fund in this cohort is Austin's
 * at ~$1.4B (FY2025); Travis ~$1.1B, Colorado Springs ~$422M, El Paso ~$290M.
 */
const SANITY_MAX = 5_000_000_000;
/** Plausible General Fund dollars per resident per year. */
const PER_CAPITA_MIN = 100;
const PER_CAPITA_MAX = 20_000;

/**
 * Fail before touching the network or the database if a driver omits a field
 * whose wrong value would be SILENT. A missing `state` would resolve the wrong
 * entity (or none); a missing fiscal-calendar field would mislabel the period
 * of every row it writes without changing a single dollar figure.
 */
export function assertConfig(cfg) {
  const required = ['entityLabel', 'muniName', 'entityType', 'state', 'pdfDir', 'filePattern',
    'extractScript', 'datasetIdPrefix', 'baseUrl', 'fys', 'fyEndMonthDay', 'fiscalYearStartMonth'];
  const missing = required.filter((k) => cfg[k] === undefined || cfg[k] === null);
  if (missing.length) throw new Error(`EntityConfig is missing required field(s): ${missing.join(', ')}`);
  if (!/^\d{2}-\d{2}$/.test(cfg.fyEndMonthDay)) {
    throw new Error(`fyEndMonthDay must be "MM-DD", got ${JSON.stringify(cfg.fyEndMonthDay)}`);
  }
  // A calendar fiscal year ends 12-31 and starts in month 1; an Oct-Sep year
  // ends 09-30 and starts in month 10. The two facts must agree, or one of them
  // is a typo that no dollar check downstream can see.
  const endMonth = Number(cfg.fyEndMonthDay.slice(0, 2));
  const expectedStart = (endMonth % 12) + 1;
  if (cfg.fiscalYearStartMonth !== expectedStart) {
    throw new Error(`fiscalYearStartMonth ${cfg.fiscalYearStartMonth} contradicts fyEndMonthDay `
      + `${cfg.fyEndMonthDay} (a year ending in month ${endMonth} starts in month ${expectedStart})`);
  }
  return cfg;
}

export function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* file absent is fine */ }
  }
}

export function supabaseClient() {
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('ERROR: SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1); }
  return createClient(url, key);
}

// ── Extraction ───────────────────────────────────────────────────────────────
/**
 * Run the entity's extractor. spawnSync with an ARGS ARRAY, never a shell
 * string — the PDF path comes from a controlled readdir of docs/<entity>/, but
 * a shell string would make that a latent injection point the moment a path
 * became configurable.
 */
export function extractPDF(cfg, pdfPath, mode) {
  const python = resolvePython();
  const script = path.join(ROOT, cfg.extractScript);
  // `extractArgs` lets one extractor script serve several entities that share a
  // document shape — the Alaska boroughs pass `['--entity', '<key>']`. It
  // defaults to [], so every entity that does not set it invokes the extractor
  // exactly as before. ⚠ Explicit rather than inferred from the PDF filename:
  // an extractor that guessed its own config from a path would silently read
  // one borough's statement with another borough's parents.
  const extra = Array.isArray(cfg.extractArgs) ? cfg.extractArgs : [];
  const r = spawnSync(python, [script, pdfPath, ...extra, '--mode', mode], {
    maxBuffer: 64 * 1024 * 1024, encoding: 'utf8',
  });
  if (r.status !== 0) {
    const tail = (r.stderr || '').trim().split('\n').filter(Boolean).slice(-3).join(' | ');
    return { ok: false, reason: tail || `extractor exit ${r.status}` };
  }
  try { return { ok: true, data: JSON.parse(r.stdout) }; }
  catch { return { ok: false, reason: 'extractor emitted unparseable JSON' }; }
}

/**
 * Map the extractor's nested {n,a,c:[...]} tree to the RPC's
 * {n,a,i:[{d,a,aa,f,e}]} shape.
 *
 *   revenue (flat)      each root child -> one category with a single leaf item.
 *   operating (2-level) a root child WITH `.c` (Current, Debt service) ->
 *                       its children become the drill-down leaf items;
 *                       a root child WITHOUT `.c` (Capital outlay, Austin's
 *                       lease/IT-subscription lines) -> single-item leaf.
 *
 * This is the established contract for a 2-level RPC tree (processTucson.js,
 * processPortland.js, loadFederalAgencies.js).
 *
 * ⚠⚠ IT REFUSES A THIRD LEVEL RATHER THAN DROPPING IT. The emitted shape is
 * category -> items and nothing deeper, so a grandchild has nowhere to go; the
 * mapping below would have published the SUB-GROUP as the item and discarded
 * every leaf beneath it, silently. Nothing downstream could see that: the
 * amounts roll up, so the total, the tie and `assertProjection` all stay green
 * — the same defect `toRpcTree` in loadScCityAcfrs.mjs carried until it was
 * fixed, and the same lesson, that a gate upstream of a transformation cannot
 * see that transformation's defects.
 *
 * It became REACHABLE when `acfrGfCoords` learned to read as many levels as the
 * issuer prints (Summerville SC prints `Current:` > `General Government:` >
 * `Administrative`). A loader that WANTS to flatten such a tree onto this shape
 * already has `toBudgetTree3` (loadS8Acfrs.mjs / loadSdAcfrs.mjs), which keeps
 * the top function as the category and lifts every descendant leaf into it, and
 * checks the projection arithmetically. That is a deliberate choice a loader
 * makes; this function must not make it by accident.
 */
export function toBudgetTree(extractorTree, mode) {
  const rootChildren = extractorTree?.c || [];
  for (const child of rootChildren) {
    const deep = (child.c || []).filter((gc) => Array.isArray(gc.c) && gc.c.length);
    if (deep.length) {
      throw new Error(
        `toBudgetTree cannot map three levels: "${child.n}" > "${deep[0].n}" has `
        + `${deep[0].c.length} child(ren) of its own, which this 2-level RPC shape `
        + 'would drop silently. Use toBudgetTree3 if flattening is intended.',
      );
    }
  }
  const single = (child) => ({
    n: child.n, a: child.a,
    i: [{ d: child.n, a: child.a, aa: null, f: null, e: null }],
  });
  const mapped = mode === 'revenue'
    ? rootChildren.map(single)
    : rootChildren.map((child) => (Array.isArray(child.c) && child.c.length
      ? { n: child.n, a: child.a, i: child.c.map((gc) => ({ d: gc.n, a: gc.a, aa: null, f: null, e: null })) }
      : single(child)));
  return {
    tree: mapped,
    total: mapped.reduce((s, n) => s + n.a, 0),
    rowCount: mapped.reduce((s, n) => s + n.i.length, 0),
  };
}

// ── Provenance manifest (written by scripts/fetchAustinTravis.mjs) ───────────
export function readManifest(cfg) {
  const p = path.join(ROOT, cfg.pdfDir, 'manifest.json');
  if (!existsSync(p)) {
    console.error(`ERROR: ${p} missing — run ${cfg.fetchScript ?? 'the entity fetcher'} first.`);
    console.error('       Refusing to load without the URL that served each parsed file.');
    process.exit(2);
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function discoverPdfsByFY(cfg) {
  const dir = path.join(ROOT, cfg.pdfDir);
  const map = new Map();
  for (const f of readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.pdf'))) {
    const m = cfg.filePattern.exec(f);
    if (m) map.set(Number(m[1]), path.join(dir, f));
  }
  return map;
}

// ── Municipality resolution ──────────────────────────────────────────────────
export async function ensureMunicipality(supabase, cfg) {
  const { data, error } = await supabase.schema('treasury').from('municipalities')
    .select('id, name, population')
    .eq('name', cfg.muniName).eq('state', cfg.state).eq('entity_type', cfg.entityType)
    .maybeSingle();
  if (error) { console.error(`  ERROR resolving ${cfg.muniName}:`, error.message); process.exit(2); }
  if (!data?.id) {
    console.error(`  ${cfg.muniName}, ${cfg.state} (entity_type=${cfg.entityType}) not found `
      + `— run ${cfg.seedScript ?? 'the entity seeder'} first`);
    process.exit(2);
  }
  if (!data.population) {
    console.error(`  ${cfg.muniName} has no population — the per-capita units guard cannot run. Refusing to load.`);
    process.exit(2);
  }
  console.log(`  Entity: ${data.name}, ${cfg.state} (${data.id}) pop ${data.population.toLocaleString()}`);
  return data;
}

// ── Ephemeral data_sources lifecycle ─────────────────────────────────────────

/**
 * The ephemeral `data_sources` row for ONE entity-year-mode.
 *
 * ── ⚠⚠ `name` IS THE ROW-REUSE KEY. IT IS NOT A CAPTION ──────────────────
 *
 * `treasury_sync_budget_tree` reuses an existing budgets row rather than
 * inserting a second one, and it finds that row by `data_source = v_ds.name` —
 * the name of THIS row. So this string has to be byte-identical to the label
 * `loadFiscalYear` stamps onto `budgets.data_source`, or the RPC can never
 * match on a second run.
 *
 * It used to read `"<entity> General Fund <Kind> Budget"` while the stamp wrote
 * `"<entity> ACFR — General Fund <Kind> (FY<n> actual, GAAP basis)"`. Two
 * different strings, so every reload took the RPC's INSERT branch and MINTED A
 * NEW `budgets.id` for a row whose figures had not moved — breaking the
 * frozen-figure registry, which is keyed on that id. Found 2026-10-28 by
 * re-running Kodiak Island Borough as an idempotence test.
 *
 * ⭐ `tests/acfrGfLoadReuse.test.mjs` pins the equality, because a future edit
 * to `dataSourceLabel` could easily change one side only.
 *
 * ⚠ The label names ONE fiscal year, so this row covers one fiscal year and
 * `dataset_id` carries the year too — `treasury.data_sources` is UNIQUE on
 * (municipality_id, api_type, coalesce(dataset_id,''), dataset_type), and a
 * shared dataset_id would collide on the second year of the same run.
 */
export function ephemeralDataSourcePayload(cfg, muniId, datasetType, fy) {
  return {
    name: dataSourceLabel(cfg, fy, datasetType),
    api_type: 'pdf_download',
    dataset_type: datasetType,
    dataset_id: `${cfg.datasetIdPrefix}-${datasetType}-${fy}`,
    base_url: cfg.baseUrl,
    fiscal_years: [fy],
    municipality_id: muniId,
    // The RPC propagates v_ds.fiscal_year_start_month into treasury.budgets
    // (migration 20260613120000), and the budgets stamp below sets it again
    // directly so the value does not depend on that propagation still holding.
    // Both Texas entities run October 1 - September 30 (month 10, same as the
    // Oct-Sep state ACFR loaders processALAcfr.js / processMIAcfr.js); both
    // Colorado entities run the calendar year (month 1). Leaving the column at
    // its default 1 for a TX entity would assert a CALENDAR-year period for a
    // fiscal year that ends in September, so this is config, never a default.
    fiscal_year_start_month: cfg.fiscalYearStartMonth,
  };
}

export async function createEphemeralDataSource(supabase, cfg, muniId, datasetType, fy) {
  const payload = ephemeralDataSourcePayload(cfg, muniId, datasetType, fy);
  await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', payload.dataset_id);
  const { data, error } = await supabase.schema('treasury').from('data_sources').insert(payload).select().single();
  if (error) { console.error('  data_source insert failed:', error.message); process.exit(2); }
  return data;
}

export async function deleteEphemeralDataSource(supabase, dsId) {
  const { error } = await supabase.schema('treasury').from('data_sources').delete().eq('id', dsId);
  if (error) console.error('  WARNING: ephemeral data_source cleanup failed:', error.message);
}

export function dataSourceLabel(cfg, fy, datasetType) {
  const kind = datasetType === 'revenue' ? 'Revenue by Source' : 'Expenditure by Function';
  return `${cfg.entityLabel} ACFR — General Fund ${kind} (FY${fy} actual, GAAP basis)`;
}

/**
 * The `fund_scope` this loader must stamp for a given `data_source` label.
 *
 * ── ⚠⚠ WHY THE LOADER STAMPS SCOPE AT ALL ─────────────────────────────────
 *
 * `loadFiscalYear` used to DELETE the (municipality, fiscal_year, dataset_type)
 * row and let the RPC insert a replacement, which arrived at the column
 * DEFAULT — `unknown`. Before this function existed, re-running a load that
 * SCOPE-01 had already classified silently threw the classification away: same
 * row count, same totals, nothing failing, and the table quietly disagreeing
 * with the registry. Found 2026-10-28 by re-running Kodiak Island Borough as an
 * idempotence test.
 *
 * ⚠ That delete is gone now and the row is reused in place, so the RPC no
 * longer resets the column. This stamp STAYS regardless: it is what keeps the
 * loader and the SCOPE-01 sweep writing the same value, and it is still the
 * only thing that classifies a brand-new row, which really does insert at
 * `unknown`.
 *
 * ⚠ This is NOT a second authority on scope. It calls the SAME `classify()`
 * against the SAME registry that `scripts/classifyFundScope.mjs` uses, so the
 * loader writes precisely what the sweep would write and a reload cannot make
 * the two disagree. `tests/acfrGfLoadScope.test.mjs` pins that equality.
 *
 * ⭐ The evidence gate is inherited, not re-implemented: `classify()` returns
 * `unknown` for an entry whose `evidence` is missing or a placeholder, so an
 * unevidenced claim cannot reach the database through this path any more than
 * through the sweep. A genuinely new source therefore lands `unknown` until it
 * is evidenced, which is the correct failure direction.
 *
 * ⚠ `loadCoKsAcfrs.mjs` has always passed `fund_scope` at write time and so
 * never had this defect; it hardcodes `general_fund` rather than consulting the
 * registry. This is the same idea done from the single source of truth.
 */
export function scopeForDataSource(label, registry = FUND_SCOPE_REGISTRY) {
  const { scope } = classify(label, registry);
  return scope ?? SCOPE.UNKNOWN;
}

/**
 * The `basis` this loader must stamp for a given `data_source` label — the
 * SCOPE-02 twin of `scopeForDataSource` above, and classified the same way.
 *
 * ── ⚠⚠ WHY IT TOOK A SECOND DEFECT TO ADD THIS ────────────────────────────
 *
 * The loader stamped `fund_scope` and nothing else, so `basis` arrived at the
 * RPC's `COALESCE(p_basis, 'unknown')` and stayed there. The 139 Alaska rows
 * read `unknown` while the 98 rows of the Texas and Colorado families — loaded
 * by THIS module, from the same statement of the same kind of document — read
 * `actual`; every Alaska row carries the word "actual" in its own data_source
 * string. Found 2026-10-28 while fixing the row-id churn next door.
 *
 * ⚠ The cause was not here. It was that `ak-local-acfr-gf` went into
 * `fundScopeRegistry.mjs` when the family loaded and into no sibling registry,
 * so `scripts/stampBudgetAxes.mjs` could not have fixed it either — the sweep
 * had no entry to claim those rows with. The registry entry is the fix; this
 * function is what keeps a reload from undoing it.
 *
 * ⚠ Like its scope twin this is NOT a second authority: it calls the same
 * `classifyAxis()` against the same `BASIS_REGISTRY` the sweep uses, and
 * inherits the evidence gate rather than re-implementing it — an entry whose
 * evidence is missing or a placeholder classifies as `unknown`. `actual` is a
 * public claim that a figure is a closed-year result, so an unevidenced claim
 * must not reach the database through this path.
 */
export function basisForDataSource(label, registry = BASIS_REGISTRY) {
  return classifyAxis(label, registry, BASIS_VALUES, BASIS.UNKNOWN).value;
}

/**
 * The classification columns to stamp for `label`, as a PATCH to spread into
 * the update — never a full row.
 *
 * ⚠⚠ AN UNKNOWN IS OMITTED, NEVER WRITTEN. A column this loader cannot
 * classify may already hold a value some other pass put there, and sending a
 * literal `unknown` would overwrite it. That is precisely PR #300's defect —
 * a reload silently downgrading an evidenced row — and there is no reason to
 * reproduce it on a second axis now that there are two. The sweeps write only
 * the rows an entry CLAIMS; this does the same, from the same registries.
 *
 * ⚠ Omitting is also harmless for a genuinely new row: the RPC inserts both
 * columns at the table default, which is `unknown` either way. The only
 * behaviour this changes is the destructive one.
 */
export function axisStampFor(label, scopeRegistry = FUND_SCOPE_REGISTRY, basisRegistry = BASIS_REGISTRY) {
  const patch = {};
  const scope = scopeForDataSource(label, scopeRegistry);
  if (scope !== SCOPE.UNKNOWN) patch.fund_scope = scope;
  const basis = basisForDataSource(label, basisRegistry);
  if (basis !== BASIS.UNKNOWN) patch.basis = basis;
  return patch;
}

// ── One fiscal year ──────────────────────────────────────────────────────────
async function loadFiscalYear(supabase, cfg, muniId, dsId, fy, datasetType, tree, total, rowCount, sourceUrl) {
  const label = dataSourceLabel(cfg, fy, datasetType);

  // ── ⚠⚠ READ THE ID FIRST, SO THE REUSE CAN BE PROVED AFTERWARDS ──────────
  //
  // This is the whole point of the change. `treasury_sync_budget_tree` reuses
  // the row it finds at (municipality, fiscal_year, dataset_type, period_label,
  // data_source = the ephemeral source's NAME) and inserts only when it finds
  // none — so naming that source with this exact label is what makes a reload
  // land on the same `budgets.id`. The assertion below turns that from an
  // intention into something the run checks.
  //
  // ⚠ There used to be a blind DELETE on (municipality_id, fiscal_year,
  // dataset_type) here, which guaranteed the RPC never found anything and so
  // guaranteed a new uuid every run. It was also wider than this loader's own
  // data: that key carries no fund_scope, and treasury.budgets legitimately
  // holds two scopes under one such key — New York City publishes a General
  // Fund AND a Total Governmental Funds series for the same 24 entity-years.
  // Nothing in this family shares a key with those 48 rows, but a config one
  // line different would have deleted them.
  const { data: before, error: beforeErr } = await supabase.schema('treasury').from('budgets')
    .select('id').eq('municipality_id', muniId).eq('fiscal_year', fy)
    .eq('dataset_type', datasetType).eq('data_source', label).maybeSingle();
  if (beforeErr) { console.error('    Pre-load lookup failed:', beforeErr.message); return false; }
  const priorId = before?.id ?? null;

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: dsId,
    p_fiscal_year: fy,
    p_dataset_type: datasetType,
    p_total: total,
    p_tree: tree,
    p_row_count: rowCount,
    p_triggered_by: 'bulk_load',
  });
  if (rpcErr) { console.error('    RPC error:', rpcErr.message); return false; }
  if (rpc?.error) { console.error('    RPC error (returned):', rpc.error); return false; }

  const budgetId = rpc?.budget_id;
  if (!budgetId) {
    console.error('    RPC returned no budget_id — nothing to stamp:', JSON.stringify(rpc));
    return false;
  }

  // ⭐ THE CHURN GATE. A row that already existed must come back with the SAME
  // id. If it does not, the RPC took its INSERT branch and there are now two
  // rows where there was one — so refuse here rather than stamp the new one and
  // leave the old behind. The frozen-figure registry is keyed on this id.
  if (priorId && budgetId !== priorId) {
    console.error(`    REFUSING: FY${fy} ${datasetType} already existed as ${priorId} but the RPC `
      + `returned ${budgetId}. The row was REPLACED, not reloaded — the data_source name on the `
      + 'ephemeral source no longer matches the label this loader stamps.');
    return false;
  }

  // ⚠⚠ `fund_scope` AND `basis` are stamped HERE, with the same label the
  // registries match on. The RPC inserts both at the column default
  // (`unknown`), so without this a re-load silently downgrades an
  // already-classified row. See `scopeForDataSource` and `basisForDataSource`
  // for why the loader is not a second authority on either, and `axisStampFor`
  // for why an axis it cannot classify is OMITTED rather than written.
  const axes = axisStampFor(label);
  const { error: stampErr } = await supabase.schema('treasury').from('budgets').update({
    source_url: sourceUrl,
    source_date: `${fy}-${cfg.fyEndMonthDay}`,
    data_source: label,
    fiscal_year_start_month: cfg.fiscalYearStartMonth,
    ...axes,
  }).eq('id', budgetId);
  if (stampErr) { console.error('    Source stamp failed:', stampErr.message); return false; }
  const axisLog = ['fund_scope', 'basis']
    .map((k) => `${k}=${axes[k] ?? 'unknown (left as it stood)'}`).join(', ');
  console.log(`    ${priorId ? 'Reused' : 'Created'} budget ${budgetId}; ${rpc?.rows_inserted ?? '?'} line items; `
    + `stamped source_date=${fy}-${cfg.fyEndMonthDay}, ${axisLog}`);
  return true;
}

// ── One mode across the FY window ────────────────────────────────────────────
export async function processMode(supabase, cfg, muni, { dryRun, mode, targetFY }) {
  const datasetType = mode === 'revenue' ? 'revenue' : 'operating';
  const manifest = readManifest(cfg);
  const pdfs = discoverPdfsByFY(cfg);
  const years = (targetFY ? [targetFY] : cfg.fys).filter((fy) => {
    if (!pdfs.has(fy)) { console.log(`  FY${fy}: no PDF in ${cfg.pdfDir} — skipped`); return false; }
    return true;
  });

  console.log(`\n-- ${cfg.entityLabel} ${datasetType}: ${years.length} fiscal year(s)${dryRun ? ' [DRY RUN]' : ''}`);

  // Extract and validate EVERYTHING before writing anything, so a bad year
  // fails the run before any partial state reaches the database.
  const staged = [];
  for (const fy of years) {
    const pdfPath = pdfs.get(fy);
    const ex = extractPDF(cfg, pdfPath, mode);
    if (!ex.ok) { console.error(`  FY${fy}: EXTRACT FAILED — ${ex.reason}`); return { ok: false, loaded: 0 }; }
    const d = ex.data;

    // ⚠⚠ THE GATE IS $0, WITH ONE NARROW EXCEPTION THE EXTRACTOR MUST HAVE
    // DECIDED FIRST. `source_rounding` is an EXACT per-(fiscal_year, mode)
    // delta registry for city-years where the ISSUER'S OWN printed total
    // disagrees with the sum of its OWN printed components — Fairbanks North
    // Star Borough's statements are off by $1–$2, and that borough's own
    // `Excess (deficiency)` row agrees with the component sum rather than with
    // its printed total.
    //
    // The extractor owns that decision: it sets `source_rounding_accepted` only
    // when a registered delta matches tie_delta EXACTLY, and leaves it null
    // otherwise. This loader re-checks the equality rather than trusting the
    // flag alone, so a malformed extractor payload cannot widen the gate.
    //
    // ⚠ This is NOT a tolerance. An unregistered delta of $1 still refuses, and
    // the loaded tree total is always the COMPONENT SUM, so every stored row
    // still ties against its own line items.
    const roundingOk = d.source_rounding_accepted !== null
      && d.source_rounding_accepted !== undefined
      && d.source_rounding_accepted === d.tie_delta;
    if (d.tie_delta !== 0 && !roundingOk) {
      console.error(`  FY${fy}: tie_delta ${d.tie_delta} — refusing (gate is $0)`);
      return { ok: false, loaded: 0 };
    }
    if (roundingOk) {
      console.log(`  FY${fy}: source rounding ${d.tie_delta > 0 ? '+' : ''}${d.tie_delta} accepted `
        + '(issuer total disagrees with its own components; tree total is the component sum)');
    }
    if (d.fiscal_year !== fy) {
      console.error(`  FY${fy}: extractor parsed fiscal_year=${d.fiscal_year} — filename/statement disagree, refusing`);
      return { ok: false, loaded: 0 };
    }

    const { tree, total, rowCount } = toBudgetTree(d.tree, mode);
    if (total !== d.computed_total) {
      console.error(`  FY${fy}: mapped tree total ${total} != extractor computed_total ${d.computed_total}`);
      return { ok: false, loaded: 0 };
    }
    if (total <= 0 || total > SANITY_MAX) {
      console.error(`  FY${fy}: total ${total} outside (0, ${SANITY_MAX}] — refusing`);
      return { ok: false, loaded: 0 };
    }
    const perCapita = total / muni.population;
    if (perCapita < PER_CAPITA_MIN || perCapita > PER_CAPITA_MAX) {
      console.error(`  FY${fy}: $${perCapita.toFixed(0)}/capita outside [${PER_CAPITA_MIN}, ${PER_CAPITA_MAX}] `
        + '— this is the UNITS guard (the tie gate cannot see a 1000x error). Refusing.');
      return { ok: false, loaded: 0 };
    }

    const entry = manifest[fy] || manifest[String(fy)];
    if (!entry?.url) {
      console.error(`  FY${fy}: no source URL in ${cfg.pdfDir}/manifest.json — refusing to load an unattributed row`);
      return { ok: false, loaded: 0 };
    }

    staged.push({ fy, tree, total, rowCount, url: entry.url, categories: tree.length });
    console.log(`  FY${fy}: $${(total / 1e6).toFixed(1)}M  ${tree.length} categories / ${rowCount} items  `
      + `$${perCapita.toFixed(0)}/capita  tie $0`);
  }

  if (dryRun) {
    console.log(`  [DRY RUN] ${staged.length} year(s) validated, nothing written.`);
    return { ok: true, loaded: 0, staged: staged.length };
  }
  if (!staged.length) return { ok: true, loaded: 0 };

  // ⚠ ONE ephemeral data_source PER FISCAL YEAR, because its `name` is now the
  // key the RPC reuses a budgets row by and that label names a single year. The
  // `finally` keeps the per-year cleanup guarantee the per-mode version had.
  let loaded = 0;
  for (const s of staged) {
    console.log(`  FY${s.fy} -> ${datasetType}`);
    const ds = await createEphemeralDataSource(supabase, cfg, muni.id, datasetType, s.fy);
    let ok = false;
    try {
      ok = await loadFiscalYear(supabase, cfg, muni.id, ds.id, s.fy, datasetType,
        s.tree, s.total, s.rowCount, s.url);
    } finally {
      await deleteEphemeralDataSource(supabase, ds.id);
    }
    if (!ok) return { ok: false, loaded };
    loaded++;
  }
  return { ok: true, loaded };
}

// ── Driver entry point ───────────────────────────────────────────────────────
export async function run(cfg) {
  assertConfig(cfg);
  loadEnv();
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  // ⚠ A CONFIG VALUE WINS OVER argv, and only when the driver supplies one.
  // Every existing driver passes none of these, so they keep reading the CLI
  // exactly as before. The Alaska boroughs need it because their two modes have
  // DIFFERENT year windows — Fairbanks FY2018 revenue is a declared document
  // gap while FY2018 operating loads — which one shared `fys` list cannot
  // express, so that driver calls run() once per mode.
  const dryRun = cfg.dryRun !== undefined ? Boolean(cfg.dryRun) : argv.includes('--dry-run');
  const targetFY = cfg.targetFY !== undefined && cfg.targetFY !== null
    ? Number(cfg.targetFY)
    : (arg('--fy') ? Number(arg('--fy')) : null);
  const modeArg = arg('--mode');
  const modes = cfg.mode ? [cfg.mode] : (modeArg ? [modeArg] : ['revenue', 'operating']);

  console.log(`=== ${cfg.entityLabel} — General Fund ACFR load${dryRun ? ' [DRY RUN]' : ''}`);
  const supabase = supabaseClient();
  const muni = await ensureMunicipality(supabase, cfg);

  let total = 0;
  for (const mode of modes) {
    const r = await processMode(supabase, cfg, muni, { dryRun, mode, targetFY });
    if (!r.ok) { console.error(`\nFAILED during ${mode}. ${total} row(s) loaded before the failure.`); process.exit(1); }
    total += r.loaded;
  }
  console.log(`\n${cfg.entityLabel}: ${total} budgets row(s) loaded.`);
  // Returned so a driver that calls run() more than once — the Alaska boroughs
  // call it per entity AND per mode — can report a real cohort total instead of
  // printing a confident zero.
  return total;
}

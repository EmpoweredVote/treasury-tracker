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
 * 5. IDEMPOTENCE. A pre-load delete on (municipality_id, fiscal_year,
 *    dataset_type) precedes each RPC call, and the RPC itself upserts on the
 *    same key, so a second full run nets zero row-count change.
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
  const r = spawnSync(python, [script, pdfPath, '--mode', mode], {
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
export async function createEphemeralDataSource(supabase, cfg, muniId, datasetType, fys) {
  const datasetId = `${cfg.datasetIdPrefix}-${datasetType}`;
  const kind = datasetType === 'revenue' ? 'Revenue' : 'Operating';
  const payload = {
    name: `${cfg.entityLabel} General Fund ${kind} Budget`,
    api_type: 'pdf_download',
    dataset_type: datasetType,
    dataset_id: datasetId,
    base_url: cfg.baseUrl,
    fiscal_years: fys,
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
  await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', datasetId);
  const { data, error } = await supabase.schema('treasury').from('data_sources').insert(payload).select().single();
  if (error) { console.error('  data_source insert failed:', error.message); process.exit(2); }
  console.log(`  data_source created (ephemeral): ${data.id} [${datasetId}]`);
  return data;
}

export async function deleteEphemeralDataSource(supabase, dsId) {
  const { error } = await supabase.schema('treasury').from('data_sources').delete().eq('id', dsId);
  if (error) console.error('  WARNING: ephemeral data_source cleanup failed:', error.message);
}

function dataSourceLabel(cfg, fy, datasetType) {
  const kind = datasetType === 'revenue' ? 'Revenue by Source' : 'Expenditure by Function';
  return `${cfg.entityLabel} ACFR — General Fund ${kind} (FY${fy} actual, GAAP basis)`;
}

// ── One fiscal year ──────────────────────────────────────────────────────────
async function loadFiscalYear(supabase, cfg, muniId, dsId, fy, datasetType, tree, total, rowCount, sourceUrl) {
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete().eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', datasetType);
  if (delErr) { console.error('    Pre-load delete failed:', delErr.message); return false; }

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

  const { data: bud, error: budErr } = await supabase.schema('treasury').from('budgets')
    .select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', datasetType).maybeSingle();
  if (budErr || !bud?.id) {
    console.error('    Could not find budget row to stamp source:', budErr?.message ?? '(no row)');
    return false;
  }
  const { error: stampErr } = await supabase.schema('treasury').from('budgets').update({
    source_url: sourceUrl,
    source_date: `${fy}-${cfg.fyEndMonthDay}`,
    data_source: dataSourceLabel(cfg, fy, datasetType),
    fiscal_year_start_month: cfg.fiscalYearStartMonth,
  }).eq('id', bud.id);
  if (stampErr) { console.error('    Source stamp failed:', stampErr.message); return false; }
  console.log(`    Inserted ${rpc?.rows_inserted ?? '?'} line items; stamped source_date=${fy}-${cfg.fyEndMonthDay}`);
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

    if (d.tie_delta !== 0) { console.error(`  FY${fy}: tie_delta ${d.tie_delta} — refusing (gate is $0)`); return { ok: false, loaded: 0 }; }
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

  const ds = await createEphemeralDataSource(supabase, cfg, muni.id, datasetType, staged.map((s) => s.fy));
  let loaded = 0;
  try {
    for (const s of staged) {
      console.log(`  FY${s.fy} -> ${datasetType}`);
      const ok = await loadFiscalYear(supabase, cfg, muni.id, ds.id, s.fy, datasetType,
        s.tree, s.total, s.rowCount, s.url);
      if (!ok) return { ok: false, loaded };
      loaded++;
    }
  } finally {
    await deleteEphemeralDataSource(supabase, ds.id);
  }
  return { ok: true, loaded };
}

// ── Driver entry point ───────────────────────────────────────────────────────
export async function run(cfg) {
  assertConfig(cfg);
  loadEnv();
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const dryRun = argv.includes('--dry-run');
  const targetFY = arg('--fy') ? Number(arg('--fy')) : null;
  const modeArg = arg('--mode');
  const modes = modeArg ? [modeArg] : ['revenue', 'operating'];

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
}

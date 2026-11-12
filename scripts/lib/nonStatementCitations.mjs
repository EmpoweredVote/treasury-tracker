/**
 * Give a payment or payroll register the link a reader needs.
 *
 * NO SHEBANG — a test imports this module, and a `#!` in scripts/lib/ breaks
 * the Vite transform on a CRLF checkout (see tests/waSao.test.mjs).
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * `salaries` and `transactions` rows are not financial statements, so
 * `stampNotApplicableGrade.mjs` answers their audit grade from `dataset_type`
 * rather than from a registry entry. That is right, and it is also the whole
 * reason the link was missed: the axis work that gave other families their
 * provenance never had a reason to look at these.
 *
 * Measured 2026-11-12: **33 of 43 `transactions` rows carried no `source_url`**
 * while every one of their `treasury.data_sources` rows held a real publisher
 * address. The citation existed the whole time and simply was not copied onto
 * the row a reader actually sees.
 *
 * ⚠⚠ THE SHAPE IS DERIVED FROM `api_type`, NEVER GUESSED. West Hollywood's ten
 * rows already carry the Socrata convention (`https://data.weho.org/d/jaed-p39k`,
 * written by #383), so this reproduces that exact spelling rather than inventing
 * a second one for the same idea. A second vocabulary is a second thing to learn
 * and a second thing to drift.
 *
 * ⚠ AN ALLOW-LIST OF `api_type`, NEVER A FALLBACK. An unknown api_type returns
 * null and is REPORTED. Written the other way round — "anything else, just use
 * base_url" — a future portal API whose base_url is a host root would publish
 * `https://data.example.gov` as a citation for one dataset among thousands.
 * #381/#385 settled that a landing page is not a weaker citation but a wrong one.
 */

/** api_types whose `base_url` IS the document, not a page about it. */
const DIRECT_DOCUMENT = new Set(['xlsx_download', 'csv_download', 'file_download']);

/** api_types that address a dataset as `<base_url>/d/<dataset_id>`. */
const SOCRATA_LIKE = new Set(['socrata']);

const blank = (v) => typeof v !== 'string' || v.trim() === '';

/**
 * The URL to cite for one `treasury.data_sources` row, or null if none can be
 * derived honestly.
 *
 * @param {{api_type?: string, base_url?: string, dataset_id?: string|null}|null} source
 * @returns {string|null}
 */
export function citationUrlFor(source) {
  if (!source || blank(source.base_url)) return null;
  const base = source.base_url.trim();
  const apiType = typeof source.api_type === 'string' ? source.api_type.trim() : '';

  if (SOCRATA_LIKE.has(apiType)) {
    // ⚠ Without a dataset_id the only thing left is the PORTAL ROOT, which
    // names a catalogue rather than this register. Refuse instead.
    if (blank(source.dataset_id)) return null;
    return `${base.replace(/\/+$/, '')}/d/${source.dataset_id.trim()}`;
  }

  if (DIRECT_DOCUMENT.has(apiType)) return base;

  return null;
}

/**
 * Decide what to write, what is already cited, and what cannot be resolved.
 *
 * Pure — no I/O — so the rule is unit-testable and lives in exactly one place.
 *
 * @param {Array<{id: string, data_source: string, source_url?: string|null}>} rows
 * @param {Array<{name: string, api_type?: string, base_url?: string, dataset_id?: string|null}>} sources
 */
export function planCitations(rows, sources) {
  const byName = new Map();
  for (const s of sources ?? []) if (s?.name) byName.set(s.name, s);

  const writes = []; const unresolvable = []; let alreadyCited = 0;

  for (const row of rows ?? []) {
    // ⚠ '' and '   ' are LINKLESS to the provenance gate, so they must be
    // linkless here too. Counting them as cited would report success while the
    // debt sat exactly where it was.
    if (!blank(row?.source_url)) { alreadyCited += 1; continue; }

    const source = byName.get(row.data_source);
    if (!source) {
      unresolvable.push({
        id: row.id, data_source: row.data_source,
        why: `no data_sources row named "${row.data_source}"`,
      });
      continue;
    }

    const url = citationUrlFor(source);
    if (!url) {
      unresolvable.push({
        id: row.id, data_source: row.data_source,
        why: `no citable URL for api_type "${source.api_type ?? ''}"`,
      });
      continue;
    }
    writes.push({ id: row.id, data_source: row.data_source, url });
  }

  return { writes, unresolvable, alreadyCited };
}

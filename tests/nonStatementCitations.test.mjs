/**
 * Citing a record that is NOT a financial statement.
 *
 * `salaries` and `transactions` rows are payment and payroll registers. They
 * are not audited statements, which is why `stampNotApplicableGrade.mjs` answers
 * their audit grade from `dataset_type` rather than from a registry entry.
 *
 * But "the audit question does not apply" is not the same as "a reader does not
 * need a link". Measured 2026-11-12: 33 of 43 `transactions` rows carried NO
 * `source_url` while every one of their `treasury.data_sources` rows held a real
 * publisher address — so the link existed and simply was not copied across.
 *
 * ⚠⚠ THE URL IS DERIVED FROM `api_type`, NEVER FROM A GUESS AT THE SHAPE.
 * West Hollywood's ten rows already demonstrate the Socrata convention
 * (`https://data.weho.org/d/jaed-p39k`), and the derivation here reproduces it
 * exactly rather than inventing a second spelling for the same idea.
 */
import { describe, it, expect } from 'vitest';
import { citationUrlFor, planCitations } from '../scripts/lib/nonStatementCitations.mjs';

describe('citationUrlFor', () => {
  it('builds the Socrata dataset page from base_url and dataset_id', () => {
    // The exact shape already stored on West Hollywood's rows.
    expect(citationUrlFor({
      api_type: 'socrata',
      base_url: 'https://data.weho.org',
      dataset_id: 'jaed-p39k',
    })).toBe('https://data.weho.org/d/jaed-p39k');
  });

  it('does not double the slash when base_url has a trailing one', () => {
    expect(citationUrlFor({
      api_type: 'socrata',
      base_url: 'https://data.weho.org/',
      dataset_id: 'cz69-a684',
    })).toBe('https://data.weho.org/d/cz69-a684');
  });

  it('uses base_url verbatim for a direct download, which IS the document', () => {
    // Plano's base_url is the export endpoint itself, not a landing page.
    const url = 'https://checkregister.plano.gov/ReportExport.aspx?ET=AP&Detail=T&SD=9/30/2025&ED=10/1/2026';
    expect(citationUrlFor({ api_type: 'xlsx_download', base_url: url, dataset_id: 'fy2026' }))
      .toBe(url);
  });

  it('refuses a Socrata source with no dataset_id rather than citing the host root', () => {
    // ⚠ `https://data.weho.org` alone is a PORTAL, not this dataset. #381/#385
    // settled that a landing page is not a weaker citation but a wrong one.
    expect(citationUrlFor({
      api_type: 'socrata', base_url: 'https://data.weho.org', dataset_id: null,
    })).toBeNull();
  });

  it('refuses an api_type it does not know, rather than guessing', () => {
    expect(citationUrlFor({
      api_type: 'some_future_api', base_url: 'https://example.gov', dataset_id: 'x',
    })).toBeNull();
  });

  it('refuses a blank or missing base_url', () => {
    expect(citationUrlFor({ api_type: 'socrata', base_url: '   ', dataset_id: 'x' })).toBeNull();
    expect(citationUrlFor({ api_type: 'xlsx_download' })).toBeNull();
    expect(citationUrlFor(null)).toBeNull();
  });
});

describe('planCitations', () => {
  const sources = [
    { name: 'A Register FY2025', api_type: 'socrata', base_url: 'https://d.gov', dataset_id: 'aa-bb' },
    { name: 'B Register FY2025', api_type: 'xlsx_download', base_url: 'https://b.gov/f.xlsx', dataset_id: 'fy2025' },
    { name: 'C Register FY2025', api_type: 'mystery', base_url: 'https://c.gov', dataset_id: null },
  ];

  it('plans a write only for a row that has no link yet', () => {
    const plan = planCitations(
      [
        { id: '1', data_source: 'A Register FY2025', source_url: null },
        { id: '2', data_source: 'B Register FY2025', source_url: 'https://already.example/doc' },
      ],
      sources,
    );
    expect(plan.writes).toEqual([{ id: '1', data_source: 'A Register FY2025', url: 'https://d.gov/d/aa-bb' }]);
    expect(plan.alreadyCited).toBe(1);
  });

  it('reports a row whose source cannot yield a URL instead of silently skipping it', () => {
    // ⚠ Silence here would read as "nothing to do" when the truth is "this one
    // still has no citation and nobody was told".
    const plan = planCitations([{ id: '3', data_source: 'C Register FY2025', source_url: null }], sources);
    expect(plan.writes).toEqual([]);
    expect(plan.unresolvable).toEqual([
      { id: '3', data_source: 'C Register FY2025', why: 'no citable URL for api_type "mystery"' },
    ]);
  });

  it('reports a row whose data_source has no entry in data_sources at all', () => {
    const plan = planCitations([{ id: '4', data_source: 'Ghost Register FY2025', source_url: null }], sources);
    expect(plan.writes).toEqual([]);
    expect(plan.unresolvable).toEqual([
      { id: '4', data_source: 'Ghost Register FY2025', why: 'no data_sources row named "Ghost Register FY2025"' },
    ]);
  });

  it('gives every row of a multi-year family the same dataset URL when the source is one dataset', () => {
    // LA City Checkbook is ONE Socrata dataset covering nine fiscal years, so
    // nine rows legitimately share one citation.
    const rows = [2018, 2019, 2020].map((fy) => ({
      id: `la-${fy}`, data_source: 'LA City Checkbook', source_url: null,
    }));
    const plan = planCitations(rows, [{
      name: 'LA City Checkbook', api_type: 'socrata',
      base_url: 'https://controllerdata.lacity.org', dataset_id: 'pggv-e4fn',
    }]);
    expect(plan.writes.map((w) => w.url)).toEqual([
      'https://controllerdata.lacity.org/d/pggv-e4fn',
      'https://controllerdata.lacity.org/d/pggv-e4fn',
      'https://controllerdata.lacity.org/d/pggv-e4fn',
    ]);
  });

  it('treats an empty-string source_url as no link, not as a link', () => {
    // ⚠ The gate counts '' as linkless; a planner that counted it as cited
    // would report success while the debt stayed exactly where it was.
    const plan = planCitations(
      [{ id: '5', data_source: 'A Register FY2025', source_url: '   ' }],
      sources,
    );
    expect(plan.writes).toHaveLength(1);
    expect(plan.alreadyCited).toBe(0);
  });
});

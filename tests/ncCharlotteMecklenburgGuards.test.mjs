/**
 * Knight campaign session 2 — City of Charlotte + Mecklenburg County guards.
 *
 * ⚠⚠ THE POINT OF THIS FILE. `assertIssuer` proves WHO WROTE a document. It
 * cannot prove WHAT the document IS, and on this issuer that gap is not
 * theoretical: the City of Charlotte publishes a Popular Annual Financial
 * Report, the Charlotte Douglas AIRPORT ACFR and a CHARLOTTE WATER annual
 * financial report beside its own ACFR, and it genuinely authored all of them.
 * Two of those pass `assertIssuer` untouched.
 *
 * Every fixture here is REAL front matter or a REAL structural slice taken from
 * the published PDF, in the spirit of `ncAcfrSources.test.mjs` — a guard that
 * has only ever been tried against text someone wrote for the test is not
 * evidence that it works.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertIssuer, assertReportType, NC_ISSUERS } from '../scripts/lib/ncAcfrSources.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(HERE, 'fixtures', 'nc', name), 'utf8');

const FRONT = {
  charlotteCity: fixture('charlotte-city-fy2023-frontmatter.txt'),
  mecklenburg: fixture('mecklenburg-county-fy2023-frontmatter.txt'),
  water: fixture('charlotte-water-fy2023-frontmatter.txt'),
  pafr: fixture('charlotte-pafr-fy2023-frontmatter.txt'),
  airport: fixture('charlotte-airport-fy2023-frontmatter.txt'),
  schools: fixture('charlotte-mecklenburg-schools-fy2023-frontmatter.txt'),
};
const STRUCT = {
  charlotteCity: fixture('charlotte-city-fy2023-structure.txt'),
  mecklenburg: fixture('mecklenburg-county-fy2023-structure.txt'),
  water: fixture('charlotte-water-fy2023-structure.txt'),
  pafr: fixture('charlotte-pafr-fy2023-structure.txt'),
  airport: fixture('charlotte-airport-fy2023-structure.txt'),
  schools: fixture('charlotte-mecklenburg-schools-fy2023-structure.txt'),
};

describe('assertIssuer on the real Charlotte and Mecklenburg reports', () => {
  it('accepts the City of Charlotte ACFR', () => {
    expect(assertIssuer(FRONT.charlotteCity, NC_ISSUERS.charlotte).ok).toBe(true);
  });

  it('accepts the Mecklenburg County ACFR', () => {
    expect(assertIssuer(FRONT.mecklenburg, NC_ISSUERS.mecklenburg).ok).toBe(true);
  });

  it('rejects Charlotte-Mecklenburg Schools as Mecklenburg County', () => {
    // The schools' report NAMES Mecklenburg County — the Buncombe collision
    // again, across two entities in this milestone rather than one.
    const r = assertIssuer(FRONT.schools, NC_ISSUERS.mecklenburg);
    expect(r.ok).toBe(false);
  });

  it('rejects the airport report as the City of Charlotte', () => {
    expect(assertIssuer(FRONT.airport, NC_ISSUERS.charlotte).ok).toBe(false);
  });

  it('⚠ DOCUMENTS THE GAP: it ACCEPTS the Charlotte Water report', () => {
    // NOT a bug in assertIssuer — the City really did author this. It is why
    // assertReportType exists. If this ever starts failing, the guard shape has
    // changed and the report-type test below may no longer be load-bearing.
    expect(assertIssuer(FRONT.water, NC_ISSUERS.charlotte).ok).toBe(true);
  });

  it('⚠ DOCUMENTS THE GAP: it ACCEPTS the Charlotte PAFR', () => {
    expect(assertIssuer(FRONT.pafr, NC_ISSUERS.charlotte).ok).toBe(true);
  });
});

describe('⚠ the issuer window has far less margin than it looks', () => {
  // `assertIssuer` only reads the first 20,000 characters. Charlotte's first
  // governing marker ("Mayor") lands at character 234. MECKLENBURG'S LANDS AT
  // 14,073 — 70% of the way through the window — because the county sets a long
  // table of contents and a seventeen-page "Facts and Information" section ahead
  // of anything naming its own officers.
  //
  // That is not currently a bug and this test is not asserting one. It exists so
  // that if the county's front matter grows by ~6,000 characters, the failure is
  // THIS test rather than every real Mecklenburg year being rejected as the wrong
  // issuer — which would read exactly like a fetch problem.
  const WINDOW = 20_000;
  const marker = /COUNTY\s*MANAGER|CITY\s*MANAGER|MAYOR/i;

  it('Charlotte names an officer early', () => {
    const at = FRONT.charlotteCity.search(marker);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(2_000);
  });

  it('Mecklenburg names one LATE, and the remaining margin is recorded', () => {
    const at = FRONT.mecklenburg.search(marker);
    expect(at).toBeGreaterThanOrEqual(0);
    // Pin the observed position so an erosion of the margin is visible.
    expect(at).toBeGreaterThan(10_000);
    expect(at).toBeLessThan(WINDOW);
  });
});

describe('assertReportType closes that gap', () => {
  it('accepts a whole-government ACFR (Charlotte, Mecklenburg)', () => {
    expect(assertReportType(STRUCT.charlotteCity).ok).toBe(true);
    expect(assertReportType(STRUCT.mecklenburg).ok).toBe(true);
  });

  it('REJECTS the two documents assertIssuer accepts', () => {
    // The whole reason the function exists.
    expect(assertReportType(STRUCT.water).ok).toBe(false);
    expect(assertReportType(STRUCT.pafr).ok).toBe(false);
  });

  it('rejects the airport enterprise-fund report', () => {
    expect(assertReportType(STRUCT.airport).ok).toBe(false);
  });

  it('names WHAT is wrong, not just that something is', () => {
    expect(assertReportType(STRUCT.water).note).toMatch(/governmental-funds balance sheet/i);
  });

  it('refuses unreadable text rather than passing it', () => {
    // Silence is not agreement — the censusGuard failure mode.
    expect(assertReportType(null).ok).toBe(false);
    expect(assertReportType(undefined).ok).toBe(false);
  });

  it('survives a PDF that FUSES its words', () => {
    // City of Durham FY2023 emits 'Totalrevenues'; a literal-substring test
    // would report "not an ACFR" for a statement that is plainly there.
    expect(assertReportType('BALANCESHEETGOVERNMENTALFUNDS').ok).toBe(true);
  });

  it('is not satisfied by the words appearing far apart', () => {
    // The bounded gap is what stops a table of contents entry for a BALANCE
    // SHEET and an unrelated mention of GOVERNMENTAL FUNDS 40 lines later from
    // qualifying a document that has neither statement.
    const farApart = `BALANCE SHEET${' filler'.repeat(60)} GOVERNMENTAL FUNDS`;
    expect(assertReportType(farApart).ok).toBe(false);
  });
});

describe('the two guards are only sufficient TOGETHER', () => {
  const combined = (front, struct, issuer) => assertIssuer(front, issuer).ok && assertReportType(struct).ok;

  it('accepts both real reports and nothing else', () => {
    expect(combined(FRONT.charlotteCity, STRUCT.charlotteCity, NC_ISSUERS.charlotte)).toBe(true);
    expect(combined(FRONT.mecklenburg, STRUCT.mecklenburg, NC_ISSUERS.mecklenburg)).toBe(true);

    for (const [name, issuer] of [['charlotte', NC_ISSUERS.charlotte], ['mecklenburg', NC_ISSUERS.mecklenburg]]) {
      for (const decoy of ['water', 'pafr', 'airport', 'schools']) {
        expect(combined(FRONT[decoy], STRUCT[decoy], issuer),
          `${decoy} must not pass as ${name}`).toBe(false);
      }
    }
  });
});

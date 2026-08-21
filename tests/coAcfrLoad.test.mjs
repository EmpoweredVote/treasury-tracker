import { describe, it, expect } from 'vitest';
// From the LIBS, never from scripts/fetchColorado.mjs: that file starts with a
// shebang, and tests/nulByte + waSao guards forbid a test from importing any
// module that does (a CRLF checkout turns `#!/usr/bin/env node\r` into an
// unresolvable interpreter path).
import { assertConfig } from '../scripts/lib/acfrGfLoad.mjs';
import {
  CS_VIEWER_SLUGS, csViewerUrl, csAssetUrlFromShell, EPC_FYS, epcUrls, EPC_ASSET_HOST,
} from '../scripts/lib/coAcfrSources.mjs';

const CO_BASE = {
  entityLabel: 'City of Colorado Springs',
  muniName: 'Colorado Springs',
  entityType: 'city',
  state: 'CO',
  pdfDir: 'docs/ColoradoSprings',
  filePattern: /^colorado-springs-(\d{4})-acfr\.pdf$/i,
  extractScript: 'scripts/extractColoradoSprings.py',
  datasetIdPrefix: 'colorado-springs-acfr-gf',
  baseUrl: 'https://coloradosprings.gov/',
  fys: [2024],
  fyEndMonthDay: '12-31',
  fiscalYearStartMonth: 1,
};

describe('assertConfig — the fiscal calendar cannot be defaulted', () => {
  it('accepts a calendar-year Colorado config and an Oct-Sep Texas one', () => {
    expect(assertConfig({ ...CO_BASE })).toBeTruthy();
    expect(assertConfig({ ...CO_BASE, state: 'TX', fyEndMonthDay: '09-30', fiscalYearStartMonth: 10 })).toBeTruthy();
  });

  it('rejects a config that omits the fiscal-year end', () => {
    // The shared lib was TX-only and hardcoded '09-30' / month 10. Had those
    // stayed defaults, every Colorado row would have been stamped with a
    // September period end and an October start month — no dollar figure would
    // change, so nothing downstream would notice. That is the defect class
    // fixAcfrFiscalYearStartMonth.mjs had to sweep 1,719 rows to undo.
    const { fyEndMonthDay, ...missing } = CO_BASE;
    expect(() => assertConfig(missing)).toThrow(/fyEndMonthDay/);
  });

  it('rejects a config that omits state, so it cannot resolve the wrong entity', () => {
    const { state, ...missing } = CO_BASE;
    expect(() => assertConfig(missing)).toThrow(/state/);
  });

  it('rejects a fiscal-year end that contradicts the start month', () => {
    // A year ending 12-31 starts in month 1; one ending 09-30 starts in month
    // 10. Getting one of the pair wrong is a typo no arithmetic check can see,
    // so the two facts are required to agree.
    expect(() => assertConfig({ ...CO_BASE, fiscalYearStartMonth: 10 }))
      .toThrow(/contradicts/);
    expect(() => assertConfig({ ...CO_BASE, fyEndMonthDay: '09-30' }))
      .toThrow(/contradicts/);
  });

  it('rejects a malformed fyEndMonthDay', () => {
    expect(() => assertConfig({ ...CO_BASE, fyEndMonthDay: 'Dec 31' })).toThrow(/MM-DD/);
  });
});

describe('Colorado Springs source resolution', () => {
  it('covers FY1999 through FY2025 and returns null off-manifest', () => {
    expect(Object.keys(CS_VIEWER_SLUGS)).toHaveLength(27);
    for (let fy = 1999; fy <= 2025; fy++) expect(csViewerUrl(fy)).toBeTruthy();
    expect(csViewerUrl(1998)).toBeNull();
    expect(csViewerUrl(2026)).toBeNull();
  });

  it('builds the VIEWER url, which is HTML and not the report', () => {
    // Every link the city publishes ends in `.pdf` and serves text/html — a
    // ~27KB pdf.js shell. A naive `curl -o x.pdf` writes an HTML page named
    // .pdf for all 27 years. The name being `csViewerUrl` rather than
    // `csAssetUrl` is the point.
    expect(csViewerUrl(2024)).toBe('https://coloradosprings.gov/document/2024-co-springs-acfrfinal.pdf');
  });

  it('extracts the real asset url from the viewer shell data-src', () => {
    const html = '<a class="dl" data-src="https://coloradosprings.gov/system/files/2025-07/2024%20CO%20Springs%20ACFR_Final.pdf">x</a>';
    expect(csAssetUrlFromShell(html))
      .toBe('https://coloradosprings.gov/system/files/2025-07/2024%20CO%20Springs%20ACFR_Final.pdf');
  });

  it('falls back to the pdf.js ?file= query and absolutizes a relative href', () => {
    const html = '<iframe src="/libraries/pdf.js/web/viewer.html?file=%2Fsystem%2Ffiles%2F2016_cafr_final.pdf"></iframe>';
    expect(csAssetUrlFromShell(html)).toBe('https://coloradosprings.gov/system/files/2016_cafr_final.pdf');
  });

  it('returns null rather than guessing when the shell names no pdf', () => {
    // A MISS must be reported so the fetcher records a failure, because the
    // asset paths are NOT derivable: the 27 files sit under five different
    // Drupal conventions and FY2022+ embed the UPLOAD MONTH
    // (/system/files/2025-07/...), which no rule can predict.
    expect(csAssetUrlFromShell('<html><body>Page not found</body></html>')).toBeNull();
    expect(csAssetUrlFromShell('<img data-src="/thumb/preview.png">')).toBeNull();
  });
});

describe('El Paso County source candidates', () => {
  it('covers FY2000 through FY2025', () => {
    expect(EPC_FYS[0]).toBe(2000);
    expect(EPC_FYS.at(-1)).toBe(2025);
    expect(EPC_FYS).toHaveLength(26);
  });

  it('offers BOTH GFOA name orders for every year', () => {
    // The county renamed "Comprehensive Annual" to "Annual Comprehensive" at
    // FY2021. Hardcoding that boundary would silently drop a year the moment
    // one old file was re-published under the new name.
    for (const fy of [2010, 2021, 2025]) {
      const urls = epcUrls(fy);
      expect(urls.some((u) => u.includes(`${fy}-Comprehensive-Annual-Financial-Report.pdf`))).toBe(true);
      expect(urls.some((u) => u.includes(`${fy}-Annual-Comprehensive-Financial-Report.pdf`))).toBe(true);
    }
  });

  it('tries the `-1` re-upload suffix, which is the ONLY way FY2011 and FY2019 resolve', () => {
    // Both years 404 on every unsuffixed name. They were initially recorded as
    // "not published" until the variant probe found them, so the suffix is
    // offered for every year rather than pinned to those two.
    for (const fy of [2011, 2019]) {
      expect(epcUrls(fy)[0]).toContain(`${fy}-Comprehensive-Annual-Financial-Report-1.pdf`);
    }
    expect(epcUrls(2014).some((u) => u.includes('-1.pdf'))).toBe(true);
  });

  it('puts the observed-good filename first without dropping the alternatives', () => {
    const urls = epcUrls(2024);
    expect(urls[0]).toContain('2024-ACFR-FINAL-reduced-size.pdf');
    expect(urls.length).toBeGreaterThan(1);
    expect(urls.some((u) => u.includes('2024-Annual-Comprehensive-Financial-Report.pdf'))).toBe(true);
  });

  it('prefers the uploads ROOT for FY2023+ and the /ACFR/ subdir before it', () => {
    expect(epcUrls(2023)[0]).toBe(`${EPC_ASSET_HOST}/2023-Annual-Comprehensive-Financial-Report.pdf`);
    expect(epcUrls(2012)[0]).toBe(`${EPC_ASSET_HOST}/ACFR/2012-Comprehensive-Annual-Financial-Report.pdf`);
  });

  it('uses the epc-assets host, not the admin site that only lists four years', () => {
    for (const u of epcUrls(2020)) expect(u).toContain('epc-assets.elpasoco.com');
  });
});

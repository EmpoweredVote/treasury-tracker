import { describe, it, expect } from 'vitest';
import {
  identityPattern, assertFiscalYear, manifestEntryFor, isOwnCover,
} from '../scripts/fetchHiCounties.mjs';
import { documentUrlFor } from '../scripts/lib/hiCountySources.mjs';

describe('the auditee-identity guard', () => {
  // ⚠⚠⚠ Guard (e) is the ONLY one that catches a CIPHERED text layer. Alaska
  // had three — Sitka FY2018, Bristol Bay FY2024, Yakutat FY2018 — reading at
  // ~1,650-1,900 chars/page, in which the entity's own name appeared ZERO
  // times. The <400 c/p density guard sees a healthy text layer and passes
  // them. A ciphered page yields spurious NUMBERS, not an empty tree.
  it('matches each county on its own distinctive cover-page stem', () => {
    expect(identityPattern('honolulu').test('CITY AND COUNTY OF HONOLULU')).toBe(true);
    expect(identityPattern('honolulu').test('COUNTY OF MAUI')).toBe(false);
    expect(identityPattern('maui').test('COUNTY OF MAUI')).toBe(true);
    expect(identityPattern('kauai').test("COUNTY OF KAUA'I")).toBe(true);
    expect(identityPattern('kauai').test('COUNTY OF KAUAI')).toBe(true);
  });

  // ⚠⚠ `Department of Water, County of Kauai` (EIN 472810526) is a COMPONENT
  // UNIT with its own EIN and its own FAC filings. A substring search for
  // "county of kauai" claims it. The guard must anchor at a line start.
  it('rejects the Kauai component unit for its parent county', () => {
    expect(identityPattern('kauai').test('DEPARTMENT OF WATER, COUNTY OF KAUAI')).toBe(false);
  });

  // ⚠⚠⚠ A CENTRED COVER PAGE BREAKS ONTO SEPARATE LINES. `pdftotext -table`
  // routinely renders the component unit's own cover as
  //     DEPARTMENT OF WATER
  //     COUNTY OF KAUAI
  // and the second line satisfies the line-anchored identity pattern, so the
  // anchor alone does NOT separate the county from its own utility — which is
  // exactly what this guard's header claimed it did.
  //
  // The old second check (`NOT_IDENTITY.test(head) && !identity.test(head
  // .slice(0, 4000))`) could only fire when the county's own name appeared
  // AFTER character 4000, i.e. never for a document that had already passed
  // the first check on its cover. It was dead code asserting protection it
  // did not provide.
  it('rejects a component unit whose cover page wraps onto two lines', () => {
    const cover = 'DEPARTMENT OF WATER\nCOUNTY OF KAUAI\nANNUAL COMPREHENSIVE FINANCIAL REPORT';
    expect(isOwnCover('kauai', cover)).toBe(false);
  });

  it('accepts the county whose own cover wraps the same way', () => {
    const cover = "COUNTY OF KAUA`I, HAWAI`I\nANNUAL COMPREHENSIVE FINANCIAL REPORT\n"
      + 'Department of Water is a discretely presented component unit';
    expect(isOwnCover('kauai', cover)).toBe(true);
  });

  it('still accepts a county that merely mentions its component unit later', () => {
    const cover = 'CITY AND COUNTY OF HONOLULU\nANNUAL COMPREHENSIVE FINANCIAL REPORT\n'
      + 'Board of Water Supply\nOahu Transit Services, Inc.';
    expect(isOwnCover('honolulu', cover)).toBe(true);
  });

  // ⚠⚠⚠ THE ʻOKINA IS A BACKTICK IN THE SOURCE DOCUMENTS. Kaua'i's own ACFR
  // prints "County of Kaua`i, Hawai`i" using U+0060 — not U+02BB, not a right
  // single quote, not an apostrophe. A character class that omitted it
  // rejected ALL NINE Kaua'i filings as "ciphered or the wrong document",
  // which is how a perfectly clean corpus looks like a dead publisher.
  // Measured on 2024-06-GSAFAC-0000348912, whose PDF title is
  // "County of Kauai 202406ACFR".
  it('accepts every okina the issuers actually print', () => {
    for (const okina of ['`', 'ʻ', '‘', '’', "'", '']) {
      expect(identityPattern('kauai').test(`County of Kaua${okina}i, Hawai${okina}i`)).toBe(true);
    }
    expect(identityPattern('hawaii').test('County of Hawai`i')).toBe(true);
  });

  // ⚠⚠ 295 of Hawaii's 299 FAC auditees are STATE bodies. The state runs all
  // schools and all highways; none of them is Hawaii County.
  it('rejects state agencies for Hawaii County', () => {
    expect(identityPattern('hawaii').test('STATE OF HAWAII DEPARTMENT OF TRANSPORTATION')).toBe(false);
    expect(identityPattern('hawaii').test('Department of Education, State of Hawaii')).toBe(false);
    expect(identityPattern('hawaii').test('COUNTY OF HAWAII')).toBe(true);
  });

  // `pdftotext -table` spreads a centred cover-page title across wide gaps:
  // Honolulu FY2025 extracts as "CITY       AND    COUNTY       OF  HONOLULU".
  it('tolerates the wide gaps -table leaves in a centred title', () => {
    expect(identityPattern('honolulu').test('     CITY       AND    COUNTY     OF  HONOLULU')).toBe(true);
  });
});

describe('the fiscal-year guard', () => {
  it('rejects a document naming a different fiscal year', () => {
    expect(assertFiscalYear('FOR THE FISCAL YEAR ENDED JUNE 30, 2025', 2025)).toBe(true);
    expect(assertFiscalYear('FOR THE FISCAL YEAR ENDED JUNE 30, 2024', 2025)).toBe(false);
  });

  // A comparative statement names both years; the one we asked for is present,
  // which is what the guard tests. It never infers the year FROM the document.
  it('accepts a comparative statement that names the year asked for', () => {
    const t = 'FOR THE YEARS ENDED JUNE 30, 2025 AND 2024';
    expect(assertFiscalYear(t, 2025)).toBe(true);
    expect(assertFiscalYear(t, 2024)).toBe(true);
    expect(assertFiscalYear(t, 2023)).toBe(false);
  });
});

describe('the provenance manifest', () => {
  // ⚠⚠⚠ THIS IS THE DEFECT THAT SHIPPED TWICE IN ALASKA. The fetcher recorded
  // `res.url` — the URL that actually served the bytes — which for FAC is a
  // presigned S3 object carrying `X-Amz-Expires=30`. Thirty SECONDS. 253 rows
  // carried a link dead before the load writing it had finished, and NO gate
  // reads a source_url: the tie gate, the per-capita guard, the frozen
  // invariant and the scope sweep were all green throughout.
  //
  // `acfrGfLoad.mjs` stamps `source_url` from `manifest[fy].url` (line 777),
  // so `url` is the field that must be the permalink.
  it('records the requested permalink as url, not the URL that served it', () => {
    const served = 'https://s3-us-gov-west-1.amazonaws.com/x.pdf'
      + '?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=30&X-Amz-Signature=deadbeef';
    const entry = manifestEntryFor('honolulu', 2025, {
      servedUrl: served, sha256: 'abc', bytes: 9703499, pages: 362,
    });
    expect(entry.url).toBe(documentUrlFor('honolulu', 2025));
    expect(entry.url).not.toMatch(/X-Amz-/i);
    expect(entry.servedUrl).toBe(served);
  });

  it('refuses to build an entry for a year the county did not file', () => {
    expect(() => manifestEntryFor('kauai', 2025, {
      servedUrl: 'https://app.fac.gov/x', sha256: 'abc', bytes: 1, pages: 1,
    })).toThrow(/did not file|no filing/i);
  });
});

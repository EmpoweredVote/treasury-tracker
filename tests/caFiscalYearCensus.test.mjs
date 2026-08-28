import { describe, it, expect } from 'vitest';
import {
  BASELINE, WINDOW, UNEVIDENCED, EVIDENCE_CSV,
  readEvidence, buildCensus, nonJulyCities, changeoverYears,
} from '../scripts/lib/caFiscalYearCensus.mjs';
import { fiscalExceptionFor, monthForEntry } from '../scripts/lib/caCityFiscalExceptions.mjs';

const records = readEvidence();
const census = buildCensus();
const nonJuly = nonJulyCities();

describe('the committed FAC evidence extract', () => {
  it('is the size it was when the census was built', () => {
    expect(census.size).toBe(BASELINE.entities);
    expect(records.length).toBeGreaterThan(0);
  });

  it('covers only audit years inside the census window', () => {
    let lo = Infinity;
    for (const r of records) for (const y of r.years) if (y < lo) lo = y;
    expect(lo).toBeGreaterThanOrEqual(WINDOW.firstAuditYear);
  });

  // ⚠ The pull that produced PR #101 was truncated by the api.fac.gov DEMO_KEY
  // rate limit before the `TOWN OF …` block, so ~20 CA towns were missing and
  // that gap was recorded rather than hidden. The bulk download has no rate
  // limit and closed it: all 14 CA towns that file are present, and every one
  // is July — the finding set did not change.
  it('includes the CA towns the rate-limited pull had missed', () => {
    for (const town of ['Truckee', 'Danville', 'Los Gatos', 'Apple Valley', 'Windsor']) {
      expect(census.get(town), `${town} missing from the census`).toBeTruthy();
    }
    expect(nonJuly.map((c) => c.name)).not.toContain('Truckee');
  });

  // The name-parsing and not-a-government filters now live in the builder and
  // are tested in tests/facCensusBuilder.test.mjs. What matters here is that
  // nothing survived them: no impostor sits in California's committed extract.
  it('carries no impostor entities', () => {
    expect([...census.keys()]).not.toContain('Groton');
    for (const name of census.keys()) {
      expect(name).not.toMatch(/authority|department|commission|district/i);
    }
    expect(census.get('San Francisco')).toBeTruthy();
    expect(census.get('Santa Ana')).toBeTruthy();
  });
});

describe('the census reproduces what was already known', () => {
  // ⚠ A gate that cannot rediscover the cases you already hold is not a gate.
  // Inglewood and Long Beach were evidenced by hand from their ACFRs in PRs #60
  // and #68. The census must find them WITHOUT being told.
  it('rediscovers Inglewood and Long Beach as October cities', () => {
    for (const name of ['Inglewood', 'Long Beach']) {
      const found = nonJuly.find((c) => c.name === name);
      expect(found, `${name} missing from the non-July set`).toBeTruthy();
      expect(found.months.map((m) => m.month)).toEqual([10]);
      expect(found.changed).toBe(false);
    }
  });

  // Torrance's FY2020 record reads 2019-07-02 -> 2020-07-01: a one-day-shifted
  // transcription of an ordinary July-June year, not an August fiscal year.
  it('does not mistake a one-day transcription artefact for a calendar', () => {
    expect(nonJuly.map((c) => c.name)).not.toContain('Torrance');
  });
});

describe('census and exception registry stay in lockstep', () => {
  it('found exactly the cities the census baseline records', () => {
    expect(nonJuly.length).toBe(BASELINE.nonJulyCities);
  });

  // ⚠⚠ THIS IS THE GUARD THAT MATTERS. Refresh the CSV, and any newly non-July
  // California city fails the build until somebody reads its documents and
  // declares it. Absence from the registry must never mean "assume July".
  it('declares every non-July city in caCityFiscalExceptions', () => {
    for (const city of nonJuly) {
      const exc = fiscalExceptionFor(city.name, 'CA');
      expect(exc, `${city.name} runs a non-July fiscal year in the federal audit `
        + 'record but is not declared in scripts/lib/caCityFiscalExceptions.mjs').toBeTruthy();
    }
  });

  // The registry must not merely name the city — it must agree year by year,
  // EXCEPT in a changeover year, where the census is knowingly blind (it infers
  // a start month from the period end, and a stub year is shorter than twelve
  // months). There the registry must hold the OLD calendar, which is what a
  // stub period actually begins in.
  it('agrees with the census in every audit year except the changeover', () => {
    for (const city of nonJuly) {
      const exc = fiscalExceptionFor(city.name, 'CA');
      const entry = census.get(city.name);
      const changeovers = changeoverYears(entry);
      const monthOf = new Map();
      for (const { month, years } of city.months) for (const y of years) monthOf.set(y, month);

      for (const [year, month] of [...monthOf].sort((a, b) => a[0] - b[0])) {
        const resolved = monthForEntry(exc, year);
        expect(resolved.error).toBeUndefined();
        if (changeovers.includes(year)) {
          const previous = monthOf.get(year - 1);
          expect([month, previous], `${city.name} FY${year} is a changeover year: the `
            + `registry must hold either the new calendar (${month}) or the old one `
            + `(${previous}, meaning it read the period as a stub), not `
            + `${resolved.month}`).toContain(resolved.month);
        } else {
          expect(resolved.month, `${city.name} FY${year}: census says month ${month}, `
            + `registry says ${resolved.month}`).toBe(month);
        }
      }
    }
  });

  // Named explicitly, so the one place the census defers to a document stays
  // visible rather than being quietly absorbed by the branch above.
  it('treats Huntington Beach FY2018 as a stub that BEGINS in October', () => {
    expect(changeoverYears(census.get('Huntington Beach'))).toEqual([2018]);
    expect(monthForEntry(fiscalExceptionFor('Huntington Beach', 'CA'), 2018).month).toBe(10);
    expect(monthForEntry(fiscalExceptionFor('Huntington Beach', 'CA'), 2019).month).toBe(7);
  });

  it('records the two cities that changed calendars as changed', () => {
    const changed = nonJuly.filter((c) => c.changed).map((c) => c.name).sort();
    expect(changed).toEqual(['El Segundo', 'Huntington Beach']);
  });
});

describe('the gaps are named rather than implied', () => {
  it('keeps Sand City as UNEVIDENCED and does not claim a month for it', () => {
    expect(UNEVIDENCED.map((u) => u.name)).toEqual(['Sand City']);
    expect(fiscalExceptionFor('Sand City', 'CA')).toBeNull();
    expect(UNEVIDENCED[0].why).toMatch(/no Single Audit|files no/i);
  });

  // ✅ The pre-2016 blind spot is CLOSED: the FAC's 1998-2015 archive is merged
  // in, so the census now covers every fiscal year TT holds (FY2003+). A change
  // made before 1998 remains invisible, and that is now the honest boundary.
  it('states its own start year, which is now earlier than any TT row', () => {
    expect(WINDOW.firstAuditYear).toBe(1998);
    // California is now read out of the ONE national evidence file, not a
    // per-state extract — 53 per-state files would add ~6 MB of tracked CSV.
    expect(EVIDENCE_CSV).toMatch(/fac-local-fiscal-year-ends\.csv$/);
  });
});

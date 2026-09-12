/**
 * How an Indiana Gateway entity-year's parse outcome is classified.
 *
 * ⚠⚠ THE CLAIM THIS REPLACES WAS FALSE, and it was written down in
 * `loadIndianaGateway.mjs` as fact: "a year missing from only ONE side is a
 * parse defect and must fail loudly". Measured against all 9,741 roster
 * entity-years on 2026-09-11, exactly four carry zero `Governmental Activities`
 * rows on a side, and the two one-sided ones are PUBLISHER SHAPES, not defects:
 *
 *     FY2011  Altona       receipts 2  disbursements 0   filed no disbursements
 *     FY2020  Vernon       receipts 0  disbursements 0   filed nothing
 *     FY2024  Center Point receipts 0  disbursements 0   filed nothing
 *     FY2025  Brooksburg   receipts 7  disbursements 0   filed ONLY its
 *                                                        wastewater ent_name
 *
 * The OUTCOME does not change — a one-sided year still refuses, and refusing is
 * right, because a governmental total built from one side of a filing would be
 * a figure nobody published. What changes is that the refusal now NAMES the
 * likely cause, so the next reader does not spend the afternoon hunting a parse
 * bug that is not there. (I did.)
 */
import { describe, it, expect } from 'vitest';

import { classifyFilingShape, FILING_SHAPE } from '../scripts/lib/inGateway.mjs';

const rows = (n) => ({ rows: n });

describe('classifyFilingShape', () => {
  it('is NOT_FILED when the publisher carries neither side', () => {
    // Vernon FY2020 and Center Point FY2024. Already reported, never silently
    // skipped — this branch is the existing behaviour, pinned.
    expect(classifyFilingShape(rows(0), rows(0))).toBe(FILING_SHAPE.NOT_FILED);
  });

  it('is COMPLETE when both sides carry rows', () => {
    expect(classifyFilingShape(rows(12), rows(9))).toBe(FILING_SHAPE.COMPLETE);
  });

  it('is ONE_SIDED when receipts are present and disbursements are not', () => {
    // Altona FY2011 (2 / 0) and Brooksburg FY2025 (7 / 0).
    expect(classifyFilingShape(rows(7), rows(0))).toBe(FILING_SHAPE.ONE_SIDED);
  });

  it('is ONE_SIDED the other way round too', () => {
    // Not observed in the 2026-09-11 scan, but the publisher can do it and the
    // classification must not depend on which side happens to be empty.
    expect(classifyFilingShape(rows(0), rows(5))).toBe(FILING_SHAPE.ONE_SIDED);
  });

  it('treats a missing result as zero rows rather than throwing', () => {
    expect(classifyFilingShape(undefined, undefined)).toBe(FILING_SHAPE.NOT_FILED);
    expect(classifyFilingShape(null, rows(3))).toBe(FILING_SHAPE.ONE_SIDED);
  });
});

/**
 * Real extractor `tree` output, captured verbatim (I-2 code review fix for
 * Task 7), used to prove toBudgetTree()'s single mapping rule genuinely
 * handles both entities' distinct shapes -- not just asserted in a comment.
 *
 * Captured by running the real, shipped extractors against the real,
 * already-onboarded PDFs:
 *   py -3 scripts/extractBainbridge.py "docs/BainbridgeIsland/bainbridge-2025-acfr.pdf" --mode operating
 *   py -3 scripts/extractKitsap.py "docs/KitsapCounty/kitsap-2024-acfr.pdf" --mode operating
 *
 * Only the `.tree` field is captured (toBudgetTree only ever sees this
 * field) -- committed inline so these tests have no PDF/pdftotext/python
 * dependency at all.
 *
 * BAINBRIDGE_2025_OPERATING_TREE shape: `Current` is the ONLY parent (has a
 * nested `.c`); `Debt Service - Principal`, `Debt Service - Interest` and
 * `Capital Outlay` are ROOT-LEVEL VALUED LEAVES (no `.c`) -- Debt Service is
 * split into two separately-valued root children, not one parent.
 *
 * KITSAP_2024_OPERATING_TREE shape: `Current` AND `Debt Service` are BOTH
 * parents (each has a nested `.c`); `Capital Outlay` is the only root-level
 * valued leaf. This is the INVERSE of Bainbridge's Debt Service shape and
 * exercises the same "root child with vs without `.c`" rule from the other
 * side.
 */

export const BAINBRIDGE_2025_OPERATING_TREE = {
  n: 'General Fund Expenditure by Function',
  a: 20801296,
  c: [
    {
      n: 'Current',
      a: 20633325,
      c: [
        { n: 'General Government', a: 7996984 },
        { n: 'Judicial', a: 804040 },
        { n: 'Public Safety', a: 7036357 },
        { n: 'Physical Environment', a: 924903 },
        { n: 'Health and Human Services', a: 1424106 },
        { n: 'Economic Environment', a: 1806075 },
        { n: 'Culture and Recreation', a: 640860 },
      ],
    },
    { n: 'Debt Service - Principal', a: 30508 },
    { n: 'Debt Service - Interest', a: 3966 },
    { n: 'Capital Outlay', a: 133497 },
  ],
};

export const KITSAP_2024_OPERATING_TREE = {
  n: 'General Fund Expenditure by Function',
  a: 128230878,
  c: [
    {
      n: 'Current',
      a: 127422261,
      c: [
        { n: 'General Government', a: 31292474 },
        { n: 'Judicial Services', a: 21864245 },
        { n: 'Public Safety', a: 65720794 },
        { n: 'Physical Environment', a: 2772321 },
        { n: 'Culture & Recreation', a: 5772427 },
      ],
    },
    {
      n: 'Debt Service',
      a: 478049,
      c: [
        { n: 'Principal', a: 442709 },
        { n: 'Interest & Other Charges', a: 35340 },
      ],
    },
    { n: 'Capital Outlay', a: 330568 },
  ],
};

import React from 'react';

interface SourceChipProps {
  sourceName: string;
  sourceUrl: string;
  /**
   * ISO date the figures are *as of* — the period the data describes, or the
   * source document's publication date. NOT when we retrieved the file: loaders
   * deliberately store the period end in `source_date` (e.g. a CY2024 workbook
   * carries 2024-12-31). Rendering this as "fetched" claimed a retrieval date
   * that was frequently impossible — Bend FY2006 read "fetched 2006-06-30".
   */
  fetchDate?: string | null;
  /** Drop the as-of date for tight spaces */
  compact?: boolean;
}

/**
 * Source attribution pill — the v2.0 always-sourced standard's UI unit.
 * Every displayed federal figure gets one of these; municipal data adopts it
 * in the sourcing-backfill milestone.
 */
const SourceChip: React.FC<SourceChipProps> = ({ sourceName, sourceUrl, fetchDate, compact = false }) => {
  const date = fetchDate ? fetchDate.slice(0, 10) : null;
  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Data source: ${sourceName}${date ? `, as of ${date}` : ''} (opens in new tab)`}
      // ⚠⚠ NO `whitespace-nowrap`, AND `max-w-full`. It used to carry both the
      // nowrap and no width bound, so a long source name made the pill as wide
      // as the name: New York City's is "New York City ACFR — Total
      // Governmental Funds Expenditure by Function (FY2002 actual, GAAP basis)"
      // and rendered 696px wide inside a 390px viewport, dragging the WHOLE
      // PAGE 330px sideways. Measured on production 2026-10-10, and it is not
      // the font — blocking Manrope reproduces it exactly.
      //
      // ⚠ Wrapping rather than truncating is deliberate. This pill IS the
      // provenance — the always-sourced standard's UI unit — so which document
      // a figure came from must stay readable, and on a touch screen there is
      // no hover to recover a truncated name from. Where it fits on one line
      // it still does, so nothing changes on a desktop.
      className="inline-flex flex-wrap items-center gap-x-1 px-2 py-0.5 max-w-full rounded-2xl border border-[#E2EBEF] dark:border-ev-gray-700 bg-[#F7F7F8] dark:bg-ev-gray-900 text-xs text-ev-gray-500 dark:text-ev-gray-400 hover:text-ev-muted-blue hover:border-ev-muted-blue transition-colors duration-150"
    >
      <span>{sourceName}</span>
      {!compact && date && <span className="opacity-70">· as of {date}</span>}
      <span aria-hidden="true">↗</span>
    </a>
  );
};

export default SourceChip;

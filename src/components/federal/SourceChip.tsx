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
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#E2EBEF] dark:border-ev-gray-700 bg-[#F7F7F8] dark:bg-ev-gray-900 text-xs text-ev-gray-500 dark:text-ev-gray-400 hover:text-ev-muted-blue hover:border-ev-muted-blue transition-colors duration-150 whitespace-nowrap"
    >
      <span>{sourceName}</span>
      {!compact && date && <span className="opacity-70">· as of {date}</span>}
      <span aria-hidden="true">↗</span>
    </a>
  );
};

export default SourceChip;

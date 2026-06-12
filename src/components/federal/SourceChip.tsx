import React from 'react';

interface SourceChipProps {
  sourceName: string;
  sourceUrl: string;
  /** ISO date or timestamp of when the data was fetched from the source */
  fetchDate?: string | null;
  /** Drop the fetch date for tight spaces */
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
      aria-label={`Data source: ${sourceName}${date ? `, fetched ${date}` : ''} (opens in new tab)`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#E2EBEF] dark:border-ev-gray-700 bg-[#F7F7F8] dark:bg-ev-gray-900 text-xs text-ev-gray-500 dark:text-ev-gray-400 hover:text-ev-muted-blue hover:border-ev-muted-blue transition-colors duration-150 whitespace-nowrap"
    >
      <span>{sourceName}</span>
      {!compact && date && <span className="opacity-70">· fetched {date}</span>}
      <span aria-hidden="true">↗</span>
    </a>
  );
};

export default SourceChip;

import { SERIES_TOGGLE_COPY } from '../data/fundScopeVocabulary';
import { TONE } from './ScopeLabel';
import { spanLabel, type AvailableSeries } from '../data/seriesSelection';
import type { SeriesKey } from '../data/budgetSeries';

/**
 * SCOPE-03 — choose which published series is on screen.
 *
 * Renders the series the entity ACTUALLY has, never a fixed three-way
 * General Fund / Total Governmental / All Funds control. Measured 2026-08-18:
 * zero entities carry two different KNOWN fund scopes, so a fixed control would
 * show two permanently disabled buttons for every city in the country. 17
 * entities do carry more than one SERIES once basis is counted, which is what
 * this renders.
 *
 * A single-series entity gets one non-interactive pill: nothing to choose, so
 * nothing invites a click.
 *
 * ⚠ Colour classes are REUSED from ScopeLabel, never authored here. There is no
 * `ev-blue` scale and the gray steps are three-digit (`ev-gray-050`); Tailwind
 * drops an unknown colour class SILENTLY, so a typo passes the build, `tsc` and
 * the whole suite while rendering an unstyled chip. This repo has no component
 * tests, so nothing else guards it — the tokens used here were checked against
 * src/index.css by hand.
 */

interface FundSeriesToggleProps {
  series: AvailableSeries[];
  selectedId: string;
  onSelect: (key: SeriesKey) => void;
  className?: string;
}

export default function FundSeriesToggle({
  series, selectedId, onSelect, className = '',
}: FundSeriesToggleProps) {
  if (series.length === 0) return null;

  const single = series.length === 1;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-medium text-ev-gray-500 dark:text-ev-gray-400">
        {SERIES_TOGGLE_COPY.heading}
      </span>

      <div
        className="flex flex-wrap gap-2"
        role={single ? undefined : 'radiogroup'}
        aria-label={single ? undefined : SERIES_TOGGLE_COPY.heading}
      >
        {series.map((s) => {
          const selected = s.id === selectedId;
          const tone = TONE[s.key.fundScope];
          const body = (
            <>
              <span className="font-medium">{s.label}</span>
              <span className="opacity-70">{spanLabel(s.span)}</span>
            </>
          );

          if (single) {
            return (
              <span
                key={s.id}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1
                            text-[11px] ${tone}`}
              >
                {body}
              </span>
            );
          }

          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(s.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1
                          text-[11px] transition-colors hover:brightness-95 ${tone}
                          ${selected
                            ? 'ring-2 ring-offset-1 ring-ev-teal-400 dark:ring-offset-ev-gray-900'
                            : 'opacity-60'}`}
            >
              {body}
            </button>
          );
        })}
      </div>

      <span className="max-w-prose text-[11px] leading-relaxed text-ev-gray-500 dark:text-ev-gray-400">
        {single ? SERIES_TOGGLE_COPY.single : SERIES_TOGGLE_COPY.intro}
      </span>
    </div>
  );
}

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
      {/* The heading is a QUESTION ("Which published figures"), so it only belongs
          where there is actually something to choose. On a single-series entity it
          contradicted the body copy directly below it, which says "One published
          set of figures". Reported twice in AUSTIN-TRAVIS-01 UAT. */}
      {!single && (
        <span className="text-[11px] font-medium text-ev-gray-500 dark:text-ev-gray-400">
          {SERIES_TOGGLE_COPY.heading}
        </span>
      )}

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
            // PLAIN TEXT, not a pill. It used to carry the same
            // `rounded-full border px-3 py-1` treatment as the real radio buttons
            // below, so it looked clickable and did nothing — the stated intent
            // ("nothing invites a click") was undercut by its own styling. Chris
            // hit it twice in AUSTIN-TRAVIS-01 UAT: "Why are we showing the
            // actuals as a button when you get nothing for clicking on it?"
            //
            // The WORDS stay: "General Fund · actuals" is what stops a reader
            // comparing an adopted all-funds figure against a General Fund actual
            // (the Long Beach -75% seam). It is a caption, not a control.
            //
            // `tone` is deliberately NOT applied — it carries bg/border colours
            // that only make sense on a chip, and an unknown Tailwind colour class
            // is dropped SILENTLY in this repo (no `ev-blue` scale; gray steps are
            // three-digit). Plain inherited text cannot regress that way.
            // NOT `{body}`: that fragment's two spans relied on the pill's
            // `inline-flex gap-2` for the space between them, so dropping the flex
            // container would have run them together as "actualsFY2010–25".
            // The separator is explicit here.
            return (
              <span key={s.id} className="text-[11px] text-ev-gray-600 dark:text-ev-gray-300">
                <span className="font-medium">{s.label}</span>
                <span className="opacity-70">{' · '}{spanLabel(s.span)}</span>
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

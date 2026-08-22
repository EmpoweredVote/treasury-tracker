import { SERIES_TOGGLE_COPY, DERIVED_COPY } from '../data/fundScopeVocabulary';
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

  // SCOPE-04 — the disclosure below is tied to the series ACTUALLY ON SCREEN, not
  // to "any derived series exists". It describes the figure the reader is looking
  // at; showing it while a published series is selected would explain the wrong
  // number. Each pill still carries its own `computed by Treasury Tracker` marker.
  const shown = series.find((s) => s.id === selectedId) ?? (single ? series[0] : undefined);
  const shownIsDerived = shown?.derivation === 'derived';

  // ⚠ The heading and intro describe the WHOLE LIST, so they switch on whether any
  // listed series is derived — not on which one is selected. Saying "Which published
  // figures" above a list containing a computed option is false regardless of the
  // reader's current choice.
  const anyDerived = series.some((s) => s.derivation === 'derived');

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {/* The heading is a QUESTION ("Which published figures"), so it only belongs
          where there is actually something to choose. On a single-series entity it
          contradicted the body copy directly below it, which says "One published
          set of figures". Reported twice in AUSTIN-TRAVIS-01 UAT. */}
      {!single && (
        <span className="text-[11px] font-medium text-ev-gray-500 dark:text-ev-gray-400">
          {anyDerived ? SERIES_TOGGLE_COPY.headingAnyDerived : SERIES_TOGGLE_COPY.heading}
        </span>
      )}

      <div
        className="flex flex-wrap gap-2"
        role={single ? undefined : 'radiogroup'}
        aria-label={single ? undefined : (anyDerived ? SERIES_TOGGLE_COPY.headingAnyDerived : SERIES_TOGGLE_COPY.heading)}
      >
        {series.map((s) => {
          const selected = s.id === selectedId;
          const tone = TONE[s.key.fundScope];
          // SCOPE-04 — a derived figure declares itself wherever its series is named.
          // `total_governmental` alone cannot carry this: it holds both published
          // rows (MN OSA, Ohio AOS) and rows Treasury Tracker computed, so without
          // the marker a reader sees one label over two different kinds of figure.
          const derived = s.derivation === 'derived';
          const body = (
            <>
              <span className="font-medium">{s.label}</span>
              <span className="opacity-70">{spanLabel(s.span)}</span>
              {/* Inert: no tone, no chip of its own, and it is never the control.
                  Inside the button it inherits the pill's `gap-2`, so no explicit
                  separator is needed HERE — unlike the single-series branch below,
                  which has no flex container. */}
              {derived && <span className="italic opacity-70">{DERIVED_COPY.marker}</span>}
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
                {/* ⚠ EXPLICIT separator. This branch is plain text with no flex
                    container, so a marker appended without one renders as
                    "FY2010–25computed by Treasury Tracker" — the exact defect
                    AUSTIN-TRAVIS-01 UAT hit as "actualsFY2010–25". */}
                {derived && (
                  <span className="italic opacity-70">{' · '}{DERIVED_COPY.marker}</span>
                )}
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
        {single
          ? (anyDerived ? SERIES_TOGGLE_COPY.singleDerived : SERIES_TOGGLE_COPY.single)
          : (anyDerived ? SERIES_TOGGLE_COPY.introAnyDerived : SERIES_TOGGLE_COPY.intro)}
      </span>

      {/* ⚠ SCOPE-04 — this is the whole disclosure, and it is load-bearing.
          `Total Governmental` here is built from the State Controller's
          governmental schedule; a city's own audited "Total Governmental Funds"
          also includes its redevelopment successor-agency funds. BOTH totals are
          individually correct, so no arithmetic gate can ever surface the
          difference — a tie test would be comparing two right answers to
          different questions. Chris's ruling (2026-08-22) was to keep the name
          and disclose the exclusion, which makes this sentence the only thing
          that tells a reader. If it stops rendering, the label silently
          overstates what the figure covers. */}
      {shownIsDerived && (
        <span className="max-w-prose text-[11px] leading-relaxed text-ev-gray-500 dark:text-ev-gray-400">
          {DERIVED_COPY.explainer}{' '}{DERIVED_COPY.scopeNote}
        </span>
      )}
    </div>
  );
}

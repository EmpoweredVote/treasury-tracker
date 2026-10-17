import React, { useState } from 'react';
import type { FigureFlag } from '../data/figureFlags';
import SourceChip from './federal/SourceChip';

/**
 * Reader-facing figure flag.
 *
 * ⚠⚠ THE FIGURE IS NEVER ALTERED. This banner sits BESIDE a number that is
 * shown exactly as the government published it. Its whole purpose is to tell a
 * reader why that number looks inconsistent — the Milledgeville Rule: it is not
 * TT's job to hide bad data, it IS TT's job to flag it and say why.
 *
 * ⚠ ALWAYS VISIBLE BY DESIGN. The evidence lives behind a disclosure toggle,
 * but the WARNING does not. A collapsed-by-default panel is how a flag stops
 * being read, and an unread flag is indistinguishable from no flag at all.
 *
 * ⚠ TONE IS LOAD-BEARING. These are self-reported forms the publisher
 * explicitly does not certify, and every defect found so far UNDERSTATES
 * spending rather than inflating it. The copy says a figure looks wrong and
 * what it is being compared against. It never implies wrongdoing.
 *
 * ⚠⚠ COLOURS: `ev-yellow-*` has NO dark-mode override in index.css (unlike
 * `ev-gray-*`, which shifts automatically), so every colour here is written as
 * an explicit light/dark PAIR. A token that does not exist is dropped SILENTLY
 * by Tailwind and the element renders unstyled — `tests/evColorTokensResolve`
 * is the repo-wide guard for exactly that.
 */
interface FigureFlagBannerProps {
  flag: FigureFlag;
  /** Rendered into the heading so the reader knows what is flagged. */
  label?: string;
}

const FigureFlagBanner: React.FC<FigureFlagBannerProps> = ({ flag, label }) => {
  const [open, setOpen] = useState(false);
  const detailId = `figure-flag-detail-${flag.id}`;

  // ⚠⚠ `not-comparable` MUST NOT LOOK LIKE A WARNING. On those the figure is
  // CORRECT — only the year-over-year comparison breaks — so a warning
  // triangle would tell the reader something false about the number AND
  // impute a fault to a government that has none. Neutral blue, an
  // informational icon, and an assurance line that says the figure is right.
  const informational = flag.severity === 'not-comparable';

  const shell = informational
    ? 'border-ev-skyblue-300 bg-ev-skyblue-050 dark:border-ev-skyblue-800 dark:bg-ev-skyblue-900'
    : 'border-ev-yellow-300 bg-ev-yellow-050 dark:border-ev-yellow-800 dark:bg-ev-yellow-950';
  const icon = informational
    ? 'text-ev-skyblue-700 dark:text-ev-skyblue-300'
    : 'text-ev-yellow-700 dark:text-ev-yellow-400';
  const heading = informational
    ? 'text-ev-gray-900 dark:text-ev-skyblue-100'
    : 'text-ev-gray-900 dark:text-ev-yellow-100';
  const body = informational
    ? 'text-ev-gray-700 dark:text-ev-skyblue-200'
    : 'text-ev-gray-700 dark:text-ev-yellow-200';
  const assuranceTone = informational
    ? 'text-ev-skyblue-700 dark:text-ev-skyblue-300'
    : 'text-ev-yellow-800 dark:text-ev-yellow-400';
  const rule = informational
    ? 'border-ev-skyblue-200 dark:border-ev-skyblue-800'
    : 'border-ev-yellow-200 dark:border-ev-yellow-800';
  const quoteRule = informational
    ? 'border-ev-skyblue-300 dark:border-ev-skyblue-800'
    : 'border-ev-yellow-300 dark:border-ev-yellow-800';
  const assurance = informational
    ? 'Both years are shown exactly as filed — the figures are right, the comparison is not'
    : 'Shown exactly as filed — not corrected or removed';

  return (
    <div
      // role=note, not role=alert: an alert interrupts a screen reader
      // mid-task, and this is standing context about the figure, not an event.
      role="note"
      aria-label={`${informational ? 'Comparability notice' : 'Data quality notice'}${label ? ` for ${label}` : ''}`}
      className={`rounded-xl border overflow-hidden ${shell}`}
    >
      <div className="px-4 py-3 sm:px-5 sm:py-4 flex gap-3">
        <span
          aria-hidden="true"
          className={`shrink-0 text-lg leading-6 ${icon}`}
        >
          {informational ? 'ⓘ' : '⚠'}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm sm:text-base font-bold ${heading}`}>
            {flag.headline}
          </p>
          <p className={`mt-1 text-sm leading-relaxed ${body}`}>
            {flag.summary}
          </p>
          <p className={`mt-2 text-xs font-semibold uppercase tracking-wide ${assuranceTone}`}>
            {assurance}
          </p>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={detailId}
            className="mt-2 text-sm font-semibold text-ev-teal-600 dark:text-ev-skyblue-300 hover:underline"
          >
            {open ? 'Hide the evidence −' : 'See the evidence +'}
          </button>
        </div>
      </div>

      {open && (
        <div
          id={detailId}
          className={`px-4 pb-4 sm:px-5 sm:pb-5 space-y-4 text-sm leading-relaxed border-t pt-4 ${body} ${rule}`}
        >
          {flag.entries.map((e, i) => (
            <section key={e.source_url + i}>
              {e.title && (
                <h4 className={`font-semibold mb-1 ${heading}`}>
                  {e.title}
                </h4>
              )}
              <p>
                {e.text}{' '}
                <SourceChip
                  sourceName={e.source_name}
                  sourceUrl={e.source_url}
                  fetchDate={e.source_date}
                  compact
                />
              </p>
              {e.quote && (
                <p className={`mt-2 pl-3 border-l-2 italic ${quoteRule} ${body}`}>
                  &ldquo;{e.quote}&rdquo;
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default FigureFlagBanner;

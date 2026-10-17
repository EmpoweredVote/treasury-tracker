import React, { useState } from 'react';
import type { FigureFlag } from '../data/figureFlags';
import SourceChip from './federal/SourceChip';

/**
 * Reader-facing figure flag — CONTEXT, NOT A VERDICT.
 *
 * ⚠⚠ THE FIGURE IS NEVER ALTERED. This sits beside a number shown exactly as
 * the government published it, and explains what that number covers and what it
 * leaves out. The Milledgeville Rule: it is not TT's job to hide bad data, it
 * IS TT's job to say why a figure looks inconsistent.
 *
 * ⚠⚠ ONE CALM TREATMENT FOR EVERY SEVERITY — no warning triangle, no alarm
 * colour, ever. Corrected 2026-10-17 (Chris). The first version shouted, which
 * put TT in the position of adjudicating a government's competence. Two reasons
 * that is wrong:
 *
 *   1. TT IS NOT THE AUDITOR. The publisher states on the form's own face that
 *      it "cannot certify" these self-reported figures.
 *   2. ⚠⚠ WE CAME ONE STEP FROM ACCUSING A COUNTY FALSELY. Fulton FY2017
 *      property tax sat at 0.592 of its neighbours — numerically identical in
 *      shape to the genuine defects — and was a COURT-ORDERED billing delay.
 *      A tool that close to that mistake has not earned a raised voice.
 *
 * ⚠ WHAT DID NOT SOFTEN: the practical consequence. A reader who takes DeKalb
 * FY2018 at face value is wrong sevenfold, and that must survive a skim. It is
 * carried by the MAGNITUDE IN THE HEADLINE and by `whatThisMeans` — by
 * information, never by styling. Calm is not the same as quiet.
 *
 * ⚠ ALWAYS VISIBLE BY DESIGN. The evidence sits behind a disclosure toggle;
 * the context does not. A collapsed-by-default note is how a note stops being
 * read, and an unread note is indistinguishable from no note at all.
 *
 * ⚠⚠ COLOURS: `ev-skyblue-*` has NO dark-mode override in index.css (unlike
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

  // ⚠ Severity steers only the ASSURANCE WORDING now, never the styling. On a
  // `not-comparable` flag both figures are correct and only the comparison
  // breaks, so the assurance has to say so rather than hinting at a fault.
  const assurance = flag.severity === 'not-comparable'
    ? 'Both years are shown exactly as filed — the figures are right, the comparison is not'
    : 'Shown exactly as filed — TT does not adjust published figures';

  return (
    <div
      // role=note, not role=alert: an alert interrupts a screen reader
      // mid-task, and this is standing context about the figure, not an event.
      role="note"
      aria-label={`About this figure${label ? ` — ${label}` : ''}`}
      className="rounded-xl border border-ev-skyblue-300 bg-ev-skyblue-050 dark:border-ev-skyblue-800 dark:bg-ev-skyblue-900 overflow-hidden"
    >
      <div className="px-4 py-3 sm:px-5 sm:py-4 flex gap-3">
        <span
          aria-hidden="true"
          className="shrink-0 text-lg leading-6 text-ev-skyblue-700 dark:text-ev-skyblue-300"
        >
          ⓘ
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm sm:text-base font-bold text-ev-gray-900 dark:text-ev-skyblue-100">
            {flag.headline}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ev-gray-700 dark:text-ev-skyblue-200">
            {flag.summary}
          </p>
          {/* ⚠ The actionable line. This is what replaced the implied verdict:
              not "something is wrong" but "here is how to use this number". */}
          <p className="mt-2 text-sm font-semibold leading-relaxed text-ev-gray-900 dark:text-ev-skyblue-100">
            {flag.whatThisMeans}
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ev-skyblue-700 dark:text-ev-skyblue-300">
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
          className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-4 text-sm leading-relaxed border-t pt-4 text-ev-gray-700 dark:text-ev-skyblue-200 border-ev-skyblue-200 dark:border-ev-skyblue-800"
        >
          {flag.entries.map((e, i) => (
            <section key={e.source_url + i}>
              {e.title && (
                <h4 className="font-semibold mb-1 text-ev-gray-900 dark:text-ev-skyblue-100">
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
                <p className="mt-2 pl-3 border-l-2 italic border-ev-skyblue-300 dark:border-ev-skyblue-800 text-ev-gray-700 dark:text-ev-skyblue-200">
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

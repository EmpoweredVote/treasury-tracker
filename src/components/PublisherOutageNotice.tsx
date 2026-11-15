import React from 'react';
import type { PublisherOutage } from '../data/publisherOutages';

interface Props {
  outage: PublisherOutage;
}

/**
 * Tells the reader that the publisher behind this citation is offline.
 *
 * ⚠⚠ THE FIGURE IS NOT IN QUESTION — THE LINK IS. This sits beside the source
 * chip rather than replacing it, because the chip is still CORRECT: it names
 * the right publisher and holds the right URL, and that URL should work again
 * when the publisher restores the section. What the reader needs is the one
 * thing they cannot discover by clicking: that the 404 waiting for them is the
 * publisher's outage and not a broken citation.
 *
 * ⭐ `role="note"`, `ⓘ`, and the same calm ev-skyblue treatment as
 * `FigureFlagBanner` — deliberately NOT a warning triangle or an alert. An
 * alert interrupts a screen reader mid-task; this is standing context. And the
 * publisher here is the victim of a cyberattack, not a culprit, so alarm
 * styling would editorialise against them.
 *
 * ⚠ The chip keeps its live href on purpose. Suppressing the link would hide
 * the one thing a reader could use to check for themselves whether the
 * publisher is back — and TT does not decide for a reader what they may click.
 */
const PublisherOutageNotice: React.FC<Props> = ({ outage }) => (
  <div
    role="note"
    aria-label="About this source link"
    className="mt-2 rounded-xl border px-3 py-2 sm:px-4 sm:py-3 flex gap-2.5 border-ev-skyblue-300 bg-ev-skyblue-050 dark:border-ev-skyblue-800 dark:bg-ev-skyblue-900"
  >
    <span
      aria-hidden="true"
      className="shrink-0 text-base leading-5 text-ev-skyblue-700 dark:text-ev-skyblue-300"
    >
      ⓘ
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold text-ev-gray-900 dark:text-ev-skyblue-100">
        {outage.headline}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ev-gray-700 dark:text-ev-skyblue-200">
        {outage.detail}
      </p>
      {/* ⭐ The publisher's own words, quoted not summarised — the same rule
          auditGradeRegistry.mjs and figureFlags.ts follow. Editing quoted text
          falsifies what it proves. */}
      <p className="mt-2 pl-3 border-l-2 italic text-sm border-ev-skyblue-300 dark:border-ev-skyblue-800 text-ev-gray-700 dark:text-ev-skyblue-200">
        &ldquo;{outage.evidence}&rdquo;{' '}
        <a
          href={outage.evidenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="not-italic font-semibold text-ev-teal-600 dark:text-ev-skyblue-300 hover:underline"
        >
          — {outage.publisherName} ↗
        </a>
      </p>
    </div>
  </div>
);

export default PublisherOutageNotice;

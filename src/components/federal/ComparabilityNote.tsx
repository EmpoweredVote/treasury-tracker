import React, { useState } from 'react';
import type { ComparabilitySource, AgencyReorganization } from '../../types/budget';
import SourceChip from './SourceChip';

/**
 * Comparability / definition-drift note (Phase 51, CTX-02).
 *
 * A compact, expandable panel (mirrors MethodologyPanel) that surfaces the
 * sourced comparability content on federal history views: the Transition
 * Quarter explanation on the TQ view, and the function/agency definition-drift
 * notes on historical annual years. Every line carries a SourceChip linking to
 * its official source — nothing here is unsourced prose.
 */
interface ComparabilityNoteProps {
  title: string;
  /** Optional lead sentence shown above the entries. */
  intro?: string;
  /** Prose notes, each with its own source chip. */
  entries: ComparabilitySource[];
  /** Optional agency-reorganization rows, each cited to its enabling law. */
  reorganizations?: AgencyReorganization[];
  /** Heading shown above the reorganization list. */
  reorgHeading?: string;
  /** Start expanded (used for the TQ view, where the note IS the context). */
  defaultOpen?: boolean;
}

const ComparabilityNote: React.FC<ComparabilityNoteProps> = ({
  title,
  intro,
  entries,
  reorganizations,
  reorgHeading = 'Major department changes in this period',
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-ev-gray-800 border border-ev-gray-200 dark:border-ev-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#F7F7F8] dark:hover:bg-ev-gray-700 transition-colors"
      >
        <span className="text-base font-bold text-ev-gray-900 dark:text-ev-gray-100">{title}</span>
        <span className="text-ev-gray-500" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-5 text-sm text-ev-gray-700 dark:text-ev-gray-300 leading-relaxed">
          {intro && <p>{intro}</p>}

          {entries.map((e, i) => (
            <section key={e.source_url + i}>
              {e.title && (
                <h4 className="font-semibold text-ev-gray-900 dark:text-ev-gray-100 mb-1">{e.title}</h4>
              )}
              <p>
                {e.text}{' '}
                <SourceChip sourceName={e.source_name} sourceUrl={e.source_url} fetchDate={e.source_date} compact />
              </p>
              {e.quote && (
                <p className="mt-2 pl-3 border-l-2 border-ev-gray-200 dark:border-ev-gray-700 italic text-ev-gray-500 dark:text-ev-gray-400">
                  &ldquo;{e.quote}&rdquo;
                </p>
              )}
            </section>
          ))}

          {reorganizations && reorganizations.length > 0 && (
            <section>
              <h4 className="font-semibold text-ev-gray-900 dark:text-ev-gray-100 mb-2">
                {reorgHeading}
              </h4>
              <ul className="space-y-3">
                {reorganizations.map((r) => (
                  <li key={r.agency} className="flex flex-col gap-1">
                    <span>
                      <strong className="text-ev-gray-900 dark:text-ev-gray-100">{r.agency}</strong>{' '}
                      <span className="text-ev-gray-500 dark:text-ev-gray-400">({r.year})</span> — {r.note}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-ev-gray-500 dark:text-ev-gray-400">
                      <span>{r.enabling_law}</span>
                      <SourceChip
                        sourceName={r.enabling_law}
                        sourceUrl={r.source_url}
                        fetchDate={r.source_date}
                        compact
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default ComparabilityNote;

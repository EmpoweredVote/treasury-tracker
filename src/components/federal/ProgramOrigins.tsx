import React from 'react';
import type { ProgramOrigins as ProgramOriginsData } from '../../types/budget';

interface ProgramOriginsProps {
  origins: ProgramOriginsData;
}

const ExtLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-ev-muted-blue hover:underline"
  >
    {children} <span aria-hidden="true">↗</span>
  </a>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col sm:flex-row sm:gap-3">
    <dt className="w-full sm:w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-ev-gray-400 dark:text-ev-gray-500 pt-0.5">
      {label}
    </dt>
    <dd className="text-sm text-ev-gray-700 dark:text-ev-gray-200 leading-relaxed">{children}</dd>
  </div>
);

/**
 * "Where this program comes from" — Tier 2 program origins card (federal pilot).
 * Every displayed value comes from a Congress.gov/GovInfo record and links to
 * that official record; nothing here is generated or editorialized.
 * Pre-1973 (foundational) programs show the sponsor-boundary note in place of
 * sponsor/cosponsors — an honest data boundary, never filled from memory.
 */
const ProgramOrigins: React.FC<ProgramOriginsProps> = ({ origins }) => {
  const details = origins.details ?? [];
  const officialTitle = details.find((d) => d.field === 'official_title');
  const sponsorNote = details.find((d) => d.field === 'sponsor_note');
  const extras = details.filter((d) => d.field !== 'official_title' && d.field !== 'sponsor_note');

  return (
    <div className="rounded-lg border border-[#E2EBEF] dark:border-ev-gray-700 bg-[#F7F7F8] dark:bg-ev-gray-900 p-4 space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ev-gray-400 dark:text-ev-gray-500">
          Where this program comes from
        </h3>
        <p className="text-sm font-semibold text-[#1C1C1C] dark:text-ev-gray-100 mt-1">
          {origins.programName}
        </p>
      </div>
      <dl className="space-y-2">
        {origins.enablingBill && origins.enablingBillUrl && (
          <Row label="Enabling bill">
            <ExtLink href={origins.enablingBillUrl}>{origins.enablingBill}</ExtLink>
          </Row>
        )}
        {!origins.enablingBill && officialTitle && (
          <Row label="Official title">
            <ExtLink href={officialTitle.source_url}>{officialTitle.value}</ExtLink>
          </Row>
        )}
        {origins.publicLaw && (
          <Row label="Public law">
            {origins.publicLawUrl ? (
              <ExtLink href={origins.publicLawUrl}>{origins.publicLaw}</ExtLink>
            ) : (
              origins.publicLaw
            )}
          </Row>
        )}
        {origins.enactedYear != null && <Row label="Enacted">{origins.enactedYear}</Row>}
        {origins.sponsor && origins.sponsorUrl && (
          <Row label="Sponsor">
            <ExtLink href={origins.sponsorUrl}>{origins.sponsor}</ExtLink>
          </Row>
        )}
        {!origins.sponsor && sponsorNote && (
          <Row label="Sponsor">
            {sponsorNote.value} <ExtLink href={sponsorNote.source_url}>Congress.gov coverage</ExtLink>
          </Row>
        )}
        {origins.cosponsorsCount != null && origins.cosponsorsUrl && (
          <Row label="Cosponsors">
            <ExtLink href={origins.cosponsorsUrl}>{origins.cosponsorsCount} cosponsors</ExtLink>
          </Row>
        )}
        {extras.map((d) => (
          <Row key={d.field} label={d.field}>
            <ExtLink href={d.source_url}>{d.value}</ExtLink>
          </Row>
        ))}
      </dl>
      <p className="text-xs text-ev-gray-400 dark:text-ev-gray-500">
        Records from {origins.sourceApi === 'govinfo' ? 'GovInfo (U.S. Government Publishing Office)' : 'Congress.gov'}
      </p>
    </div>
  );
};

export default ProgramOrigins;

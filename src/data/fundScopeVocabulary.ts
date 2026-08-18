/**
 * Fund-scope vocabulary and reader-facing explainer copy (SCOPE-01 Task 10).
 *
 * ⚠ PUBLIC-FACING COPY. For many readers this is the first thing they will ever
 * read about fund accounting, so it is kept in one reviewable file rather than
 * scattered through JSX. Chris reviews this file before it ships (Task 10 Step 3).
 *
 * SCOPE BOUNDARY: vocabulary only. What each level contains, why one city has
 * more than one true total, and why two honest figures can differ by half. The
 * material about money MOVING between a city and its enterprises — transfers,
 * reclassification, "where the money gets quietly moved" — belongs to SCOPE-03
 * and is deliberately absent here. Adding it early would bury the vocabulary.
 *
 * Values mirror the CHECK constraint on treasury.budgets.fund_scope and the
 * SCOPE object in scripts/lib/fundScope.mjs.
 */

export type FundScope = 'general_fund' | 'total_governmental' | 'all_funds' | 'unknown';

export const FUND_SCOPE_VALUES: readonly FundScope[] = [
  'general_fund', 'total_governmental', 'all_funds', 'unknown',
] as const;

/**
 * Scopes that must never be compared across entities.
 *
 * Mirrors NON_COMPARABLE_SCOPES in scripts/lib/fundScope.mjs. Kept as a LIST
 * behind `isComparableScope()` rather than inlined as `!== 'unknown'`, because
 * the set has already changed once during this milestone and SCOPE-02 adds a
 * `reporting_entity` dimension that will need folding in here.
 */
export const NON_COMPARABLE_SCOPES: readonly FundScope[] = ['unknown'] as const;

/** True when a figure at this scope may be compared with another entity's figure. */
export function isComparableScope(scope: FundScope | null | undefined): boolean {
  if (!scope) return false;            // absent is treated as unknown, never as comparable
  return FUND_SCOPE_VALUES.includes(scope) && !NON_COMPARABLE_SCOPES.includes(scope);
}

/**
 * Normalise whatever the API gave us.
 *
 * ⚠ An ABSENT field must become `unknown`, not a guess. The API only began
 * returning `fund_scope` in 2026-08; any deploy lag, cached response, or older
 * client sees it missing, and the honest reading of "missing" is "we do not know
 * what this covers" — which is exactly what `unknown` means.
 */
export function normalizeScope(raw: unknown): FundScope {
  return typeof raw === 'string' && (FUND_SCOPE_VALUES as readonly string[]).includes(raw)
    ? (raw as FundScope)
    : 'unknown';
}

export interface FundScopeCopy {
  /** Short chip label shown beside the source. */
  label: string;
  /** One line, shown on hover/expand under the label. */
  short: string;
  /** The full explainer paragraph for this level. */
  long: string;
}

export const FUND_SCOPE_COPY: Record<FundScope, FundScopeCopy> = {
  general_fund: {
    label: 'General Fund',
    short: 'The main account most day-to-day services are paid from.',
    long:
      'The General Fund is the account a city or state pays for most everyday services from — '
      + 'police, fire, parks, libraries, courts, administration — using money it can spend on '
      + 'more or less anything, mostly taxes. It leaves out money the law has already reserved '
      + 'for a specific purpose, and it leaves out services that charge their customers '
      + 'directly, like water or electricity. It is usually the figure elected officials argue '
      + 'over at budget time, which is why it is often called "the budget" even though it is '
      + 'only part of the money.',
  },
  total_governmental: {
    label: 'Total Governmental',
    short: 'The General Fund plus other tax-supported funds.',
    long:
      'Total Governmental adds the General Fund together with the other funds supported by '
      + 'taxes and grants — road and construction projects, restricted grant money, debt '
      + 'payments, and reserves the law has set aside for a named purpose. It is a fuller '
      + 'picture of the tax-funded side of government than the General Fund alone. It still '
      + 'leaves out the operations that run like businesses and bill their customers directly.',
  },
  all_funds: {
    label: 'All Funds',
    short: 'Everything, including utilities that bill customers directly.',
    long:
      'All Funds is everything the government spends or receives, including the operations that '
      + 'work like businesses and charge customers for what they use — water, sewer, rubbish '
      + 'collection, electricity, airports, ports, transit. In places that run their own '
      + 'utilities this can be a very large share of the total, so an All Funds figure can be '
      + 'far bigger than a General Fund figure for the same place in the same year.',
  },
  unknown: {
    label: 'Scope not established',
    short: 'We have not verified which funds this figure covers.',
    long:
      'We have not yet confirmed which funds this figure covers. Rather than guess, we say so. '
      + 'Every scope shown elsewhere on this site was checked against an independent audited '
      + 'document, and until that check has been done for this source we leave it unlabelled '
      + 'and keep it out of comparisons with other places. The figure itself is what the source '
      + 'published; what is missing is our confirmation of what it includes.',
  },
};

/**
 * The shared explainer, shown once per page rather than per figure.
 *
 * Written to be read by someone who has never heard the term "fund accounting"
 * and does not want a lecture. The three-paragraph shape is deliberate: what the
 * problem is, why it is nobody's mistake, and what we do about it.
 */
export const FUND_SCOPE_EXPLAINER = {
  heading: 'Why budget totals need a scope',

  intro:
    'Governments keep their money in separate pots called funds, and each pot has its own rules '
    + 'about what it can pay for. That means a single city has several different totals, all of '
    + 'them real and all of them audited. Which one you are looking at changes the number a lot.',

  whyMoreThanOneTotal:
    'This is not double-counting and it is not anyone being evasive — it is how public accounting '
    + 'is required to work. A city that runs its own water utility keeps that money separate by '
    + 'law, because water customers\' payments cannot be spent on, say, policing. So "how much '
    + 'does this city spend?" has more than one correct answer, depending on whether you mean the '
    + 'money elected officials allocate freely, all the tax-funded money, or genuinely everything.',

  whyFiguresDiffer:
    'The gap can be enormous. For a place that runs its own utilities, an All Funds total can be '
    + 'two or three times its General Fund total for the same year. Both figures are honest; they '
    + 'answer different questions. Comparing one city\'s General Fund against another city\'s All '
    + 'Funds makes the second look like it spends far more, when the difference may be entirely '
    + 'in which pots were counted.',

  whatWeDo:
    'So every figure here carries the scope it was reported at, and we only ever compare like '
    + 'with like. Where we have not yet verified a source\'s scope we mark it "scope not '
    + 'established" and hold it out of comparisons instead of quietly mixing it in. That label is '
    + 'a statement about our verification, not a criticism of the source.',
};

/** Convenience: the chip label for a scope, tolerating an absent value. */
export function scopeLabel(scope: FundScope | null | undefined): string {
  return FUND_SCOPE_COPY[normalizeScope(scope)].label;
}

/**
 * Basis vocabulary (SCOPE-02 Task 7).
 *
 * A closed-year actual and an adopted budget are not the same kind of number
 * even when they carry the same fund scope and the same reporting entity: one
 * is what was spent, the other is what was planned to be spent. Comparing them
 * across entities produced the −75% cliff on Long Beach's chart that opened
 * SCOPE-02 -- an all-funds ACTUAL compared against a General Fund ADOPTED
 * budget. `Basis` and `normalizeBasis` live here, in the same file as
 * `FundScope` and `normalizeScope`, rather than in `budgetSeries.ts` where a
 * later task first introduces basis-aware series logic, because this file is
 * SCOPE-01's single reviewable home for all reader-facing scope vocabulary and
 * a `budgetSeries.ts` that itself needs `normalizeScope` from here would create
 * an import cycle between the two.
 */
export type Basis = 'actual' | 'adopted' | 'unknown';

export const BASIS_VALUES: readonly Basis[] = ['actual', 'adopted', 'unknown'] as const;

/**
 * ⚠ An ABSENT field must become `unknown`, not a guess -- the same rule
 * normalizeScope() follows. The API only began returning `basis` in 2026-08, so
 * `undefined` is a real production state and the honest reading of "missing" is
 * "we have not established whether this is an actual or a budget".
 */
export function normalizeBasis(raw: unknown): Basis {
  return typeof raw === 'string' && (BASIS_VALUES as readonly string[]).includes(raw)
    ? (raw as Basis)
    : 'unknown';
}

/**
 * Reporting-entity vocabulary (SCOPE-02 Task 7).
 *
 * A government's own operations ("primary government") versus its primary
 * government plus legally separate but financially linked entities it must
 * still report on ("component units", e.g. a housing authority or a school
 * building corporation) are two different reporting boundaries for the same
 * place. Absent or unrecognised becomes `unknown`, never a guess.
 */
export type ReportingEntity = 'primary_government' | 'incl_component_units' | 'unknown';

const REPORTING_ENTITY_VALUES: readonly ReportingEntity[] =
  ['primary_government', 'incl_component_units', 'unknown'] as const;

/** Absent or unrecognised becomes `unknown`, never a guess. */
export function normalizeReportingEntity(raw: unknown): ReportingEntity {
  return typeof raw === 'string' && (REPORTING_ENTITY_VALUES as readonly string[]).includes(raw)
    ? (raw as ReportingEntity)
    : 'unknown';
}

export interface ComparableFigure {
  fundScope?: FundScope | null;
  basis?: Basis | null;
  reportingEntity?: ReportingEntity | null;
}

/**
 * Two figures may sit on a shared axis only when all THREE dimensions agree and
 * none is `unknown`.
 *
 * ⚠ Stricter than SCOPE-01's `isComparableScope()`, deliberately. SCOPE-01
 * measured MN OSA running ~7% high statewide and ~17-22% for TIF-heavy cities
 * against an ACFR-derived total_governmental purely from the reporting-entity
 * boundary; comparing across it is the same class of error as the fund-scope
 * seam, at a smaller magnitude. There is still no cross-entity comparison
 * surface in the app (SCOPE-01-RECON §10.1), so this lands as a guard rather
 * than a visible reduction.
 */
export function areComparable(a: ComparableFigure, b: ComparableFigure): boolean {
  const norm = (f: ComparableFigure) => ({
    fundScope: normalizeScope(f.fundScope),
    basis: normalizeBasis(f.basis),
    reportingEntity: normalizeReportingEntity(f.reportingEntity),
  });
  const x = norm(a);
  const y = norm(b);

  if (x.fundScope === 'unknown' || x.basis === 'unknown' || x.reportingEntity === 'unknown') return false;
  if (y.fundScope === 'unknown' || y.basis === 'unknown' || y.reportingEntity === 'unknown') return false;

  return x.fundScope === y.fundScope
    && x.basis === y.basis
    && x.reportingEntity === y.reportingEntity;
}

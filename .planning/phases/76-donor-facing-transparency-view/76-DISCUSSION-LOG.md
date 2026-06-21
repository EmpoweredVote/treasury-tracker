# Phase 76: Donor-Facing Transparency View - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 76-donor-facing-transparency-view
**Areas discussed:** Fundraising goal source, Balance & runway treatment, Income / fee waterfall, Volunteer story & layout

---

## Fundraising goal source

| Option | Description | Selected |
|--------|-------------|----------|
| Manual config value | A single editable number you update when the campaign goal changes; no live API | ✓ |
| GiveButter campaign goal | Pull from the linked GiveButter campaign (requires API/export — deferred this milestone) | |
| New field on summary record | Add goal columns to org_financial_summary, set by loader | (merged into the manual choice — see below) |

**User's choice:** Manual config value.

| Option | Description | Selected |
|--------|-------------|----------|
| Net income raised this FY | income_net (gross − fees) — matches "what reached EV" | ✓ |
| Gross income raised this FY | income_gross — bigger, pre-fee headline | |
| Current bank balance | balance on hand (conflates raised vs. spent) | |

**User's choice:** Progress measured against net income raised this FY.

| Option | Description | Selected |
|--------|-------------|----------|
| Fields on summary record | goal_amount + goal_label on org_financial_summary, served with progress | ✓ |
| Standalone config file | data/ev-sources/goal.json read separately | |

**User's choice:** Manual value stored as fields on the summary record (reconciles the two earlier answers — value is manual, home is the summary row).

| Option | Description | Selected |
|--------|-------------|----------|
| Cap at 100% + celebrate | Bar fills to 100%, "Goal reached — thank you!" state | ✓ |
| Show overage past 100% | "120% of goal" / "$X over goal" | |
| You decide | Planner picks | |

**User's choice:** Cap at 100% + celebrate.
**Notes:** Goal is fully manual this milestone (live GiveButter pull deferred to EVAUTO).

---

## Balance & runway treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Two InsightCard tiles | Funds on Hand + Runway tiles in QuickFactsRow | |
| Dedicated runway callout | Prominent runway banner | |
| Tiles + sentence in summary | Tiles + plain-language burn line | ✓ (balance + line, runway dropped) |

**User's choice (free-text):** "Let's just do Funds on Hand tile for now, plus the plain language line." Then: "I'm not even sure if I should share the runway. If I run out of money, would I really stop? Let's show cash on hand, though."

| Option | Description | Selected |
|--------|-------------|----------|
| Color shift when low | Runway turns amber/red below a threshold | |
| Always-neutral, honest copy | Number + factual subtext, no color alarm | |
| You decide | Planner picks | |

**User's choice:** Reconsidered — runway-as-countdown implies a shutdown that wouldn't really happen for an all-volunteer org.

Follow-up:

| Option | Description | Selected |
|--------|-------------|----------|
| Drop runway, show burn pace | No countdown; honest "EV spends ~$X/month, mostly on [category]" line | ✓ |
| Drop runway entirely | Just balance, no burn/runway | |
| Keep runway after all | Show ~4 months low-key | |

**User's choice:** Drop runway, show burn pace.

| Option | Description | Selected |
|--------|-------------|----------|
| Single InsightCard tile | One "Funds on Hand" tile + plain-language line | |
| You decide | Planner places it | ✓ |

**User's choice:** You decide (placement).
**Notes:** EVVIEW-03 reframed — runway display dropped (data stays in DB). Insight: runway misrepresents an all-volunteer org that wouldn't stop at $0.

---

## Income / fee waterfall

| Option | Description | Selected |
|--------|-------------|----------|
| Compact 3-number flow | Horizontal "gave $X → $Y fees → $Z" strip | |
| Small per-source table | Rows per platform, gave/fees/net columns | |
| Sentence in summary | Fold into PlainLanguageSummary prose | ✓ |

**User's choice:** Sentence in summary.

| Option | Description | Selected |
|--------|-------------|----------|
| Totals headline + per-source detail | Combined headline + per-platform breakdown | ✓ |
| Totals only | Just the three combined numbers | |
| Per-source only | Each platform, reader sums | |

**User's choice:** Totals headline + per-source detail.

Follow-up (reconciling sentence-form with per-source detail):

| Option | Description | Selected |
|--------|-------------|----------|
| Mini-list under the sentence | Totals sentence + compact 3-row per-source breakdown in same block | ✓ |
| In the Money In breakdown | Per-source detail lives in existing income category view | |
| Totals sentence only | Drop per-source | |

**User's choice:** Mini-list under the sentence.
**Notes:** Verbatim framing — "Donors gave $X → $Y fees → $Z reached EV." Fees = reduction of income, never an expense.

---

## Volunteer story & layout

| Option | Description | Selected |
|--------|-------------|----------|
| Highlighted stat/badge | Bold "$0 to staff · 100% volunteer-run" callout | |
| Strengthen the sentence | Punchier prose | |
| Both | Badge + sentence | |

**User's choice (free-text):** "I'm not sure I'm excited to celebrate it, I'm more excited to pay groceries — I don't know if that wants to be a part of our long term identity, and since it will (hopefully one day) change, let's not make 'we don't pay anyone' as part of our brand identity. Honestly, if someone is getting paid, that's also going to the development of EV in a very tangible way — it's not simply overhead." → Rejected celebrating the all-volunteer angle.

Follow-up (disposition of the $0 line):

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it neutral & factual | Year-specific fact, no spin | ✓ |
| Remove it entirely | Drop the staff-comp line | |
| Keep, with future-facing note | Add "compensating contributors is part of the plan" | |

**User's choice:** Keep it neutral & factual.

| Option | Description | Selected |
|--------|-------------|----------|
| Breakdown, no volunteer spin | Honest expense-by-category, re-scope EVVIEW-02 | ✓ |
| You decide | Planner interprets EVVIEW-02 neutrally | |

**User's choice:** Breakdown, no volunteer spin.

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing components | Tiles + lines into QuickFactsRow/PlainLanguageSummary, slim goal bar | |
| Dedicated transparency panel | New bordered section grouping everything | |
| You decide | Planner chooses | ✓ |

**User's choice:** You decide (layout).
**Notes:** EVVIEW-02 reframed — "honest expense breakdown by category," neutral framing, no all-volunteer celebration.

## Claude's Discretion

- Page layout / composition (recommendation: extend existing components + slim goal-progress element).
- Manual-goal input mechanism (env var vs. small input file).
- `ev-accounts-api` endpoint shape (mirror `/treasury/federal/context`).
- Burn-pace copy + which "top category" to name.

## Deferred Ideas

- Runway display (computed/stored, not surfaced).
- GiveButter-sourced live goal → v2 EVAUTO.
- Goal overage (>100%) display.
- Richer per-source fee visual / waterfall chart.
- "Stretch goals" / forward allocation → v2 EVALLOC.
- In-kind / non-cash gifts (Phase 75 D-10).
- Future "contributors paid as EV grows" framing.

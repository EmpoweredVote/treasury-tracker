/**
 * ⚠⚠⚠ A `base_url` IS NOT A CITATION, AND THE SAME VERDICT WOULD LIE ABOUT IT.
 *
 * `classifyCitations()` answers one question — "can a reader still open the
 * thing we told them to open?" — and every verdict it has is pitched at that
 * promise. `treasury.data_sources.base_url` makes a DIFFERENT promise, and
 * which one depends on the row:
 *
 *   • SYNC ENDPOINT — `api_type = 'socrata'`. `supabase/functions/treasury-sync`
 *     handles socrata and nothing else (every other api_type gets
 *     `400 Unsupported`), so these are the only `base_url`s a running job calls.
 *     A dead one is a cron that fails on its next tick. **FAIL.**
 *
 *   • PROVENANCE RECORD — everything else. Where a human got the file for a
 *     manual loader. Dead breaks nobody today; it breaks whoever tries to
 *     re-derive our figures from the publisher. Real, but not an outage and not
 *     a published bad link. **DECLARED, and may not grow.**
 *
 *   • A PATH ON SOMEBODY'S LAPTOP — `file://C:/treasury-tracker/docs/...`,
 *     `local:docs/...`. 51 distinct, 86 rows, 11 cities, in production.
 *
 * ⭐⭐ THE LAPTOP PATHS ARE THE REASON THIS MODULE EXISTS RATHER THAN A REUSED
 * CALL. `citationShape()` returns `citable: false` for them, and in the citation
 * gate that means "the URL promises nothing, so we assert nothing" — a
 * deliberate, correct silence about a URL with no file extension. Applied to a
 * provenance record the same silence is a lie: a laptop path is not an unknown,
 * it is the provenance never having been recorded. The 11 cities bear it out —
 * 234 of their budgets cite nothing at all, and `docs/*` is gitignored, so the
 * only copy of the document is on one machine. Reusing the citation classifier
 * here would have filed all 51 under "uncitable" and moved on.
 *
 * ⛔ WHY A BASELINE AND NOT A HARD FAIL. There is no $0 repair: TT stores the
 * publisher URL for these documents NOWHERE, so the gate would be red forever
 * and the next broken endpoint would land invisibly inside a red run. The
 * ratchet is the same bargain `UNCITED_BASELINE` already makes — the debt is
 * counted, it may shrink, and it may never grow.
 *
 * ⚠ The local-path baseline is a COUNT, not a list of URLs, and that is a
 * deliberate weakening: a count cannot tell "one repaired, one new" from "no
 * change". It is a count because the alternative is committing 51 absolute
 * paths from one contributor's filesystem into a public repo to buy a
 * distinction nobody would act on differently. The gate PRINTS all of them
 * every run, so the swap is visible to a reader even where the ratchet is blind.
 */

/** Verdicts that mean the endpoint did not answer with what it promised. */
const BROKEN = new Set(['dead', 'wrong-type', 'unreachable']);

/**
 * @param {Array<object>} observations rows from `source_endpoint_census()`,
 *   each already carrying a `verdict` from `judgeProbe()`.
 * @param {{localPaths: number, provenanceBroken: Array<{url: string, why: string}>}} baseline
 */
export function judgeEndpoints(observations, baseline) {
  const declared = new Map((baseline?.provenanceBroken ?? []).map((d) => [d.url, d]));
  const seen = new Set();

  const ok = [];
  const syncBroken = [];
  const localPaths = [];
  const provenanceBroken = [];
  const provenanceDeclared = [];

  for (const o of observations) {
    // ⚠ ORDER MATTERS. A laptop path is reported AS a laptop path even when it
    // also drives a sync — "repair the URL" is not the instruction; "find out
    // where this file actually came from" is.
    if (o.is_local_path) {
      localPaths.push(o);
      continue;
    }
    if (!BROKEN.has(o.verdict)) {
      ok.push(o);
      continue;
    }
    if (o.drives_a_sync) {
      syncBroken.push(o);
      continue;
    }
    const d = declared.get(o.source_url);
    if (d) {
      seen.add(o.source_url);
      provenanceDeclared.push({ ...o, declaration: d });
    } else {
      provenanceBroken.push(o);
    }
  }

  // ⚠⚠ A DECLARATION THAT IS NO LONGER TRUE IS A SENTENCE THE REPO TELLS ITSELF
  // ABOUT THE WEB THAT HAS STOPPED BEING TRUE. #370's `stale` bucket, applied
  // here: either the publisher came back or the row was deleted, and both mean
  // the paragraph should go.
  const stale = [...declared.values()].filter((d) => !seen.has(d.url));

  const localBaseline = Number(baseline?.localPaths ?? 0);
  return {
    ok,
    syncBroken,
    localPaths,
    provenanceBroken,
    provenanceDeclared,
    stale,
    localCount: localPaths.length,
    localBaseline,
    localGrew: localPaths.length > localBaseline,
    localPaidDown: localPaths.length < localBaseline,
  };
}

/** True when nothing in this census should fail the run. */
export function endpointsAreClean(j) {
  return j.syncBroken.length === 0
    && j.provenanceBroken.length === 0
    && j.stale.length === 0
    && !j.localGrew;
}
